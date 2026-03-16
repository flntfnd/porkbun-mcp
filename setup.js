#!/usr/bin/env node

import { appendFile, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createInterface } from "readline";
import { homedir } from "os";
import { join } from "path";

const MARKER = "# porkbun-mcp credentials";

// --- Readline helpers ---

// Single shared interface for the whole session
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// For secrets: suppress echoed characters and replace with "*"
function askSecret(question) {
  return new Promise((resolve) => {
    let value = "";
    let muted = false;

    // Override output write to mask characters while muted
    const original = rl.output.write.bind(rl.output);
    rl.output.write = (str, ...args) => {
      if (muted) {
        // Allow newline through, mask everything else
        if (str === "\r\n" || str === "\n") {
          original(str, ...args);
        }
        return true;
      }
      return original(str, ...args);
    };

    process.stdout.write(question);
    muted = true;

    rl.question("", (answer) => {
      muted = false;
      rl.output.write = original;
      // In TTY mode the answer echoed with our mask; print a newline for spacing
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

// --- Profile read/write helpers ---

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

async function replaceKeys(filePath, apiKey, secretKey) {
  const content = await readFile(filePath, "utf8");
  const block = buildBlock(apiKey, secretKey);
  const markerRe = /# porkbun-mcp credentials\n[\s\S]*?# end porkbun-mcp credentials\n?/;
  await writeFile(filePath, content.replace(markerRe, block), "utf8");
}

// --- Main ---

console.log("\nPorkbun MCP — credential setup\n");
console.log(
  "This script writes your Porkbun API keys to your shell profile so that\n" +
  "the MCP server can read them on startup.\n" +
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
  process.exit(1);
}

const secretKey = await askSecret("Enter your Porkbun secret key:  ");
if (!secretKey.trim()) {
  console.error("Secret key cannot be empty. Aborting.");
  process.exit(1);
}

console.log();

const alreadyPresent = await containsMarker(targetProfile);
if (alreadyPresent) {
  const answer = await ask(
    `Keys already exist in ${targetProfile}. Replace them? [y/N] `
  );
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted. Existing keys were not changed.");
    rl.close();
    process.exit(0);
  }
  await replaceKeys(targetProfile, apiKey.trim(), secretKey.trim());
  console.log(`Keys updated in ${targetProfile}`);
} else {
  await appendFile(targetProfile, "\n" + buildBlock(apiKey.trim(), secretKey.trim()), "utf8");
  console.log(`Keys appended to ${targetProfile}`);
}

rl.close();

console.log(
  `\nNext steps:\n` +
  `  1. Reload your profile:  source ${targetProfile}\n` +
  `  2. Verify:               echo $PORKBUN_API_KEY\n` +
  `  3. Restart your MCP client and verify the server loads.\n`
);
