import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";

const SERVICE = "porkbun-mcp";
const IS_MAC = platform() === "darwin";
const CRED_DIR = join(homedir(), ".config", "porkbun-mcp");
const CRED_FILE = join(CRED_DIR, "credentials.json");

function readKeychain(account) {
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-s", SERVICE, "-a", account, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    return undefined;
  }
}

function writeKeychain(account, password) {
  try {
    execFileSync("security", [
      "delete-generic-password", "-s", SERVICE, "-a", account,
    ], { stdio: "ignore" });
  } catch {
    // didn't exist yet
  }
  execFileSync("security", [
    "add-generic-password", "-s", SERVICE, "-a", account, "-w", password,
  ], { stdio: "ignore" });
}

function readCredFile() {
  try {
    return JSON.parse(readFileSync(CRED_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeCredFile(apiKey, secretKey) {
  mkdirSync(CRED_DIR, { recursive: true });
  writeFileSync(
    CRED_FILE,
    JSON.stringify({ apiKey, secretKey }) + "\n",
    { encoding: "utf8", mode: 0o600 }
  );
  try { chmodSync(CRED_DIR, 0o700); } catch {}
}

export function loadCredentials() {
  if (process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY) {
    return {
      apiKey: process.env.PORKBUN_API_KEY,
      secretKey: process.env.PORKBUN_SECRET_KEY,
    };
  }

  if (IS_MAC) {
    const apiKey = readKeychain("api-key");
    const secretKey = readKeychain("secret-key");
    if (apiKey && secretKey) return { apiKey, secretKey };
  }

  const file = readCredFile();
  if (file.apiKey && file.secretKey) return file;

  return null;
}

export function storeCredentials(apiKey, secretKey) {
  if (IS_MAC) {
    writeKeychain("api-key", apiKey);
    writeKeychain("secret-key", secretKey);
    return "macOS Keychain";
  }
  writeCredFile(apiKey, secretKey);
  return CRED_FILE;
}
