import {
	hasScope,
	requiredScopeForMcpBody,
} from "./scopes.js";
import { verifyOAuthAccessToken, type VerifyAccessToken } from "./oauth.js";
import type {
	AuthResult,
	BridgeAuthConfig,
} from "./types.js";

export function extractBearerToken(
	authorization: string | undefined,
): string | null {
	if (!authorization) return null;
	const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
	return match?.[1]?.trim() || null;
}

export async function authenticateMcpRequest({
	authorization,
	body,
	auth,
	verifyAccessToken = verifyOAuthAccessToken,
}: {
	authorization?: string;
	body?: unknown;
	auth: BridgeAuthConfig;
	verifyAccessToken?: VerifyAccessToken;
}): Promise<AuthResult> {
	if (auth.mode === "none") {
		return { ok: true, mode: "none", scopes: [] };
	}

	const token = extractBearerToken(authorization);

	if (auth.mode === "token") {
		if (!auth.token) {
			return {
				ok: false,
				status: 401,
				error: "invalid_token",
				errorDescription: "Server token is not configured.",
			};
		}
		if (!token || token !== auth.token) {
			return {
				ok: false,
				status: 401,
				error: "invalid_token",
				errorDescription: "Missing or invalid bearer token.",
			};
		}
		return { ok: true, mode: "token", scopes: [] };
	}

	// oauth
	if (!auth.oauth) {
		return {
			ok: false,
			status: 401,
			error: "invalid_token",
			errorDescription: "OAuth is not configured on this server.",
		};
	}
	if (!token) {
		return {
			ok: false,
			status: 401,
			error: "invalid_token",
			errorDescription: "Missing bearer access token.",
		};
	}

	const verified = await verifyAccessToken(token, auth.oauth);
	if (!verified.ok) return verified;

	const required = requiredScopeForMcpBody(body);
	if (required && !hasScope(verified.scopes, required)) {
		return {
			ok: false,
			status: 403,
			error: "insufficient_scope",
			errorDescription: `Required scope: ${required}`,
			scope: required,
		};
	}

	return verified;
}
