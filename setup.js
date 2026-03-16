#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createInterface } from "readline";
import { homedir } from "os";
import { join, resolve } from "path";

const MARKER = "# porkbun-mcp credentials";
const CLAUDE_JSON = join(homedir(), ".claude.json");

// --- Readline helpers ---

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

// --- Shell profile detection ---

function detectProfile() {
  const shell = process.env.SHELL ?? "";
  const home = homedir();
  if (shell.endsWith("zsh")) {
    for (const f of [".zshrc", ".zprofile"]) {
      const p = join(home, f);
      if (existsSync(p)) return p;
    }
    return join(home, ".zshrc");
  }
  if (shell.endsWith("bash")) {
    for (const f of [".bash_profile", ".bashrc", ".profile"]) {
      const p = join(home, f);
      if (existsSync(p)) return p;
    }
    return join(home, ".bash_profile");
  }
  return join(home, ".profile");
}

// --- Shell profile helpers ---

function buildBlock(apiKey, secretKey) {
  return (
    `${MARKER}\n` +
    `export PORKBUN_API_KEY="${apiKey}"\n` +
    `export PORKBUN_SECRET_KEY="${secretKey}"\n` +
    `# end porkbun-mcp credentials\n`
  );
}

async function containsMarker(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return content.includes(MARKER);
  } catch {
    return false;
  }
}

async function replaceKeysInProfile(filePath, apiKey, secretKey) {
  const content = await readFile(filePath, "utf8");
  const block = buildBlock(apiKey, secretKey);
  const markerRe = /# porkbun-mcp credentials\n[\s\S]*?# end porkbun-mcp credentials\n?/;
  await writeFile(filePath, content.replace(markerRe, block), "utf8");
}

// --- ~/.claude.json MCP registration ---

async function registerMcpServer(apiKey, secretKey) {
  const serverPath = resolve(new URL(import.meta.url).pathname, "..", "index.js");

  let config = {};
  try {
    const raw = await readFile(CLAUDE_JSON, "utf8");
    config = JSON.parse(raw);
  } catch {
    // file doesn't exist or isn't valid JSON — start fresh
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers["porkbun-dns"] = {
    command: "node",
    args: [serverPath],
    env: {
      PORKBUN_API_KEY: apiKey,
      PORKBUN_SECRET_KEY: secretKey,
    },
  };

  await writeFile(CLAUDE_JSON, JSON.stringify(config, null, 2) + "\n", "utf8");
}

// --- Main ---

console.log("\nPorkbun MCP setup\n");
console.log(
  "This script writes your Porkbun API keys to your shell profile and\n" +
  "registers the MCP server in ~/.claude.json.\n" +
  "Keys are never sent anywhere except the Porkbun API.\n"
);

const detectedProfile = detectProfile();
console.log(`Detected shell profile: ${detectedProfile}\n`);

const overridePath = await ask(
  "Press Enter to use this file, or type a different path: "
);
const targetProfile = overridePath.trim() || detectedProfile;

console.log();

const apiKey = await askSecret("Enter your Porkbun API key:    ");
if (!apiKey.trim()) {
  console.error("API key cannot be empty. Aborting.");
  rl.close();
  process.exit(1);
}

const secretKey = await askSecret("Enter your Porkbun secret key:  ");
if (!secretKey.trim()) {
  console.error("Secret key cannot be empty. Aborting.");
  rl.close();
  process.exit(1);
}

console.log();

// Write to shell profile
const alreadyPresent = await containsMarker(targetProfile);
if (alreadyPresent) {
  const answer = await ask(
    `Keys already exist in ${targetProfile}. Replace them? [y/N] `
  );
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Shell profile not changed.");
  } else {
    await replaceKeysInProfile(targetProfile, apiKey.trim(), secretKey.trim());
    console.log(`Keys updated in ${targetProfile}`);
  }
} else {
  await appendFile(targetProfile, "\n" + buildBlock(apiKey.trim(), secretKey.trim()), "utf8");
  console.log(`Keys appended to ${targetProfile}`);
}

// Register in ~/.claude.json
try {
  await registerMcpServer(apiKey.trim(), secretKey.trim());
  console.log(`MCP server registered in ${CLAUDE_JSON}`);
} catch (err) {
  console.error(`Warning: could not update ${CLAUDE_JSON}: ${err.message}`);
  console.error("You may need to add the mcpServers entry manually (see README).");
}

rl.close();

console.log(
  `\nNext steps:\n` +
  `  1. Reload your shell profile:  source ${targetProfile}\n` +
  `  2. Restart your MCP client\n` +
  `  3. Verify the tools appear with /mcp\n`
);
