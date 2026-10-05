// @ts-nocheck
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ALL_SCOPES } from "./auth/scopes.js";
import { readGlobalSetup, readProfile, runSetup } from "./setup.js";

export const DEFAULT_PROFILE = "default";

export function tunnelProfilePath(profile = DEFAULT_PROFILE) {
	const base =
		process.platform === "win32"
			? (process.env.APPDATA ?? path.join(os.homedir(), ".config"))
			: path.join(os.homedir(), ".config");
	return path.join(base, "tunnel-client", `onion-${profile}.yaml`);
}

function resolveAuthMode(profile, global) {
	const raw =
		process.env.ONION_BRIDGE_AUTH_MODE ||
		profile?.authMode ||
		global?.authMode ||
		"token";
	const mode = String(raw).toLowerCase();
	if (mode === "none" || mode === "oauth" || mode === "token") return mode;
	throw new Error(
		`Unsupported auth mode "${raw}". Use none, token, or oauth.`,
	);
}

function splitCsv(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.map(String).filter(Boolean);
	return String(value)
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

function resolveOAuthConfig({ profile, global, port }) {
	const oauth = {
		...(global?.oauth || {}),
		...(profile?.oauth || {}),
	};
	const issuer =
		process.env.ONION_BRIDGE_OAUTH_ISSUER || oauth.issuer || undefined;
	const audienceRaw =
		process.env.ONION_BRIDGE_OAUTH_AUDIENCE || oauth.audience || undefined;
	const jwksUri =
		process.env.ONION_BRIDGE_OAUTH_JWKS_URI || oauth.jwksUri || undefined;
	const authorizationServers = splitCsv(
		process.env.ONION_BRIDGE_OAUTH_AUTHORIZATION_SERVERS ||
			oauth.authorizationServers ||
			issuer,
	);
	const resource =
		process.env.ONION_BRIDGE_OAUTH_RESOURCE ||
		oauth.resource ||
		`http://127.0.0.1:${port}/mcp`;

	if (!issuer) {
		throw new Error(
			"OAuth mode requires issuer (ONION_BRIDGE_OAUTH_ISSUER or profile/global oauth.issuer).",
		);
	}
	if (!audienceRaw) {
		throw new Error(
			"OAuth mode requires audience (ONION_BRIDGE_OAUTH_AUDIENCE or profile/global oauth.audience).",
		);
	}
	if (!jwksUri) {
		throw new Error(
			"OAuth mode requires JWKS URI (ONION_BRIDGE_OAUTH_JWKS_URI or profile/global oauth.jwksUri).",
		);
	}

	const audience = Array.isArray(audienceRaw)
		? audienceRaw.map(String)
		: String(audienceRaw).includes(",")
			? splitCsv(audienceRaw)
			: String(audienceRaw);

	return {
		issuer: String(issuer),
		audience,
		jwksUri: String(jwksUri),
		authorizationServers:
			authorizationServers.length > 0
				? authorizationServers
				: [String(issuer)],
		resource: String(resource),
		scopesSupported: ALL_SCOPES,
	};
}

export async function loadConfig(profileName = DEFAULT_PROFILE, workspaceOverride) {
	const profile =
		(await readProfile(profileName)) ?? (await runSetup(profileName));
	const global = await readGlobalSetup();

	const port = Number(process.env.ONION_BRIDGE_PORT || profile.port);
	const token = process.env.ONION_BRIDGE_TOKEN || profile.token;
	const tunnelProfile = `onion-${profileName}`;
	const healthPort = profile.healthPort || nextHealthPort(port);
	const authMode = resolveAuthMode(profile, global);
	const oauth =
		authMode === "oauth"
			? resolveOAuthConfig({ profile, global, port })
			: undefined;

	await writeTunnelProfile({
		profile: tunnelProfile,
		tunnelId: profile.tunnelId,
		token,
		port,
		healthPort,
		authMode,
	});
	process.env.OPENAI_API_KEY = global.apiKey;

	return {
		name: profileName,
		workspace: path.resolve(workspaceOverride || profile.workspace),
		port,
		token,
		tunnelProfile,
		tunnelBin: process.env.ONION_BRIDGE_TUNNEL_BIN || global.tunnelBin,
		auth: {
			mode: authMode,
			token,
			oauth,
		},
	};
}

function nextHealthPort(port) {
	const candidate = port + 4000;
	if (candidate <= 65535) return candidate;
	return port - 1000;
}

export async function writeTunnelProfile({
	profile,
	tunnelId,
	token,
	port,
	healthPort,
	authMode = "token",
}) {
	const file = tunnelProfilePath(profile.replace(/^onion-/, ""));
	await fs.mkdir(path.dirname(file), { recursive: true });
	const includeStaticBearer = authMode !== "oauth" && authMode !== "none";
	const extraHeaders = includeStaticBearer
		? `
  extra_headers:
    Authorization: "Bearer ${token}"`
		: "";
	const yaml = `config_version: 1

control_plane:
  base_url: "https://api.openai.com"
  tunnel_id: "${tunnelId}"
  api_key: "env:OPENAI_API_KEY"

health:
  listen_addr: "127.0.0.1:${healthPort}"

admin_ui:
  open_browser: false

log:
  level: error
  format: json

mcp:
  server_urls:
    - channel: main
      url: "http://127.0.0.1:${port}/mcp"${extraHeaders}
`;
	await fs.writeFile(file, yaml, { encoding: "utf8", mode: 0o600 });
}
