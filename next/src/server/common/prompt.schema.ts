import { z } from "zod";
import { env } from "../config/index";

export const aiPromptSchema = z.string().min(1).max(env.AI_PROMPT_MAX_LENGTH);
