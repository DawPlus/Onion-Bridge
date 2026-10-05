import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { generateKeyPair, SignJWT } from "jose";
import { authenticateMcpRequest } from "../../dist/auth/authenticate.js";
import { buildWwwAuthenticate } from "../../dist/auth/challenge.js";
import { createLocalVerifyAccessToken } from "../../dist/auth/oauth.js";
import { tunnelProfilePath, writeTunnelProfile } from "../../dist/config.js";

const ISSUER = "https://auth.example.com";
const AUDIENCE = "onion-bridge";
const RESOURCE = "http://127.0.0.1:3737/mcp";

function baseOAuth() {
	return {
		issuer: ISSUER,
		audience: AUDIENCE,
		jwksUri: "https://auth.example.com/jwks",
		authorizationServers: [ISSUER],
		resource: RESOURCE,
		scopesSupported: [
			"workspace:read",
			"workspace:write",
			"workspace:exec",
		],
	};
}

async function makeSigner() {
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const verifyAccessToken = createLocalVerifyAccessToken(async () => publicKey);
	async function sign(scope, overrides = {}) {
		let builder = new SignJWT({
			scope: Array.isArray(scope) ? scope.join(" ") : scope,
		})
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(overrides.issuer ?? ISSUER)
			.setAudience(overrides.audience ?? AUDIENCE)
			.setSubject("user-1")
			.setIssuedAt(overrides.iat ?? Math.floor(Date.now() / 1000));

		if (overrides.exp !== undefined) {
			builder = builder.setExpirationTime(overrides.exp);
		} else {
			builder = builder.setExpirationTime("2h");
		}
		return builder.sign(privateKey);
	}
	return { sign, verifyAccessToken, oauth: baseOAuth() };
}

test("token mode accepts matching static bearer", async () => {
	const result = await authenticateMcpRequest({
		authorization: "Bearer secret",
		auth: { mode: "token", token: "secret" },
	});
	assert.equal(result.ok, true);
	assert.equal(result.mode, "token");
});

test("token mode rejects missing/wrong bearer", async () => {
	const result = await authenticateMcpRequest({
		authorization: "Bearer nope",
		auth: { mode: "token", token: "secret" },
	});
	assert.equal(result.ok, false);
	assert.equal(result.status, 401);
	assert.equal(result.error, "invalid_token");
});

test("none mode allows unauthenticated requests", async () => {
	const result = await authenticateMcpRequest({
		auth: { mode: "none" },
	});
	assert.equal(result.ok, true);
	assert.equal(result.mode, "none");
});

test("oauth accepts valid token for permitted tool scope", async () => {
	const { sign, verifyAccessToken, oauth } = await makeSigner();
	const token = await sign("workspace:read");
	const result = await authenticateMcpRequest({
		authorization: `Bearer ${token}`,
		body: { method: "tools/call", params: { name: "read_file" } },
		auth: { mode: "oauth", oauth },
		verifyAccessToken,
	});
	assert.equal(result.ok, true);
});

test("oauth rejects tools/call when scope is missing", async () => {
	const { sign, verifyAccessToken, oauth } = await makeSigner();
	const token = await sign("workspace:read");
	const result = await authenticateMcpRequest({
		authorization: `Bearer ${token}`,
		body: { method: "tools/call", params: { name: "write_file" } },
		auth: { mode: "oauth", oauth },
		verifyAccessToken,
	});
	assert.equal(result.ok, false);
	assert.equal(result.status, 403);
	assert.equal(result.error, "insufficient_scope");
	assert.equal(result.scope, "workspace:write");
});

test("oauth rejects expired token", async () => {
	const { sign, verifyAccessToken, oauth } = await makeSigner();
	const now = Math.floor(Date.now() / 1000);
	const token = await sign("workspace:read", { iat: now - 10_000, exp: now - 5_000 });
	const result = await authenticateMcpRequest({
		authorization: `Bearer ${token}`,
		auth: { mode: "oauth", oauth },
		verifyAccessToken,
	});
	assert.equal(result.ok, false);
	assert.equal(result.status, 401);
	assert.equal(result.error, "invalid_token");
});

test("oauth rejects wrong audience", async () => {
	const { sign, verifyAccessToken, oauth } = await makeSigner();
	const token = await sign("workspace:read", { audience: "other-resource" });
	const result = await authenticateMcpRequest({
		authorization: `Bearer ${token}`,
		auth: { mode: "oauth", oauth },
		verifyAccessToken,
	});
	assert.equal(result.ok, false);
	assert.equal(result.status, 401);
	assert.equal(result.error, "invalid_token");
});

test("oauth rejects wrong issuer", async () => {
	const { sign, verifyAccessToken, oauth } = await makeSigner();
	const token = await sign("workspace:read", {
		issuer: "https://evil.example.com",
	});
	const result = await authenticateMcpRequest({
		authorization: `Bearer ${token}`,
		auth: { mode: "oauth", oauth },
		verifyAccessToken,
	});
	assert.equal(result.ok, false);
	assert.equal(result.status, 401);
});

test("WWW-Authenticate includes resource_metadata", () => {
	const header = buildWwwAuthenticate({
		oauth: baseOAuth(),
		error: "invalid_token",
		errorDescription: "Missing bearer access token.",
	});
	assert.match(header, /Bearer realm="onion-bridge"/);
	assert.match(
		header,
		/resource_metadata="http:\/\/127\.0\.0\.1:3737\/\.well-known\/oauth-protected-resource"/,
	);
	assert.match(header, /error="invalid_token"/);
});

test("oauth tunnel profile omits static Authorization header", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "onion-tunnel-"));
	const prevHome = process.env.HOME;
	const prevAppData = process.env.APPDATA;
	process.env.HOME = dir;
	delete process.env.APPDATA;
	try {
		await writeTunnelProfile({
			profile: "oauth-test",
			tunnelId: "tun_test",
			token: "should-not-appear",
			port: 3737,
			healthPort: 7737,
			authMode: "oauth",
		});
		const yaml = await fs.readFile(tunnelProfilePath("oauth-test"), "utf8");
		assert.doesNotMatch(yaml, /Authorization:/);
		assert.doesNotMatch(yaml, /should-not-appear/);

		await writeTunnelProfile({
			profile: "token-test",
			tunnelId: "tun_test",
			token: "static-token",
			port: 3738,
			healthPort: 7738,
			authMode: "token",
		});
		const tokenYaml = await fs.readFile(
			tunnelProfilePath("token-test"),
			"utf8",
		);
		assert.match(tokenYaml, /Authorization: "Bearer static-token"/);
	} finally {
		if (prevHome === undefined) delete process.env.HOME;
		else process.env.HOME = prevHome;
		if (prevAppData === undefined) delete process.env.APPDATA;
		else process.env.APPDATA = prevAppData;
	}
});
