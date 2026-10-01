import { spawn } from "node:child_process";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools.js";
import { workspaceRoot } from "./workspace.js";

function createMcp(root) {
	const server = new McpServer(
		{ name: "onion-bridge", version: "0.1.0" },
		{
			instructions:
				"Headless workspace MCP server. Changes are written directly to disk without approval.",
		},
	);
	registerTools(server, root);
	return server;
}

export async function startBridge() {
	const config = await loadConfig();
	const root = workspaceRoot();
	const app = express();
	app.disable("x-powered-by");
	app.use(express.json({ limit: "5mb" }));

	app.get("/health", (_req, res) => res.json({ status: "ok" }));
	app.get("/.well-known/oauth-protected-resource", (_req, res) => {
		res.status(404).json({ error: "OAuth is not configured" });
	});
	app.get("/.well-known/oauth-authorization-server", (_req, res) => {
		res.status(404).json({ error: "OAuth is not configured" });
	});
	app.post("/mcp", async (req, res) => {
		if (req.headers.authorization !== `Bearer ${config.token}`) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		const server = createMcp(root);
		const transport = new StreamableHTTPServerTransport({});
		res.on("close", () => {
			void transport.close().catch(() => undefined);
			void server.close().catch(() => undefined);
		});

		try {
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			if (!res.headersSent)
				res.status(500).json({ error: "MCP request failed" });
			console.error("[onionBridge]", error);
		}
	});

	const http = await new Promise((resolve, reject) => {
		const server = app.listen(config.port, "127.0.0.1", () => resolve(server));
		server.once("error", reject);
	});

	console.log(`[onionBridge] workspace: ${root}`);
	console.log(`[onionBridge] MCP: http://127.0.0.1:${config.port}/mcp`);

	const tunnel = spawn(config.tunnelBin, ["run", "--profile", config.profile], {
		stdio: "inherit",
		windowsHide: true,
		env: process.env,
	});

	tunnel.once("spawn", () =>
		console.log(`[onionBridge] tunnel: ${config.profile}`),
	);
	tunnel.on("error", (error) =>
		console.error(`[onionBridge] tunnel failed: ${error.message}`),
	);

	let stopping = false;
	const stop = () => {
		if (stopping) return;
		stopping = true;
		tunnel.kill();
		http.close(() => process.exit(0));
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
}
