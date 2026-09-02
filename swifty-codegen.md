# example-app 站点前端技术调研报告

- 调研对象: https://example-app.example-company.com/chat/<hash:11>
- 调研时间: 2026-09-02
- 调研方式: 通过 CDP 接入本机 Chrome 已登录会话，用 playwright-cli 在页面真实运行时上下文内执行 JavaScript 取证（读取 Service Worker 注册表、iframe 属性、Performance 资源清单、响应头、控制台日志，并直接 fetch 关键脚本做静态分析）。下文引用的代码片段和日志均为页面运行时的实测内容，标注"推测"的除外。

## 一、结论速览

最初有三个怀疑：页面用了 Service Worker；浏览器里跑了一个 WebContainer，Vite dev server 跑在容器里；两者配合完成预览。三者全部成立，并补充了一个关键结论：

1. Service Worker 实锤。站点注册了 `webc_service_worker.js?version=<version>`，scope 是整个源站，当前处于 activated 状态并控制着页面。
2. Vite dev server 实锤。预览 iframe 内加载了完整的 Vite 开发态产物（`/@vite/client`、`/@react-refresh`、`node_modules/.vite/deps/*`、`/src/main.tsx` 直出），甚至能从容器内文件系统直接读到 Vite 依赖预构建的 `_metadata.json`。
3. WebContainer 实锤，但不是 StackBlitz 官方 SDK，而是自研的 "webc" 运行时。页面上没有任何 `*.webcontainer.io` 的 iframe，主 bundle 里也搜不到 `@webcontainer` 或 `stackblitz` 字样；但 chat.js 里有一整套名为 `WebCSystem` 的容器客户端代码，包含 5 个 Worker 脚本、5 个 WASM 包、独立的网络代理域名，甚至预览健康检查的报错文案里直接写着 "WebContainer 可能未启动"。架构思路与 StackBlitz WebContainer 同源：Service Worker 充当浏览器内的"本地 HTTP 服务器"，从内存中的虚拟文件系统响应预览请求。

一个直观的证据是流量：主页面直接 `fetch('/_i/<hash:7>/_p/3000/@vite/client')`，这条请求的 `transferSize` 为 0，也就是说它没有产生任何真实网络传输，是被 Service Worker 拦截后用容器内存里的文件直接应答的。预览页面上的几十个 Vite 模块请求全部如此。

## 二、背景知识

### 2.1 Service Worker 是什么

Service Worker 是浏览器在页面之外运行的一段后台脚本，最常见于 PWA 做离线缓存。它有三个关键特性，恰好都能被"浏览器内运行时"这个场景利用：

- 生命周期独立于页面：有 installing、waiting、activated 三个阶段，注册一次后持续存在，`navigator.serviceWorker.controller` 指向当前控制页面的实例。
- 作用域（scope）拦截：注册时声明一个 scope（如 `https://example-app.example-company.com/`），此后该 scope 下页面发出的所有 HTTP 请求都会先经过 Service Worker 的 `fetch` 事件，脚本可以自行构造响应返回（`respondWith`）。
- 只能拦截 HTTP 请求：WebSocket、postMessage 等非 HTTP 通道不受 Service Worker 控制。这个限制在后面分析 example-app 的 HMR 失败时是决定性的。

常规用法是缓存静态资源，而 example-app（以及 StackBlitz WebContainer）把它用成了另一个东西：一个架在浏览器内存里的"虚拟 Web 服务器"。页面请求 `/src/App.tsx` 这样在真实服务器上根本不存在的路径时，Service Worker 把请求转交给容器运行时，容器从自己的虚拟文件系统里取出内容（必要时现场编译转换）再拼成 Response 返回。对浏览器里跑的代码来说，它以为自己在一台真实的服务器上访问一个真实的 dev server。

### 2.2 COOP / COEP 响应头与 crossOriginIsolated

`crossOriginIsolated` 是一个布尔值，为 true 时页面可以使用 `SharedArrayBuffer` 和高精度计时等特性。Web 平台之所以默认关掉这些能力，是因为 Spectre 一类侧信道攻击可以借助共享内存跨源窃取数据；浏览器要求页面先把自己"隔离干净"才开放：

- `Cross-Origin-Opener-Policy: same-origin`（COOP）：把当前浏览上下文从跨源的 opener 关系中隔离出来，不让其他标签页通过 `window.opener` 之类的方式与自己共享进程。
- `Cross-Origin-Embedder-Policy: credentialless`（COEP）：要求页面嵌入的所有子资源要么声明允许跨源加载（CORP/CORS），要么以去凭据方式加载。`credentialless` 是比 `require-corp` 宽松的取值：加载跨源无凭据资源时不再要求对方显式配置 CORP，代价是请求会丢弃 cookie 等凭据。

两个头都配齐后，`window.crossOriginIsolated` 才会变成 true。这对 example-app 不是锦上添花而是硬性前提：WASM 运行时需要多线程时依赖 SharedArrayBuffer 实现线程间共享内存（WASM pthreads），Node/进程调度类的实现也常靠它。实测该页面 `crossOriginIsolated === true`，`typeof SharedArrayBuffer === 'function'`，响应头为 `cross-origin-opener-policy: same-origin` 与 `cross-origin-embedder-policy: credentialless`。

同源的预览 iframe 还显式声明了 `allow="cross-origin-isolated"`，把隔离状态继承进 iframe，容器内部的 Worker 和 WASM 才能同样拿到这些能力。

### 2.3 WebContainer 是什么

WebContainer 是 StackBlitz 推出的浏览器内 Node.js 运行时：用 WASM 实现一个 Node 用户态，配合 Service Worker 虚拟化网络层，让 dev server、npm install、终端命令全部在浏览器标签页里完成，服务器只负责下发静态资源。它的对外形态是 `@webcontainer/api`：

- 落地时会把预览应用装进一个 `*.webcontainer.io` 子域的 iframe 里（官方刻意不用同源，用独立域配合 COEP 做隔离，也规避 license 限制）。
- 主页面通过 `WebContainer.boot()`、`mount(文件树)`、`spawn('npm', ['install'])` 这类 API 驱动容器。
- 典型场景就是 AI 代码生成产品的"即时预览"：模型产出的文件写入容器，容器内 `npm install && npm run dev`，用户零等待看到结果，服务器不承担任何算力。

