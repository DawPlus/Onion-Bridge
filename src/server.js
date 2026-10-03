import { spawn } from "node:child_process";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools.js";

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

export async function startBridge(profileName = "default", workspaceOverride) {
	const config = await loadConfig(profileName, workspaceOverride);
	const root = config.workspace;
	const app = express();
	app.disable("x-powered-by");
	app.use(express.json({ limit: "5mb" }));

	app.get("/health", (_req, res) =>
		res.json({ status: "ok", profile: config.name, workspace: root }),
	);
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
		const instance = app.listen(config.port, "127.0.0.1", () => resolve(instance));
		instance.once("error", reject);
	});

	console.log(`[onionBridge] profile: ${config.name}`);
	console.log(`[onionBridge] workspace: ${root}`);
	console.log(`[onionBridge] MCP: http://127.0.0.1:${config.port}/mcp`);
	console.log(
		"[onionBridge] tools: get_workspace_info, list_directory, search_text, read_file, run_workspace_command, request_local_http, start_workspace_process, stop_workspace_process, workspace_process_status, workspace_process_logs, wait_for_local_service, edit_file, write_file, create_directory, delete_path",
	);
	console.warn(
		"[onionBridge] WARNING: OAuth is not used. File operations are auto-approved. Use at your own risk.",
	);

	const tunnel = spawn(
		config.tunnelBin,
		["run", "--profile", config.tunnelProfile],
		{
			stdio: "inherit",
			windowsHide: true,
			env: process.env,
		},
	);

	tunnel.once("spawn", () =>
		console.log(`[onionBridge] tunnel: ${config.tunnelProfile}`),
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
