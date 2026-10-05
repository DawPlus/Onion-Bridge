import { spawnSync } from "node:child_process";

export function browseFolderDialog({ platform = process.platform } = {}) {
	if (platform === "darwin") {
		const result = spawnSync(
			"osascript",
			["-e", 'POSIX path of (choose folder with prompt "Select an Onion project folder")'],
			{ encoding: "utf8" },
		);
		if (result.status !== 0) {
			const message = (result.stderr || result.stdout || "").trim();
			if (/user cancelled|canceled/i.test(message) || result.status === 1) {
				return { cancelled: true, path: null };
			}
			throw new Error(message || "Folder picker failed.");
		}
		const selected = String(result.stdout || "").trim().replace(/\/$/, "");
		if (!selected) return { cancelled: true, path: null };
		return { cancelled: false, path: selected };
	}

	return {
		cancelled: false,
		path: null,
		unsupported: true,
		error:
			"Native folder picker is unavailable on this platform. Enter an absolute path instead.",
	};
}
