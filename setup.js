#!/usr/bin/env node

import { readFile, writeFile } from "fs/promises";
import { createInterface } from "readline";
import { homedir, platform } from "os";
import { join, resolve } from "path";
import { storeCredentials, loadCredentials } from "./credentials.js";

const CLAUDE_JSON = join(homedir(), ".claude.json");

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function askSecret(question) {
  return new Promise((resolve) => {
    let muted = false;
    const original = rl.output.write.bind(rl.output);
    rl.output.write = (str, ...args) => {
      if (muted) {
        if (str === "\r\n" || str === "\n") original(str, ...args);
        return true;
      }
      return original(str, ...args);
    };
    process.stdout.write(question);
    muted = true;
    rl.question("", (answer) => {
      muted = false;
      rl.output.write = original;
      if (process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function registerMcpServer() {
  const serverPath = resolve(new URL(import.meta.url).pathname, "..", "index.js");

  let config = {};
  try {
    const raw = await readFile(CLAUDE_JSON, "utf8");
    config = JSON.parse(raw);
  } catch {
    // start fresh
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers["porkbun-dns"] = {
    command: "node",
    args: [serverPath],
  };

  await writeFile(CLAUDE_JSON, JSON.stringify(config, null, 2) + "\n", "utf8");
}

// --- Main ---

const IS_MAC = platform() === "darwin";

console.log("\nPorkbun MCP Setup\n");

if (IS_MAC) {
  console.log("Your API keys will be stored in the macOS Keychain.");
} else {
  console.log("Your API keys will be stored in ~/.config/porkbun-mcp/credentials.json");
  console.log("with restricted file permissions (owner-only read/write).");
}

console.log("Keys are never written to plaintext config files.\n");

const existing = loadCredentials();
if (existing) {
  const answer = await ask("Existing credentials found. Replace them? [y/N] ");
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Keeping existing credentials.\n");
  } else {
    await promptAndStore();
  }
} else {
  await promptAndStore();
}

try {
  await registerMcpServer();
  console.log(`MCP server registered in ${CLAUDE_JSON}`);
} catch (err) {
  console.error(`Warning: could not update ${CLAUDE_JSON}: ${err.message}`);
  console.error("You may need to add the mcpServers entry manually (see README).\n");
}

rl.close();

console.log(
  `\nDone. Next steps:\n` +
  `  1. Restart Claude Code (or your MCP client)\n` +
  `  2. Run /mcp to confirm porkbun-dns is listed\n`
);

async function promptAndStore() {
  const apiKey = await askSecret("Porkbun API key:     ");
  if (!apiKey.trim()) {
    console.error("API key cannot be empty.");
    rl.close();
    process.exit(1);
  }

  const secretKey = await askSecret("Porkbun secret key:  ");
  if (!secretKey.trim()) {
    console.error("Secret key cannot be empty.");
    rl.close();
    process.exit(1);
  }

  console.log();

  try {
    const location = storeCredentials(apiKey.trim(), secretKey.trim());
    console.log(`Keys stored in ${location}`);
  } catch (err) {
    console.error(`Failed to store credentials: ${err.message}`);
    rl.close();
    process.exit(1);
  }
}
