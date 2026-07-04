import { ErrorCode, HttpError } from "../common/index.js";

export type DeployKeyCandidateGenerator = () => string;

export type DeployKeyLookup = Readonly<{
  exists: (deployKey: string) => Promise<boolean>;
}>;

export const generateUniqueDeployKey = async (
  lookup: DeployKeyLookup,
  generateCandidate: DeployKeyCandidateGenerator,
  maxAttempts = 10,
): Promise<string> => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const deployKey = generateCandidate();
    const exists = await lookup.exists(deployKey);
    if (!exists) return deployKey;
  }
  throw new HttpError(ErrorCode.OperationError, "Failed to generate a unique deploy key", 500);
};
