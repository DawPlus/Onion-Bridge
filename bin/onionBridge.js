#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { startBridge } from "../src/server.js";
import { listProfiles, runSetup } from "../src/setup.js";

const args = process.argv.slice(2);
const first = args[0];

if (["-v", "--version"].includes(first)) {
	const { version } = JSON.parse(
		await readFile(new URL("../package.json", import.meta.url), "utf8"),
	);
	console.log(version);
	process.exit(0);
}

if (["-h", "--help", "help"].includes(first)) {
	printHelp();
	process.exit(0);
}

let action;

if (first === "setup") {
	action = runSetup(args[1] || "default");
} else if (first === "profiles") {
	action = printProfiles();
} else if (first === "start") {
	action = startBridge(args[1] || "default");
} else if (!first) {
	action = startBridge("default");
} else if (first.startsWith("-")) {
	console.error(`알 수 없는 옵션: ${first}`);
	printHelp();
	process.exit(1);
} else {
	action = startBridge(first);
}

action.catch((error) => {
	console.error(
		`[onionBridge] ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});

async function printProfiles() {
	const profiles = await listProfiles();
	if (!profiles.length) {
		console.log("저장된 Onion 프로필이 없습니다.");
		return;
	}
	for (const profile of profiles) console.log(profile);
}

function printHelp() {
	console.log(`🧅 Onion Bridge

사용법:
  onion
    기본(default) 프로필을 바로 실행합니다.
    최초 실행에서만 설정을 만들고, 이후에는 저장된 값을 그대로 사용합니다.

  onion <profile>
    지정한 프로필을 실행합니다.

  onion setup
    기본(default) 프로필을 생성하거나 수정합니다.

  onion setup <profile>
    새 프로필을 만들거나 기존 프로필을 수정합니다.
    workspace를 지정하고, Tunnel ID를 비우면 default 값을 재사용합니다.

  onion profiles
    저장된 프로필 목록을 봅니다.

여러 Onion을 동시에 띄우고 싶나요?
  프로필을 여러 개 만든 뒤 각각 실행하세요.

  예:
    onion setup frontend
    onion setup backend

  동시에 독립 연결로 사용할 프로필은 서로 다른 OpenAI Tunnel ID를 사용하세요.
  MCP port와 Bearer token은 Onion이 자동으로 관리합니다.

기타:
  onion -v, --version
  onion -h, --help`);
}
