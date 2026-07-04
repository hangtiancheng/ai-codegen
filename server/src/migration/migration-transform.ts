import { ChatMessageType, CodegenType, UserRole } from "../generated/prisma/enums.js";
import {
  legacySnapshotSchema,
  type MigrationSnapshot,
  migrationSnapshotSchema,
} from "./migration-schemas.js";

const normalizeUserRole = (value: string): UserRole => {
  switch (value) {
    case "admin":
    case "ADMIN":
      return UserRole.ADMIN;
    case "user":
    case "USER":
      return UserRole.USER;
    default:
      throw new Error(`Unsupported user role: ${value}`);
  }
};

const normalizeCodegenType = (value: string): CodegenType => {
  switch (value) {
    case "VANILLA_HTML":
      return CodegenType.VANILLA_HTML;
    case "MULTI_FILES":
      return CodegenType.MULTI_FILES;
    case "VITE_PROJECT":
      return CodegenType.VITE_PROJECT;
    default:
      throw new Error(`Unsupported codegen type: ${value}`);
  }
};

const normalizeMessageType = (value: string): ChatMessageType => {
  switch (value) {
    case "ai":
    case "AI":
      return ChatMessageType.AI;
    case "user":
    case "USER":
      return ChatMessageType.USER;
    default:
      throw new Error(`Unsupported message type: ${value}`);
  }
};

export const transformLegacySnapshot = (input: unknown): MigrationSnapshot => {
  const legacy = legacySnapshotSchema.parse(input);
  return migrationSnapshotSchema.parse({
    apps: legacy.apps.map((app) => ({
      ...app,
      codegenType: normalizeCodegenType(app.codegenType),
    })),
    chatHistories: legacy.chatHistories.map((chatHistory) => ({
      ...chatHistory,
      messageType: normalizeMessageType(chatHistory.messageType),
    })),
    users: legacy.users.map((user) => ({
      ...user,
      userRole: normalizeUserRole(user.userRole),
    })),
  });
};
