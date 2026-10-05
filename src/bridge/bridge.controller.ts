import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service.js";
import { BridgeService } from "./bridge.service.js";

@Controller()
export class BridgeController {
	constructor(
		private readonly bridge: BridgeService,
		private readonly auth: AuthService,
	) {}

	@Get("health")
	health() {
		return this.bridge.healthPayload();
	}

	@Get(".well-known/oauth-protected-resource")
	protectedResourceMetadata(@Res() res: Response): void {
		const config = this.bridge.getConfig();
		if (config.auth.mode !== "oauth" || !config.auth.oauth) {
			res.status(404).json({
				error: "not_found",
				error_description: "OAuth protected resource metadata is unavailable in this auth mode.",
			});
			return;
		}
		res.json(this.auth.protectedResourceMetadata(config.auth.oauth));
	}

	@Post("mcp")
	async mcp(@Req() req: Request, @Res() res: Response): Promise<void> {
		await this.bridge.handleMcp(req, res);
	}
}