example-app 的 "webc" 是同一思路的自研实现（细节见第四节）：同样靠 Service Worker 劫持同源请求，同样是 WASM 用户态，但拆分出更多专职 Worker，并自建了独立的网络代理服务来解决跨域取依赖的问题。它没有使用 `@webcontainer/api`，也没有 `*.webcontainer.io` 子域。

### 2.4 Vite dev server 的请求模型，以及为什么它能被"搬进"浏览器

Vite 开发模式不打包，按需编译：浏览器直接向 dev server 请求一个个源文件，服务器现场把 TSX/CSS 转译成 JS 返回。这个模型天然是一组无状态的 HTTP GET，具体到页面里就是这些请求：

- `/@vite/client`：Vite 注入每个页面的客户端运行时，负责 HMR 的 WebSocket 连接和模块热替换。
- `/@react-refresh`：react 插件的刷新前导脚本。
- `/node_modules/.vite/deps/*`：依赖预构建产物（esbuild 把 npm 包打成单文件 ESM），带 `?v=<hash>` 缓存指纹。
- `/node_modules/.vite/deps/_metadata.json`：预构建清单，记录每个被预构建依赖的源、文件名、哈希。
- `/src/*.tsx`：业务源码，经 esbuild 转译后直出。

这些请求没有一个依赖真正的服务器状态（会话、数据库），都是"给路径、回文件"。这正是它适合被 Service Worker 虚拟化的原因：容器内跑一个真的 Vite（代码原封不动），只是把它的 HTTP 出口接到 Service Worker 上，浏览器里就出现了一个完整的 Vite dev server。

## 三、站点实测数据

### 3.1 Service Worker 注册情况

在页面上下文读取 `navigator.serviceWorker.getRegistrations()`：

```json
[
  {
    "scope": "https://example-app.example-company.com/",
    "scriptURL": "https://example-app.example-company.com/webc_service_worker.js?version=<version>",
    "state": "activated"
  }
]
```

`navigator.serviceWorker.controller` 同样指向该脚本。三个信息点：

- scope 是整站根路径，不是某个子目录。整个域名下的所有请求都会过一遍这个 SW，所以它必须精确区分"这是站点自身的请求还是容器预览的请求"（实现方式见 4.5）。
- 脚本 URL 带 `version=<version>` 查询参数，与主应用 bundle（`app/<version>`）版本一致，SW 是随应用一起发版的。
- 网络日志里 `webc_service_worker.js` 出现过两次 fetch 记录，传输体积 17KB（gzip），解压后 60KB，是一个 webpack 打包的 bundle。

SW 脚本头部的模块导出暴露了它的消息协议全貌（module 296）：

```js
exports.isWasmPipe =
  exports.isJSPipe =
  exports.SysEventTopic =
  exports.Monitor2MainTells =
  exports.Main2MonitorWorkerAsks =
  exports.Worker2FSWorkerAsks =
  exports.Main2FSWorkerAsks =
  exports.SWBroadcastEvents =
  exports.SWTopic =
  exports.SWActions =
  exports.Main2WorkerAsks =
  exports.Main2WorkerTells =
  exports.Worker2MainAsks =
  exports.Worker2MainTells =
    void 0;
```

命名直接说明这是一套多线程运行时的消息总线：Worker 之间、Worker 与主线程之间分方向定义了 Ask/Tell 两类消息，另有专门的 FS（文件系统）和 Monitor（监控/调度）通道，`isWasmPipe`/`isJSPipe` 指向进程管道（stdio）的两种实现。bundle 内含 esbuild（5 处）、wasm（9 处）字样，不含 webcontainer/stackblitz/vite 任何一处。

### 3.2 预览 iframe 的来源与属性

页面上唯一的业务 iframe：

```
src:     https://example-app.example-company.com/_i/<hash:7>/_p/3000/
allow:   cross-origin-isolated
sandbox: allow-scripts allow-forms allow-popups allow-modals
         allow-storage-access-by-user-activation allow-same-origin
尺寸:    609 x 761
```

拆解这个 URL：

- 同源（与主站同域名）。这是它和 StackBlitz 官方方案最大的差异点：同源 iframe 才能被 scope 覆盖整站的 Service Worker 拦截请求，也不需要为子域做额外的 COEP/credentials 配置。`allow-same-origin` 保证 sandbox 下主页面可以访问 `contentDocument`（代码里用于健康检查）。
- `_i/<hash:7>`：chat.js 里有 `WebCSystem.getInstanceId()` 的调用，`_i/` 后就是这个实例 ID，每个预览会话一个实例，避免多会话互相串扰。
- `_p/3000`：`_p/` 后是容器内监听的端口号。3000 是 Vite 默认端口，路径里编码端口说明运行时支持把容器内任意端口映射成同源 URL（比如项目起在 5173 时预览路径就会变成 `_p/5173/`）。chat.js 的健康检查代码里也确实在探测 `previewInfo={port, loaded, baseUrl}`。

此外性能时间线上还有一个 `/preview/snapshot?filePath=snapshot-preview/uxv8nw67987/task-...` 的 iframe 请求（服务端快照，1.2KB）。它和实时容器预览并存，推测用于列表页/分享卡片等不需要真正跑起容器的静态预览场景。

### 3.3 crossOriginIsolated 状态与响应头

```
window.crossOriginIsolated === true
typeof SharedArrayBuffer   === 'function'
cross-origin-opener-policy:     same-origin
cross-origin-embedder-policy:   credentialless
```

全站（含预览 iframe，通过 `allow="cross-origin-isolated"` 继承）处于跨源隔离状态，满足 WASM 多线程的前提。

### 3.4 网络请求中的 Vite 痕迹

预览 iframe 内共加载 36 个资源。去掉图片（CDN 上的配图、iconfont 占位图）后，同源请求全部是 Vite 开发态产物，且 transferSize 全部为 0（无真实网络传输，SW 内存直出）：

