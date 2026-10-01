import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readSetup, runSetup } from "./setup.js";

const DEFAULT_PROFILE = "onion";

export function profilePath(profile = DEFAULT_PROFILE) {
	const base =
		process.platform === "win32"
			? (process.env.APPDATA ?? path.join(os.homedir(), ".config"))
			: path.join(os.homedir(), ".config");
	return path.join(base, "tunnel-client", `${profile}.yaml`);
}

export async function loadConfig() {
	const setup = (await readSetup()) ?? (await runSetup());
	const profile =
		process.env.ONION_BRIDGE_PROFILE || setup.profile || DEFAULT_PROFILE;
	const port = Number(process.env.ONION_BRIDGE_PORT || setup.port || 3737);
	const token = process.env.ONION_BRIDGE_TOKEN || setup.token;

	await writeTunnelProfile({ profile, tunnelId: setup.tunnelId, token, port });
	process.env.OPENAI_API_KEY = setup.apiKey;

	return {
		profile,
		port,
		token,
		tunnelBin: process.env.ONION_BRIDGE_TUNNEL_BIN || setup.tunnelBin,
	};
}

async function writeTunnelProfile({ profile, tunnelId, token, port }) {
	const file = profilePath(profile);
	await fs.mkdir(path.dirname(file), { recursive: true });
	const yaml = `config_version: 1

control_plane:
  base_url: "https://api.openai.com"
  tunnel_id: "${tunnelId}"
  api_key: "env:OPENAI_API_KEY"

health:
  listen_addr: "127.0.0.1:8080"

admin_ui:
  open_browser: false

log:
  level: error
  format: json

mcp:
  server_urls:
    - channel: main
      url: "http://127.0.0.1:${port}/mcp"
  extra_headers:
    Authorization: "Bearer ${token}"
`;
	await fs.writeFile(file, yaml, { encoding: "utf8", mode: 0o600 });
}
