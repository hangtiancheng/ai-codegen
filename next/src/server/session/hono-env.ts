import type { SessionUser } from "./session.schema";

export type AuthVariables = {
  sessionId: string;
  user: SessionUser;
};

export type AppHonoEnv = {
  Variables: Partial<AuthVariables>;
};
