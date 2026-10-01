#!/usr/bin/env node
import { startBridge } from "../src/server.js";
import { runSetup } from "../src/setup.js";
import { readFile } from "node:fs/promises";

const command = process.argv[2];
if (["-v", "--version"].includes(command)) {
	const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
	console.log(version);
	process.exit(0);
}

if (command && !["start", "setup"].includes(command)) {
	console.error("Usage: onion [start|setup|-v|--version]");
	process.exit(1);
}

const action = command === "setup" ? runSetup() : startBridge();

action.catch((error) => {
	console.error(
		`[onionBridge] ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