```
/@vite/client                                       Vite HMR 客户端（86KB，含 createHotContext + WebSocket）
/@react-refresh                                     react 插件刷新前导
/node_modules/vite/dist/client/env.mjs              Vite 环境注入
/node_modules/.vite/deps/react-dom_client.js?v=…    依赖预构建产物
/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=…
/node_modules/.vite/deps/@example-app-tools.js?v=…     内部工具包也被预构建
/node_modules/.vite/deps/chunk-*.js?v=…             预构建公共分包
/src/main.tsx  /src/App.tsx  /src/index.css         业务源码直出（TSX 现场转译）
/src/components/{ErrorBoundary,HeaderSection,PrizeSection,InfoSection,RegistrationForm}.tsx
```

资源清单里同时出现了 `/src/App.tsx` 和 `/_i/<hash:7>/_p/3000/src/App.tsx` 两种形态：前者是 HTML 里的绝对路径引用（iframe 内绝对路径解析到源站根，正好落进 SW 的拦截范围），后者是 Vite 模块图的相对引用。两条路径殊途同归，都被 SW 捕获。

进一步从虚拟文件系统里直接读到了 Vite 依赖预构建的清单（这个文件在真实服务器上同样不存在，等于直接验证了"浏览器内存里有一个真的 Vite 工作目录"）：

```json
{
  "hash": "35965e41",
  "browserHash": "f3f126c0",
  "optimized": {
    "react":              { "src": "../../.vite-plugin-externals/react.js", "needsInterop": true },
    "react-dom":          { "src": "../../.vite-plugin-externals/react.js", ... },
    "react/jsx-dev-runtime": { ... },
    "react/jsx-runtime":     { ... },
    "@example/example-app-tools":       { ... }
  }
}
```

`src` 指向 `.vite-plugin-externals/` 说明模板用 vite-plugin-externals 把 react 系依赖指到了项目内预置的文件，而不是真实 node_modules（生成的 HTML 里 React/moment 也是直接从 `example-cdn.com` 加载 UMD 包）。这是缩短冷启动时间的工程手法：AI 生成的新项目几乎不需要真正 npm install react。

### 3.5 网络请求中的 WebContainer / webc 痕迹

主页面（不含 CDN 静态资源）的实际请求清单里与容器直接相关的有：

```
/webc_service_worker.js?version=<version>      SW 脚本本体（fetch 记录 2 次，17KB/gzip）
/_i/<hash:7>/_p/3000/                          预览 iframe 文档（transferSize 0，SW 内存直出）
/_i/<hash:7>/_p/3000/@vite/client              主页面直接 fetch 验证用（transferSize 0）
/preview/snapshot?filePath=snapshot-preview/… 服务端快照预览（1.2KB）
/example-app/api/chat/getChatDetail?appId=uxv8nw67987  会话与生成产物元数据（22KB）
/example-app/api/user  /example-app/api/prompt/skills  /example-app/api/app/getWidgetList  /example-app/api/sunfire/queryLatest
```

`webc` 一词的完整定义出现在主应用 chat.js（992KB）里，是一个内嵌的配置对象：

```js
worker_scripts_names: {
  process_worker:     `webc_worker`,
  process_lite_worker:`webc_lite_worker`,
  service_worker:     `webc_service_worker`,
  io_worker:          `webc_io_worker`,
  monitor_worker:     `webc_monitor_worker`
},
webc_named_packages: {
  bash:      { name:`wasm-bash`,      version:`1.0.0`  },
  git:       { name:`wasm-git`,       version:`1.0.0`  },
  core_utils:{ name:`wasm-coreutils`, version:`1.0.0`  },
  npm_tools: { name:`wasm-npm-tools`, version:`1.0.3`  },
  webc_sys:  { name:`wasm-webc-sys`,  version:`1.2.19` }
},
cors_proxy: `https://webc-net-helper.example-company.com/cors/`,
ws_proxy:   `https://webc-net-helper.example-company.com`
```

同一段代码里的 SW 注册逻辑，采取"先注销再注册"的强制升级策略（保证发版后 SW 立即换新，不走 waiting 队列）：

```js
let regs = await navigator.serviceWorker.getRegistrations();
for (let r of regs)
  if (r.active.scriptURL === WebCSystem.getServiceWorkerUrl())
    await r.unregister();
let reg = await navigator.serviceWorker.register(
  WebCSystem.getServiceWorkerUrl(),
);
// watching statechange, console.log(`[SW]`, `statechange:`, state)
```

预览健康检查代码（chat.js 中的原文，中文报错）明确使用了 WebContainer 这个词：

```js
// `预览区域加载超时：未检测到预览服务，WebContainer 可能未启动，
//   或前置启动命令未监听端口（previewInfo={port:.., loaded:.., baseUrl:..}）`
// `预览区域加载超时：预览 URL 未生成，WebContainer 端口未监听（...）`
// `iframe contentDocument 访问抛出异常，可能跨域隔离 - ...`
```

健康检查依次验证：容器是否启动、启动命令是否监听了端口、主预览 iframe（`#example-app-preview`）与副预览（`#example-app-preview-alt`）是否挂载、contentDocument 是否可访问、body 是否渲染出子节点。这套文案就是产品侧对容器生命周期的直接观测。

### 3.6 控制台日志证据

页面控制台里留下三条关键日志：

1. 容器内的 shell 是 WASM 实现的，bootstrap 脚本以 blob URL 形式注入：

```
run wasm /bin/bash Array(3)   @ blob:https://example-app.example-company.com/0c93da8a-…:0
run wasm /bin/sh   Array(3)   @ blob:https://example-app.example-company.com/0c93da8a-…:0
```

2. 文件写入通道：主应用 chat.js 的 FilesStore 在 AI 产出每个文件时打日志：

```
[INFO] FilesStore  File updated   @ app/<version>/chat.js:6   （重复 20+ 次）
```

3. Vite HMR 的 WebSocket 连接失败，错误信息把整个链路打印了出来：

