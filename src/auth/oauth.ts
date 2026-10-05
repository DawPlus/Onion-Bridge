import {
	createRemoteJWKSet,
	jwtVerify,
	type JWTPayload,
	type JWTVerifyGetKey,
} from "jose";
import { parseScopeClaim } from "./scopes.js";
import type { AuthFailure, AuthSuccess, OAuthConfig } from "./types.js";

export type VerifyAccessToken = (
	token: string,
	oauth: OAuthConfig,
) => Promise<AuthSuccess | AuthFailure>;

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getJwks(jwksUri: string): JWTVerifyGetKey {
	let jwks = jwksCache.get(jwksUri);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(jwksUri));
		jwksCache.set(jwksUri, jwks);
	}
	return jwks;
}

/** Test helper: clear cached JWKS getters. */
export function clearJwksCache(): void {
	jwksCache.clear();
}

export async function verifyOAuthAccessToken(
	token: string,
	oauth: OAuthConfig,
	getKey: JWTVerifyGetKey = getJwks(oauth.jwksUri),
): Promise<AuthSuccess | AuthFailure> {
	try {
		const { payload } = await jwtVerify(token, getKey, {
			issuer: oauth.issuer,
			audience: oauth.audience,
		});
		return successFromPayload(payload);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Token validation failed";
		return {
			ok: false,
			status: 401,
			error: "invalid_token",
			errorDescription: message,
		};
	}
}

function successFromPayload(payload: JWTPayload): AuthSuccess {
	return {
		ok: true,
		mode: "oauth",
		scopes: parseScopeClaim(payload as Record<string, unknown>),
		subject: typeof payload.sub === "string" ? payload.sub : undefined,
	};
}

export function createLocalVerifyAccessToken(
	getKey: JWTVerifyGetKey,
): VerifyAccessToken {
	return (token, oauth) => verifyOAuthAccessToken(token, oauth, getKey);
}
