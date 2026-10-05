import type { OAuthConfig } from "./types.js";

export function buildWwwAuthenticate({
	oauth,
	error,
	errorDescription,
	scope,
}: {
	oauth?: OAuthConfig;
	error?: string;
	errorDescription?: string;
	scope?: string;
}): string {
	const parts = ['Bearer realm="onion-bridge"'];
	if (oauth?.resource) {
		const metadataUrl = protectedResourceMetadataUrl(oauth.resource);
		parts.push(`resource_metadata="${metadataUrl}"`);
	}
	if (error) parts.push(`error="${error}"`);
	if (errorDescription) {
		parts.push(`error_description="${escapeParam(errorDescription)}"`);
	}
	if (scope) parts.push(`scope="${scope}"`);
	return parts.join(", ");
}

export function protectedResourceMetadataUrl(resource: string): string {
	try {
		const url = new URL(resource);
		return `${url.origin}/.well-known/oauth-protected-resource`;
	} catch {
		return "/.well-known/oauth-protected-resource";
	}
}

export function buildProtectedResourceMetadata(oauth: OAuthConfig) {
	return {
		resource: oauth.resource,
		authorization_servers: oauth.authorizationServers,
		jwks_uri: oauth.jwksUri,
		scopes_supported: oauth.scopesSupported,
		bearer_methods_supported: ["header"],
	};
}

function escapeParam(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
