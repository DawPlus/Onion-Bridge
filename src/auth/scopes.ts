export const SCOPES = {
	read: "workspace:read",
	write: "workspace:write",
	exec: "workspace:exec",
} as const;

export type OnionScope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: OnionScope[] = [
	SCOPES.read,
	SCOPES.write,
	SCOPES.exec,
];

/** Minimum scope required for each MCP tool. */
export const TOOL_SCOPES: Record<string, OnionScope> = {
	get_workspace_info: SCOPES.read,
	list_directory: SCOPES.read,
	search_text: SCOPES.read,
	read_file: SCOPES.read,
	workspace_process_status: SCOPES.read,
	workspace_process_logs: SCOPES.read,
	wait_for_local_service: SCOPES.read,
	request_local_http: SCOPES.write,
	edit_file: SCOPES.write,
	write_file: SCOPES.write,
	create_directory: SCOPES.write,
	delete_path: SCOPES.write,
	run_workspace_command: SCOPES.exec,
	start_workspace_process: SCOPES.exec,
	stop_workspace_process: SCOPES.exec,
};

export function parseScopeClaim(payload: Record<string, unknown>): string[] {
	const raw = payload.scope ?? payload.scp;
	if (typeof raw === "string") {
		return raw.split(/\s+/).filter(Boolean);
	}
	if (Array.isArray(raw)) {
		return raw.map(String).filter(Boolean);
	}
	return [];
}

export function hasScope(granted: string[], required: string): boolean {
	return granted.includes(required);
}

export function requiredScopeForMcpBody(body: unknown): string | null {
	if (!body || typeof body !== "object") return null;
	const method = (body as { method?: unknown }).method;
	if (method !== "tools/call") return null;
	const params = (body as { params?: { name?: unknown } }).params;
	const name = params?.name;
	if (typeof name !== "string" || !name) return SCOPES.read;
	return TOOL_SCOPES[name] ?? SCOPES.exec;
}
