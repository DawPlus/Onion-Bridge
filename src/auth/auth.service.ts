import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { authenticateMcpRequest } from "./authenticate.js";
import {
	buildProtectedResourceMetadata,
	buildWwwAuthenticate,
} from "./challenge.js";
import type { VerifyAccessToken } from "./oauth.js";
import type {
	AuthFailure,
	AuthResult,
	BridgeAuthConfig,
	OAuthConfig,
} from "./types.js";

@Injectable()
export class AuthService {
	private verifyAccessToken: VerifyAccessToken | undefined;

	/** Test seam for injecting a local JWKS verifier. */
	setVerifyAccessToken(verify?: VerifyAccessToken): void {
		this.verifyAccessToken = verify;
	}

	async authenticateRequest(
		req: Request,
		auth: BridgeAuthConfig,
	): Promise<AuthResult> {
		return authenticateMcpRequest({
			authorization: req.headers.authorization,
			body: req.body,
			auth,
			verifyAccessToken: this.verifyAccessToken,
		});
	}

	writeAuthFailure(
		res: Response,
		failure: AuthFailure,
		oauth?: OAuthConfig,
	): void {
		res.setHeader(
			"WWW-Authenticate",
			buildWwwAuthenticate({
				oauth,
				error: failure.error,
				errorDescription: failure.errorDescription,
				scope: failure.scope,
			}),
		);
		res.status(failure.status).json({
			error: failure.error,
			error_description: failure.errorDescription,
			...(failure.scope ? { scope: failure.scope } : {}),
		});
	}

	protectedResourceMetadata(oauth: OAuthConfig) {
		return buildProtectedResourceMetadata(oauth);
	}
}
