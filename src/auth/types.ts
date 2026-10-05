import type { OnionScope } from "./scopes.js";

export type AuthMode = "none" | "token" | "oauth";

export type OAuthConfig = {
	issuer: string;
	audience: string | string[];
	jwksUri: string;
	authorizationServers: string[];
	resource: string;
	scopesSupported: OnionScope[];
};

export type BridgeAuthConfig = {
	mode: AuthMode;
	/** Legacy static bearer token (token mode). */
	token?: string;
	oauth?: OAuthConfig;
};

export type AuthSuccess = {
	ok: true;
	mode: AuthMode;
	scopes: string[];
	subject?: string;
};

export type AuthFailure = {
	ok: false;
	status: 401 | 403;
	error: "invalid_token" | "insufficient_scope" | "invalid_request";
	errorDescription: string;
	scope?: string;
};

export type AuthResult = AuthSuccess | AuthFailure;
