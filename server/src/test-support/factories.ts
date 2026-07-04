import { faker } from "@faker-js/faker";
import { ChatMessageType, CodegenType, UserRole } from "../generated/prisma/enums.js";
import type { AppModel } from "../generated/prisma/models/App.js";
import type { ChatHistoryModel } from "../generated/prisma/models/ChatHistory.js";
import type { UserModel } from "../generated/prisma/models/User.js";

const nextId = (): bigint => BigInt(faker.number.int({ max: 1_000_000, min: 1 }));

export const buildUser = (overrides: Partial<UserModel> = {}): UserModel => {
  const now = faker.date.recent();
  return {
    createTime: now,
    editTime: now,
    id: nextId(),
    isDelete: false,
    updateTime: now,
    userAccount: faker.internet.username().toLowerCase(),
    userAvatar: null,
    username: faker.person.firstName(),
    userPassword: faker.internet.password({ length: 32 }),
    userProfile: null,
    userRole: UserRole.USER,
    ...overrides,
  };
};

export const buildApp = (overrides: Partial<AppModel> = {}): AppModel => {
  const now = faker.date.recent();
  return {
    appCover: null,
    appName: faker.company.name(),
    codegenType: CodegenType.MULTI_FILES,
    createTime: now,
    deployKey: null,
    deployTime: null,
    editTime: now,
    id: nextId(),
    initPrompt: faker.lorem.sentence(),
    isDelete: false,
    priority: 0,
    updateTime: now,
    userId: nextId(),
    ...overrides,
  };
};

export const buildChatHistory = (overrides: Partial<ChatHistoryModel> = {}): ChatHistoryModel => {
  const now = faker.date.recent();
  return {
    appId: nextId(),
    createTime: now,
    id: nextId(),
    isDelete: false,
    message: faker.lorem.paragraph(),
    messageType: ChatMessageType.USER,
    updateTime: now,
    userId: nextId(),
    ...overrides,
  };
};