```
[vite] failed to connect to websocket.
your current setup:
  (browser) example-app.example-company.com/_i/<hash:7>/_p/3000/ <--[HTTP]-->  localhost:3000/ (server)
  (browser) example-app.example-company.com:/                   <--[WebSocket (failing)]--> localhost:3000/ (server)
```

这条日志把架构讲得一清二楚：容器内的 Vite 认为自己运行在 `localhost:3000`；HTTP 请求经过 SW 桥接全部正常；而 WebSocket 无法被 SW 拦截，浏览器直连 `localhost:3000` 又没有真监听，于是 HMR 推送通道断了。页面仍然能正常更新，是因为文件改动走的是 FilesStore 全量写盘后重载（或其他 fallback），而非 Vite 原生 HMR。

### 3.7 被生成的应用本体

预览 iframe 的 HTML（1743 字节）能看出产品模板的完整约定：

```html
<script>
  /* example-app 注入：捕获 error/unhandledrejection，
            postMessage({namespace:"example-app", action:"tools_post_error", …}) 上报给宿主页 */
</script>
<script type="module">
  import { injectIntoGlobalHook } from "/@react-refresh"; …
</script>
<script type="module" src="/@vite/client"></script>
<meta name="generator" content="AI-generated; human-reviewed" />
<meta name="template" content="Vite + React + TypeScript" />
<title>创意站点</title>
<script src="https://example-cdn.com/code/lib/react/18.3.1/umd/react.development.js"></script>
<script src="https://example-cdn.com/code/lib/moment.js/2.29.0/moment.min.js"></script>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

- 模板官方名称就是 "Vite + React + TypeScript"，AI 产出物带 `AI-generated; human-reviewed` 标记。
- example-app 在生成的 HTML 头部注入了一个错误采集脚本，把预览页的运行时异常通过 postMessage（`namespace: "example-app"`）回传宿主页面，供 AI 迭代修复。
- React、moment 用 CDN UMD 直引，业务代码走 Vite dev 通道，进一步压缩容器冷启动要做的事。

iframe 内的 `fetch` 已被运行时接管（非原生函数），XHR 和 WebSocket 保持原生。

## 四、webc 运行时的落地实现分析

### 4.1 整体架构

把所有实测证据拼起来，example-app 的浏览器内运行时是这样一层层搭起来的：

```
┌─ 浏览器标签页 ────────────────────────────────────────────----──-┐
│  example-app 主应用 (React, app@<version>, rolldown-vite 构建)   │
│    WebCSystem 客户端: 实例管理 / FilesStore 写盘 / 健康检查      │
│    Monaco Editor (0.52.2) 代码面板, Shiki 高亮                   │
│        │ navigator.serviceWorker.register(webc_service_worker)   |
│        │ postMessage 协议 (namespace:"example-app")              │
│        V                                                         │
│  Service Worker: webc_service_worker.js v<version> (scope 整站)  │
│    消息总线: SWTopic/SWActions, Worker2MainAsks/Tells,           │
│             Main2FSWorkerAsks, Monitor2MainTells,                │
│             isWasmPipe/isJSPipe                                  │
│    职责: 把 /_i/{instanceId}/_p/{port}/** 的请求交给容器 FS      │
│        │                                                         │
│        V                                                         │
│  Worker 群（blob: URL 注入）:                                    │
│    webc_worker          进程执行（bash/sh 由此跑起）             │
│    webc_lite_worker     轻量进程                                 │
│    webc_io_worker       文件系统 IO                              │
│    webc_monitor_worker  调度/监控（对应 Monitor2Main 消息）      │
│        │                                                         │
│        V                                                         │
│  WASM 用户态: wasm-webc-sys + wasm-bash + wasm-git +             │
│               wasm-coreutils + wasm-npm-tools                    │
│    内置 esbuild；页面 crossOriginIsolated，SharedArrayBuffer     │
│    可用于 WASM 线程与进程管道                                    │
│        │                                                         │
│        V                                                         │
│  容器内进程: npm/vite dev → 监听 localhost:3000                 │
└──────────────────────────────────────────────────────────────----┘
         │ HTTP（被 SW 拦截，内存直出）
         V
  预览 iframe: /_i/<hash:7>/_p/3000/  （同源, sandbox+COI）
         容器内运行的 Vite + React + TS 应用
         │ 跨域依赖走 cors_proxy / ws_proxy
         V
  webc-net-helper.example-company.com  （独立代理服务）
```

### 4.2 WASM 组件包

chat.js 配置里的五个 `wasm-*` 包对应运行时的用户态：

- `wasm-webc-sys`（1.2.19）：系统调用层，其余组件的地基。
- `wasm-bash` + `wasm-coreutils`：控制台里 `run wasm /bin/bash` 的来源，容器内可以执行 shell 命令和常用 GNU 工具。
- `wasm-git`：容器内有 git，推测用于版本管理或回滚生成结果。
- `wasm-npm-tools`：npm 的最小实现，配合 cors_proxy 从 registry 拉包。

### 4.3 网络层：为什么需要一个独立代理域名

Service Worker 只能拦同源 HTTP，容器里跑的程序却要访问外部世界（npm registry 等）。example-app 的解法是自建 `webc-net-helper.example-company.com`：

- `cors_proxy: https://webc-net-helper.example-company.com/cors/`：容器内的外网请求改写到这个代理上，由服务端转发，绕开浏览器 CORS。
- `ws_proxy: https://webc-net-helper.example-company.com`：WebSocket 代理。SW 拦不住 WS，需要出网的 WS 连接经这个代理中转。

这也解释了控制台里 HMR 连 `localhost:3000` 失败的原因：容器进程内部的"localhost"没有对应的真实网络出口，而 SW 对 WS 无能为力。外网走代理、容器内端口走 SW 拦截，是这个设计里两条不同的网络通道。

### 4.4 请求分发：SW 如何区分站点请求和容器请求

scope 是整站的 SW 拦截了所有请求，必须有个明确的分界。从实测看分界规则相当清晰：

- `/example-app/api/**`：真实后端 API，SW 直接放行透传（transferSize 非 0，有真实传输）。
- `/_i/{instanceId}/_p/{port}/**`：容器预览路径，交给运行时从虚拟 FS 取数（transferSize 0）。instanceId 保证多会话、多应用互不污染。
- 其余（`/chat/…`、静态资源、CDN）：站点自身资源，正常放行。

把端口编码进 URL 路径（`_p/3000`）而不是用子域名，是同源方案的必然选择：同源下无法按端口/域名区分路由，只能靠路径。这也是它和 StackBlitz `*.webcontainer.io` 子域方案在 URL 形态上最直观的差别。

### 4.5 端到端流程还原

把一次"对话到预览"的完整链路按实测证据还原：

1. 用户在 `/chat/uxv8nw67987` 发起对话，主应用通过 `/example-app/api/chat/getChatDetail` 拉取会话，AI 流式产出项目文件。
2. chat.js 的 FilesStore 逐个落盘（对应控制台大量 "File updated"），写入容器虚拟 FS。
3. WebCSystem 启动容器：注册/刷新 SW，拉起 `webc_worker` 等 Worker 与 WASM 用户态，控制台可见 `run wasm /bin/bash`。
4. 容器内执行启动命令（bash 跑 npm/vite），Vite dev server 在容器内监听 3000 端口，产出 `_metadata.json` 与预构建依赖。
5. 健康检查轮询 `previewInfo={port, loaded, baseUrl}`，确认端口监听后渲染 iframe `/_i/<hash:7>/_p/3000/`。
6. iframe 加载 HTML，Vite client 注入；所有 `/@vite/client`、`/src/*.tsx`、`.vite/deps` 请求被 SW 拦截、由容器内存应答，页面渲染完成。
7. 页面运行时异常经注入的错误上报脚本 postMessage 回主应用，可反哺 AI 修复。

### 4.6 与 StackBlitz 官方 WebContainer 的对比

| 维度           | StackBlitz @webcontainer/api        | example-app webc（自研）                                 |
| -------------- | ----------------------------------- | -------------------------------------------------------- |
| 预览 iframe 源 | `*.webcontainer.io` 独立子域        | 同源路径 `/_i/{instanceId}/_p/{port}/`                   |
| 运行时实现     | jsh 运行时（SW + iframe 内 worker） | 5 个专职 Worker + 5 个 wasm 包，自带 bash/git/coreutils  |
| 外网访问       | 浏览器 fetch 桥接                   | 自建代理域 webc-net-helper（cors_proxy + ws_proxy）      |
| 驱动 API       | boot/mount/spawn 标准化接口         | WebCSystem 私有协议（postMessage + SW 消息总线）         |
| HMR            | 官方会补丁 iframe 内 WebSocket      | 未补丁，原生 WS 直连 localhost:3000 失败，靠文件重载兜底 |
| 依赖安装       | 容器内真实 npm                      | vite-plugin-externals 预置 react + CDN UMD，尽量不装包   |

## 五、完整技术栈清单

主应用（example-app 站点本身）：

- 构建：Vite 系 rolldown-vite（`rolldown-runtime.js`、`__vite__mapDeps`），产物发布在 example-cdn.com `mux-react-components/app/<version>`。
- 框架与 UI：React 18、UnoCSS（`__uno.css`）、Shiki（语法高亮，vendor-shiki）、JSZip（vendor-jszip）。
- 编辑器：Monaco Editor 0.52.2（editor.main + html/javascript 语言服务）。
- 关键业务 chunk：chat.js（992KB，AI 会话 + FilesStore + WebCSystem）、IframePreview.js、debugPreview.js、publish.js、ShowCase.js、ReviewView.js、useLoginFinish.js 等。

容器运行时（webc，自研）：

- Service Worker：webc_service_worker.js v<version>，整站 scope，webpack bundle，60KB。
- Worker 群：webc_worker、webc_lite_worker、webc_io_worker、webc_monitor_worker。
- WASM 包：wasm-webc-sys 1.2.19、wasm-bash 1.0.0、wasm-git 1.0.0、wasm-coreutils 1.0.0、wasm-npm-tools 1.0.3；内置 esbuild。
- 网络代理：webc-net-helper.example-company.com（cors_proxy + ws_proxy）。
- 平台前提：COOP same-origin + COEP credentialless → crossOriginIsolated → SharedArrayBuffer。

容器内应用（AI 生成的项目）：

- 模板：Vite + React + TypeScript（meta 明示），React 18.3.1。
- 依赖策略：react 系走 vite-plugin-externals 与 example-cdn.com UMD，业务依赖经 `.vite/deps` 预构建。
- 运行形态：Vite dev server（监听 3000），HMR WebSocket 断开，依赖写盘后刷新。

## 六、调研局限与未验证项

- wasm 包的实际下载来源（推断为 CDN 或代理域）未抓到直接请求记录，容器启动瞬间的 Worker/wasm 资源多以 blob URL 出现。
- Vite 精确版本号未读取到（dev client 不含版本常量），仅能确认 `env.mjs` 等特征属于 Vite 4+ 的现代形态。
- 文件更新后预览的刷新机制（整体 reload 还是局部模块失效）未做实验验证，只确认了原生 HMR 的 WS 通道是断的。
- `webc_service_worker.js` 内部的枚举常量（SWTopic/SWActions 具体取值）未能完整提取，仅拿到导出的协议符号名。
- 以上均为只读取证（读注册表、读资源清单、fetch 脚本文本），未对页面状态做任何修改。

# swifty-codegen 技术栈调研报告

- 调研对象: /Users/hangtiancheng/github/swifty-codegen（本地代码库，pnpm monorepo：client + server）
- 调研时间: 2026-09-02
- 调研方式: 直接阅读源码与配置（package.json、vite.config.ts、prisma schema、服务端模块与关键路由、客户端 workspace 与 WebContainer 接入代码），所有结论均来自仓库内实际文件。

## 一、项目概览

swifty-codegen 是一个 AI 代码生成平台：用户在对话页输入需求，服务端驱动编码 Agent 生成一个前端项目，客户端在浏览器内的 WebContainer 里装依赖、启动 Vite dev server 并实时预览。产品形态与 example-app 同类，但技术选型完全开源自托管，且 Agent 侧做得更重。

仓库结构：

```
swifty-codegen/
├── client/          Vite + React 19 SPA（含 WebContainer 工作台）
├── server/          Hono 后端（AI Agent 运行时 + 业务 API）
│   ├── prisma/      Prisma 7 schema 与迁移
│   ├── prompts/     site-generator-system-prompt.md
│   └── src/         agent-runtime / routes / session / deployment ...
├── sql/             mysql.sql + postgres.sql（建表脚本）
├── .swifty/         开发本仓库所用的 agent harness 状态（tasks/plans/memory/sessions）
├── .mcp.json        codegraph MCP 配置
└── AGENTS.md        前后端 API 契约清单（逐条标注对齐状态）
```

根目录只有一个 `concurrently` 依赖，所有脚本都是 `pnpm --filter client/server ...` 的转发，dev/test/build/lint 四类命令并行跑两端。

## 二、总体架构

```
┌─ client (Vite SPA, 静态部署) ────────────────────────────--────┐
│  React 19 + Tailwind 4 + TanStack Query/Form/Virtual           │
│  会话页: 聊天面板 + Agent 转写 + 权限弹窗 + 能力抽屉           │
│  工作台: 文件树 + Monaco 编辑器 + xterm 终端 + 预览面板        │
│                                                                │
│  ┌─ WebContainer (@webcontainer/api 1.6.4, 官方 SDK) ────--─┐  │
│  │  boot(coep: credentialless, forwardPreviewErrors)        │  │
│  │  mount(服务端下发的文件树) → npm install → npm run dev │  │
│  │  server-ready 事件 → 预览 iframe 加载容器内 Vite        │  │
│  └──────────────────────────────────────────────────────--──┘  │
└──────────────┬──────────────────────────────┬────────────---───┘
   原生 WebSocket (agent 事件/审批)    HTTP (REST API / 文件树 / 下载)
               V                              V
┌─ server (Hono 4 + Node) ────────────────────────────────────┐
│  agent-runtime: @swifty.js/swifty 的 Agent 编排层           │
│    (会话/工具/MCP/hooks/skills/subagent/team/memory/git)    │
│  业务模块: user / app / chat-history / admin / management   │
│  中间件: 会话认证(Cookie+Redis) / 限流 / CORS / 安全头      │
│  存储: PostgreSQL(Prisma 7) + Redis(ioredis) + MinIO/本地   │
│  LLM: @swifty.js/swifty ProviderConfig (anthropic/openai/   │
│       openai-compat 三协议, 默认 Ollama qwen3.5)            │
└─────────────────────────────────────────────────────────────┘
```

## 三、客户端技术栈

### 3.1 基础框架

- 构建：Vite 7（`tsc -b && vite build`），@vitejs/plugin-react，TypeScript 5.8，路径别名 `@` 指向 src。
- 框架：React 19.2 + react-dom，react-router 7（data router），页面切换用 react-transition-group + animate.css + GSAP 做过渡动画。
- 样式：Tailwind CSS 4（@tailwindcss/vite 插件）+ tw-animate-css，组件层用 clsx + tailwind-merge + class-variance-authority 的 shadcn 风格封装，图标用 lucide-react，toast 用 sonner。
- 状态与数据：服务端状态走 TanStack Query 5，表单用 TanStack Form，长列表虚拟化用 TanStack Virtual，本地状态用 zustand，校验统一 zod 4。
- 渲染：聊天内容用 marked 转 Markdown + DOMPurify 消毒。
- 构建优化：vite.config.ts 里按 manualChunks 手工分包（vendor-react / vendor-tanstack / vendor-markdown / vendor-icons / vendor-motion / vendor-core）。
- 监控：@swifty.js/sentry 0.0.7，通过其 vite 插件注入（dsn 指向 `/sentry`）。

### 3.2 WebContainer 接入（官方 SDK）

客户端用的是 StackBlitz 官方 `@webcontainer/api` 1.6.4，接入是教科书式的三段式：

- 启动（client/src/shared/webcontainer/boot.ts）：进程级单例 `getWebContainer()`，boot 参数 `coep: "credentialless"`、`forwardPreviewErrors: true`（预览页运行时错误自动回传宿主）、`workdirName: "project"`；boot 前先检查 `globalThis.crossOriginIsolated`，不满足直接报错提示开启 COOP/COEP。
- vite.config.ts 在 dev 和 preview 两个模式下都注入 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`，和 example-app 的响应头组合完全一致。
- 运行（workspace/webcontainer-runtime.ts）：`mount(服务端文件树)` → 比较 package.json 内容哈希并检查 node_modules 是否存在，只在必要时 `spawn("npm", ["install"])` → `spawn("npm", ["run", "dev", "--", "--host", "0.0.0.0"])` 起 Vite → 监听 `server-ready` 事件拿到预览 URL。所有文件系统操作（mount、清目录、保存、Agent 同步）经过一个全局 promise 队列串行化，避免交叉写入；进程输出 pipeTo 收集日志并截断在 12KB。
- 配套模块：webcontainer-fs.ts（容器内 FS 读写）、webcontainer-terminal.ts（把 xterm 接到容器 shell）、file-tree.schema.ts（与服务端共享的文件树 zod schema）。

与 example-app 的根本差异在这里就出现了：swifty 用官方 SDK，预览 iframe 由 SDK 管理在其自己的源上，SDK 内部解决网络桥接（包括 HMR）；example-app 是自研运行时，靠同源 Service Worker 劫持请求。

### 3.3 工作台与 AI 会话 UI

app-chat 页面是一个完整的 AI IDE 工作台：

- workspace：file-explorer（文件树）、code-editor-panel（Monaco 0.56，monaco-loader/monaco-workers 处理按需加载与 worker）、workspace-terminal（xterm 6 + fit 插件）、workspace-panel（react-resizable-panels 分栏）、workspace-tree/paths/controller 等模块。
- 会话侧：chat-pane、agent-transcript-view（事件转写）、agent-status-bar、agent-composer（斜杠命令候选，服务端下发 candidates）、permission-dialog（工具调用审批）、capability-drawer（MCP/skills/teams 能力面板）。
- 视觉编辑：use-visual-editor.ts + visual-edit-script.js，向预览 iframe 注入脚本支持点选元素改样式，是低代码式的二次编辑通道。
- 错误闭环：preview-error-panel + use-preview-errors + build-error-context.ts，把容器/构建错误结构化后回传给 Agent 迭代修复（配合 SDK 的 forwardPreviewErrors）。

### 3.4 客户端与服务端的通信

- Agent 主通道：原生 WebSocket（use-agent-socket.ts 里 `new WebSocket(buildAgentSocketUrl(appId))`，服务端经 @hono/node-ws 的 upgradeWebSocket 接入），承载会话事件流、转写回放（断线后按 event sequence 补发 backlog）、权限/问题应答、命令候选。
- REST：axios 封装的 http-client（信封解包 decode-envelope、401 统一跳转 unauthorized-handler），API 清单见 AGENTS.md（用户/应用/聊天记录/管理端/文件树/zip 下载）。
- 历史遗留：package.json 里声明了 @microsoft/fetch-event-source 与 socket.io-client，但当前 Agent 通道用的是原生 WebSocket，服务端也没有 SSE 路由（无 streamSSE），endpoints.ts 里还留有 `chatStream: "app/chat/codegen"`，对应的 chat-stream-url.ts 文件已被删除。这两者应是从早期"单次 SSE 生成"方案迁移到 Agent 方案后的残留。

## 四、服务端技术栈

### 4.1 Web 框架与中间件

- Hono 4.13 + @hono/node-server + @hono/node-ws（原生 WebSocket 升级），@hono/zod-validator 做入参校验，zod 4 全量校验。
- 所有路由挂在 `/${BASE_URL}`（默认 `api`）下：health、user（注册/登录/登出/会话）、app（CRUD/分页/精选/admin）、chat-history、agent（能力/MCP/文件/WS）、management（Prometheus 指标/health/info）。
- 会话：Cookie（swifty_codegen_session）+ 服务端会话存储，生产环境强制要求 Redis（redis-session-store，ioredis），TTL 默认 7 天。
- 安全：security-middleware、CORS 白名单（生产禁通配符）、请求体大小限制、AES-256-GCM 加密 MCP 凭据（mcp-crypto + MCP_SECRET_KEY）、密码加盐哈希（PASSWORD_SALT）。env.schema.ts 用 superRefine 在生产环境下硬校验默认密钥/Redis/存储配置，防呆做得比较足。
- 限流：独立 rate-limit 模块，Redis 存储，默认对 LLM 调用 10 次/分钟。
- 可观测：metrics-service 暴露 Prometheus 指标，health-service 做健康聚合（含模型提供方健康检查，默认开启、5 秒超时），request-context 贯穿请求链路。

### 4.2 数据层

- PostgreSQL + Prisma 7：新的 `prisma-client` 生成器（产物输出到 src/generated/prisma），`@prisma/adapter-pg` 驱动适配器直连 pg。
- 数据模型除常规 User/App 外，核心是 Agent 系列表，把 Agent 运行时状态完整持久化：
  - AgentWorkspace：用户×应用的 Agent 工作区，记权限模式（DEFAULT/ACCEPT_EDITS/PLAN/DONT_ASK/BYPASS_PERMISSIONS，与主流编码 CLI 的权限模式一一对应）、sandbox/memory/hooks 开关、每工作区模型覆盖（modelOverride）。
  - AgentSession：会话状态机（IDLE/RUNNING/WAITING/COMPLETED/ABORTED/FAILED）、context JSON、lastEventSequence（事件序号，断线补发的依据）。
  - AgentTranscriptEvent：逐事件转写（sessionId+sequence 唯一），支持回放与审计。
  - AgentInteraction：权限/问题两类交互的审批流（PENDING/ANSWERED/REJECTED/EXPIRED/CANCELLED，带过期时间）。
  - AgentMcpServer：MCP 服务器配置（STDIO/HTTP/SSE 三种 transport，headers/env 加密存储，连接状态跟踪）。
  - AgentHook：hooks 配置（事件、matcher、命令、超时）。
- sql/ 目录保留了 mysql.sql 与 postgres.sql 两份建表脚本，Prisma schema 的命名风格（userAccount/isDelete @@map）沿用了常见 Java 系后台规范。

### 4.3 Agent 运行时（server/src/agent-runtime）

这是项目最有分量的部分，共 22 个文件，是 `@swifty.js/swifty` 之上的完整编排层。按你的说明，`@swifty.js/swifty` 可以理解为和 LLM 交互的封装包，为 LLM 提供 tools 等能力；swifty-codegen 在它之上做了产品化：

- 从 SDK 引入的能力（按实际 import 统计）：ConversationManager、createClient、ProviderConfig（provider.ts 组装 api_key/base_url/model/protocol/context_window/max_output_tokens）；MCPManager + MCPServerConfig；MemoryManager；TeamManager；HookConfig；AgentEvent 与 contentToText（事件流适配）；createDefaultRegistry + loadUserCommands + parse（斜杠命令注册表与解析）；AgentDefinition + loadAgentDefinitions（子 Agent 定义）；createAgentWorktree / removeAgentWorktree（git worktree 隔离执行）；Decision（审批决策类型）。
- server 自建部分：runtime-manager（工作区生命周期，空闲 15 分钟回收，workspace-lock 防并发）、interaction-broker（审批/提问的请求-应答协议）、event-adapter（SDK 事件到 WS 消息的转换）、stores（转写与会话持久化）、command-dispatcher（命令候选下发）、skill-runtime / subagent-runtime / team-runtime / mcp-runtime / hook-runtime / memory-runtime（六类运行时开关，均可在工作区粒度配置）、git-runtime（每次改动打 git 快照，作者默认 "Swifty Agent"）、project-files（工作区文件读写，供 /api/app/files 下发文件树）。
- Agent 提示词在 server/prompts/site-generator-system-prompt.md，生成目标即"可被 Vite 跑起来的前端项目"。

### 4.4 存储与交付

- 部署产物：deployment 模块抽象了 storage-adapter，支持 local 与 minio 两种驱动（MinIO bucket 默认 swifty-codegen），生产环境强制不允许 local；用于应用构建产物的对象存储。
- 源码下载：project-download + archiver 打 zip，对应 GET /api/app/download/:appId。
- 开发态文件树：server 侧维护项目文件（agent 写入），客户端通过 /api/app/files/:appId 拉取 FileSystemTree 挂进 WebContainer。

### 4.5 LLM 接入

- 三协议可配：AI_PROTOCOL ∈ anthropic / openai / openai-compat，默认 openai-compat；默认 base_url 指向 `http://localhost:11434/v1`（Ollama），默认模型 `qwen3.5`，AI_MAX_ITERATIONS 默认 40（Agent 最大迭代轮数）。
- Provider 健康检查可配置开关与超时；LLM 调用独立限流（默认 10 req/min）。
- 与 example-app 的对比：example-app 的模型接入藏在内部 API 之后不可见；swifty-codegen 是协议级的模型无关设计，本地 Ollama 即可跑通全流程。

## 五、工程化

- Monorepo：pnpm workspace + concurrently 并行脚本；两端各自独立 lint/format/test。
- 代码质量：client 用 ESLint 9（typescript-eslint、react-hooks、react-refresh、unicorn）+ Prettier（含 prettier-plugin-tailwindcss）；server 用 Biome（format/check/CI reporter）——一端 ESLint 一端 Biome 的混合分工。
- 测试：两端统一 vitest（client/tests、server/tests）。
- 服务端构建：rollup 打包 dist（commonjs/json/node-resolve/typescript 插件），dev 用 tsx watch；Prisma migrate 三件套（dev/reset/deploy）。
- 环境配置：zod schema 校验 + 生产环境硬校验（禁止默认密钥、通配 CORS、local 存储、缺 Redis）。
- Agent 辅助开发：仓库自带 .swifty/（tasks/plans/memory/sessions/file-history）与 .mcp.json（codegraph），即本仓库本身也是用 swifty agent harness 开发的；AGENTS.md 是一份逐条标注对齐状态的前后端 API 契约文档。
- Node 版本：client devDeps 带 @types/node 24，server 带 @types/node 20。

## 六、与 example-app 的技术栈差异对比

两者是同一赛道的两个实现：AI 对话生成 Web 应用 + 浏览器内 WebContainer 预览。相同的选型：React + Monaco + Vite dev server 跑在容器里、COOP same-origin + COEP credentialless 换 crossOriginIsolated + SharedArrayBuffer、把预览页错误回传宿主形成修复闭环、文件树从服务端下发。分歧集中在四个层面：

| 维度         | example-app                                                                                                                                                   | swifty-codegen                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| WebContainer | 自研 "webc" 运行时：同源 SW 劫持请求（/\_i/{id}/\_p/{port}/）、5 个 Worker、5 个 wasm 包（bash/git/coreutils/npm-tools/webc-sys）、自建代理域 webc-net-helper | 官方 @webcontainer/api 1.6.4：boot/mount/spawn 标准链路，SDK 管理预览 iframe 与网络桥接                                               |
| 代码生成引擎 | 服务端内部实现，客户端只见 FilesStore 写盘日志；对话走内部 HTTP API                                                                                           | 服务端完整 Agent 运行时：@swifty.js/swifty 提供 tools/MCP/hooks/skills/subagent/team/memory，斜杠命令、权限审批、git 快照、转写持久化 |
| Agent 传输   | 内部 API（HTTP）+ 容器内 postMessage 错误上报                                                                                                                 | 原生 WebSocket 双向协议 + REST（断线按事件序号补 backlog）                                                                            |
| HMR          | 同源 SW 方案下 WS 无法拦截，HMR 断开，靠写盘刷新兜底                                                                                                          | 官方 SDK 桥接，HMR 可用，且支持 server-ready/reloadPreview                                                                            |
| 后端栈       | 内部基建：登录、前端监控、内部 API 网关                                                                                                                       | 开源自托管：Hono 4 + Prisma 7/PostgreSQL + Redis + MinIO + Prometheus                                                                 |
| 模型接入     | 不可见（内部封装）                                                                                                                                            | 协议级三选一（anthropic/openai/openai-compat），默认 Ollama qwen3.5，可按工作区覆盖模型                                               |
| 依赖安装策略 | vite-plugin-externals 预置 react + CDN UMD，基本不跑 npm install                                                                                              | 容器内真实 npm install，按 package.json 哈希增量跳过                                                                                  |
| 前端栈细节   | React 18 + rolldown-vite 构建 + UnoCSS + Shiki                                                                                                                | React 19 + Vite 7 + Tailwind 4 + TanStack 全家桶 + zustand                                                                            |
| 数据与持久化 | 内部服务端存储，另有服务端快照预览（/preview/snapshot）                                                                                                       | Prisma/PG 全量建模（含 Agent 状态机），产物上 MinIO，源码可 zip 下载                                                                  |
| 可观测       | 内部监控全家桶                                                                                                                                                | 自建 Prometheus 指标 + health + @swifty.js/sentry                                                                                     |

一句话概括：example-app 靠内部基建把"容器运行时"做重（自研 webc 换来同源 iframe 的低摩擦加载，代价是 HMR 断链），swifty-codegen 把"Agent 工程"做重（官方容器 + 自研 Agent 编排层 + 全量状态持久化，换来可自托管、可换模型、HMR 完整）。

## 七、观察与未验证项

- socket.io-client、@microsoft/fetch-event-source、GSAP 等依赖已声明但在当前主链路中未见使用，疑似历史方案残留（Agent 通道为原生 WebSocket，SSE 生成路径已移除）。
- AGENTS.md 契约文档与实际代码有轻微漂移（chat-stream-url.ts 已删除，但 endpoints.ts 仍保留 chatStream 条目）。
- 未运行项目验证端到端行为，WebContainer boot、Agent 会话与 MinIO 部署链路均基于代码阅读推断为"按上述方式工作"。
- sql/mysql.sql 与 Prisma schema 的同步状态未核对，推测 postgres.sql 为当前主用方言。
