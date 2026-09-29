import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface OpenAiTunnelConfigInput {
	readonly profile: string;
	readonly tunnelId: string;
	readonly bridgeToken: string;
	readonly port: number;
}

export function openAiTunnelConfigPath(profile: string): string {
	const appData =
		process.platform === "win32"
			? process.env.APPDATA
			: path.join(os.homedir(), ".config");
	const base = appData ?? path.join(os.homedir(), ".config");
	return path.join(base, "tunnel-client", `${profile}.yaml`);
}

export async function readOpenAiTunnelId(
	profile: string,
): Promise<string | undefined> {
	try {
		const yaml = await fs.readFile(openAiTunnelConfigPath(profile), "utf8");
		return yaml
			.match(/^\s*tunnel_id:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]
			?.trim();
	} catch {
		return undefined;
	}
}

export async function writeOpenAiTunnelConfig(
	input: OpenAiTunnelConfigInput,
): Promise<string> {
	const filePath = openAiTunnelConfigPath(input.profile);
	await fs.mkdir(path.dirname(filePath), { recursive: true });

	const yaml = `config_version: 1

control_plane:
  base_url: "https://api.openai.com"
  tunnel_id: "${escapeYaml(input.tunnelId)}"
  api_key: "env:OPENAI_API_KEY"

health:
  listen_addr: "127.0.0.1:8080"

admin_ui:
  open_browser: false

log:
  level: warn
  format: json

mcp:
  server_urls:
    - channel: main
      url: "http://127.0.0.1:${input.port}/mcp"
  extra_headers:
    Authorization: "Bearer ${escapeYaml(input.bridgeToken)}"
`;

	await fs.writeFile(filePath, yaml, { encoding: "utf8", mode: 0o600 });
	return filePath;
}

function escapeYaml(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
