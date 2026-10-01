import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DIR = path.join(os.homedir(), ".onion-bridge");
const FILE = path.join(DIR, "config.json");

export async function readSetup() {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return undefined;
  }
}

export async function runSetup() {
  const current = await readSetup();
  const rl = readline.createInterface({ input, output });

  console.log("\n🧅 Onion Bridge setup");
  console.log("Press Enter to keep the current value.\n");

  const tunnelBin = await ask(rl, "tunnel-client path", current?.tunnelBin);
  const tunnelId = await ask(rl, "OpenAI Tunnel ID", current?.tunnelId);
  const apiKey = await ask(rl, "OpenAI API key", current?.apiKey, true);

  rl.close();

  if (!tunnelBin || !tunnelId || !apiKey) throw new Error("All setup values are required.");
  if (!tunnelId.startsWith("tunnel_")) throw new Error("Tunnel ID must start with tunnel_.");
  if (!apiKey.startsWith("sk-")) throw new Error("OpenAI API key must start with sk-.");

  await fs.access(tunnelBin).catch(() => {
    throw new Error("tunnel-client executable does not exist.");
  });

  const config = {
    tunnelBin,
    tunnelId,
    apiKey,
    token: current?.token || crypto.randomBytes(32).toString("hex"),
    profile: "onion",
    port: current?.port || 3737
  };

  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
  console.log(`\nSaved: ${FILE}\n`);
  return config;
}

async function ask(rl, label, current, secret = false) {
  const hint = current ? (secret ? " [********]" : ` [${current}]`) : "";
  const value = (await rl.question(`${label}${hint}: `)).trim();
  return value || current;
}
