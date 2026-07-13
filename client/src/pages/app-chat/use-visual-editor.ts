import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  visualEditorIncomingMessageSchema,
  type VisualEditorElementInfo,
} from "@/shared/schemas";
import editScriptSource from "./visual-edit-script.js?raw";

const SCRIPT_ID = "visual-edit-script";
const INJECT_DELAY_MS = 300;
const IFRAME_LOAD_DELAY_MS = 500;

export type VisualEditorState = {
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly editMode: boolean;
  readonly selectedElement: VisualEditorElementInfo | undefined;
  readonly toggleEditMode: () => void;
  readonly exitEditMode: () => void;
  readonly clearSelection: () => void;
  readonly handleIframeLoad: () => void;
};

export function useVisualEditor(): VisualEditorState {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedElement, setSelectedElement] =
    useState<VisualEditorElementInfo>();
  const editModeRef = useRef(false);

  const postToIframe = useCallback((message: object): void => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const injectEditScript = useCallback((): void => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let retries = 0;
    const maxRetries = 50;

    const attempt = (): void => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) {
          if (retries++ < maxRetries) setTimeout(attempt, 100);
          return;
        }

        if (doc.getElementById(SCRIPT_ID)) {
          win.postMessage({ type: "TOGGLE_EDIT_MODE", editMode: true }, "*");
          return;
        }

        const script = doc.createElement("script");
        script.id = SCRIPT_ID;
        script.textContent = editScriptSource;
        doc.head.appendChild(script);
      } catch {
        if (retries++ < maxRetries) setTimeout(attempt, 100);
      }
    };

    attempt();
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(undefined);
    postToIframe({ type: "CLEAR_SELECTION" });
  }, [postToIframe]);

  const exitEditMode = useCallback(() => {
    editModeRef.current = false;
    setEditMode(false);
    setSelectedElement(undefined);
    postToIframe({ type: "TOGGLE_EDIT_MODE", editMode: false });
    postToIframe({ type: "CLEAR_ALL_EFFECTS" });
  }, [postToIframe]);

  const toggleEditMode = useCallback(() => {
    setEditMode((current) => {
      const next = !current;
      editModeRef.current = next;
      if (next) {
        setTimeout(() => {
          injectEditScript();
        }, INJECT_DELAY_MS);
      } else {
        setSelectedElement(undefined);
        postToIframe({ type: "TOGGLE_EDIT_MODE", editMode: false });
        postToIframe({ type: "CLEAR_ALL_EFFECTS" });
      }
      return next;
    });
  }, [injectEditScript, postToIframe]);

  const handleIframeLoad = useCallback(() => {
    if (editModeRef.current) {
      setTimeout(() => {
        injectEditScript();
      }, IFRAME_LOAD_DELAY_MS);
    } else {
      postToIframe({ type: "CLEAR_ALL_EFFECTS" });
    }
  }, [injectEditScript, postToIframe]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>): void => {
      const result = visualEditorIncomingMessageSchema.safeParse(event.data);
      if (!result.success) return;
      if (result.data.type === "ELEMENT_SELECTED") {
        setSelectedElement(result.data.elementInfo);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return {
    iframeRef,
    editMode,
    selectedElement,
    toggleEditMode,
    exitEditMode,
    clearSelection,
    handleIframeLoad,
  };
}
