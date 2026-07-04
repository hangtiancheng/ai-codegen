export const AWESOME_APP_PRIORITY = 99;

export const DEPLOY_KEY_LENGTH = 6;

const DEPLOY_KEY_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export const generateDeployKey = (): string => {
  let result = "";
  for (let i = 0; i < DEPLOY_KEY_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * DEPLOY_KEY_ALPHABET.length);
    result += DEPLOY_KEY_ALPHABET.charAt(index);
  }
  return result;
};
