import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readText, resolveInside, walkFiles } from "./workspace.js";

const text = (value) => ({ content: [{ type: "text", text: value }] });

function activity(action, target = "") {
	const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
	console.log(`${time}  ${action.padEnd(7)} ${target}`.trimEnd());
}

function matchesGlob(file, glob) {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	const pattern = escaped
		.replaceAll("**", "::DOUBLE::")
		.replaceAll("*", "[^/]*")
		.replaceAll("::DOUBLE::", ".*");
	return new RegExp(`^${pattern}$`).test(file);
}

export function registerTools(server, root) {
	server.registerTool(
		"get_workspace_info",
		{
			description: "Return the current Onion Bridge workspace.",
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async () => {
			activity("INFO", ".");
			return text(`Workspace: ${path.basename(root)}\nRoot: ${root}`);
		},
	);

	server.registerTool(
		"list_directory",
		{
			description: "List files below a workspace-relative directory.",
			inputSchema: {
				path: z.string().optional(),
				depth: z.number().int().min(1).max(3).optional(),
			},
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async ({ path: input = ".", depth = 1 }) => {
			activity("LIST", input);
			const base = resolveInside(root, input);
			const files = await walkFiles(root, input);
			const prefix = base.relative ? `${base.relative}/` : "";
			const visible = new Set();
			for (const file of files) {
				const local =
					prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file;
				const parts = local.split("/");
				visible.add(
					parts.slice(0, depth).join("/") + (parts.length > depth ? "/" : ""),
				);
			}
			return text([...visible].sort().join("\n") || "(empty)");
		},
	);

	server.registerTool(
		"search_text",
		{
			description: "Search literal text across workspace files.",
			inputSchema: {
				query: z.string().min(1),
				include: z.string().optional(),
				max_results: z.number().int().min(1).max(500).optional(),
				context_lines: z.number().int().min(0).max(5).optional(),
			},
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async ({ query, include, max_results = 50, context_lines = 0 }) => {
			activity("SEARCH", JSON.stringify(query));
			const files = await walkFiles(root);
			const results = [];
			for (const file of files) {
				if (results.length >= max_results) break;
				if (include && !matchesGlob(file, include)) continue;
				let content;
				try {
					content = (await readText(root, file)).text;
				} catch {
					continue;
				}
				const lines = content.split(/\r?\n/);
				for (let i = 0; i < lines.length && results.length < max_results; i++) {
					if (!lines[i].includes(query)) continue;
					const from = Math.max(0, i - context_lines);
					const to = Math.min(lines.length, i + context_lines + 1);
					results.push(
						`${file}:${i + 1}\n${lines
							.slice(from, to)
							.map((line, n) => `${from + n + 1}│ ${line}`)
							.join("\n")}`,
					);
				}
			}
			return text(results.join("\n\n") || "No matches.");
		},
	);

	server.registerTool(
		"read_file",
		{
			description: "Read a workspace-relative UTF-8 file.",
			inputSchema: {
				path: z.string(),
				start_line: z.number().int().min(1).optional(),
				end_line: z.number().int().min(1).optional(),
			},
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async ({ path: input, start_line, end_line }) => {
			activity("READ", input);
			const file = await readText(root, input);
			const lines = file.text.split(/\r?\n/);
			const start = start_line ?? 1;
			const end = Math.min(end_line ?? lines.length, lines.length);
			const body = lines
				.slice(start - 1, end)
				.map((line, i) => `${start + i}│ ${line}`)
				.join("\n");
			return text(
				`<file_content path="${file.relative}" lines="${start}-${end}" total_lines="${lines.length}">\n${body}\n</file_content>`,
			);
		},
	);

	server.registerTool(
		"edit_file",
		{
			description:
				"Replace one exact occurrence in an existing file. Writes directly to disk without approval.",
			inputSchema: {
				path: z.string(),
				old_string: z.string(),
				new_string: z.string(),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({ path: input, old_string, new_string }) => {
			activity("EDIT", input);
			const file = await readText(root, input);
			const first = file.text.indexOf(old_string);
			if (first < 0) throw new Error("old_string was not found.");
			if (file.text.indexOf(old_string, first + old_string.length) >= 0)
				throw new Error("old_string appears more than once.");
			await fs.writeFile(
				file.absolute,
				file.text.slice(0, first) +
					new_string +
					file.text.slice(first + old_string.length),
				"utf8",
			);
			return text(`Updated ${file.relative}.`);
		},
	);

	server.registerTool(
		"write_file",
		{
			description:
				"Create or fully replace a file. Writes directly to disk without approval.",
			inputSchema: { path: z.string(), content: z.string() },
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				openWorldHint: false,
			},
		},
		async ({ path: input, content }) => {
			activity("WRITE", input);
			const target = resolveInside(root, input);
			await fs.mkdir(path.dirname(target.absolute), { recursive: true });
			await fs.writeFile(target.absolute, content, "utf8");
			return text(`Wrote ${target.relative}.`);
		},
	);

	server.registerTool(
		"create_directory",
		{
			description: "Create a directory recursively without approval.",
			inputSchema: { path: z.string() },
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({ path: input }) => {
			activity("MKDIR", input);
			const target = resolveInside(root, input);
			await fs.mkdir(target.absolute, { recursive: true });
			return text(`Created ${target.relative}/.`);
		},
	);

	server.registerTool(
		"delete_path",
		{
			description: "Delete a file or directory directly without approval.",
			inputSchema: { path: z.string(), recursive: z.boolean().optional() },
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				openWorldHint: false,
			},
		},
		async ({ path: input, recursive = false }) => {
			activity("DELETE", input);
			const target = resolveInside(root, input);
			if (!target.relative)
				throw new Error("Workspace root cannot be deleted.");
			const stat = await fs.stat(target.absolute);
			if (stat.isDirectory() && !recursive)
				throw new Error("recursive=true is required for directories.");
			await fs.rm(target.absolute, { recursive, force: false });
			return text(`Deleted ${target.relative}.`);
		},
	);
}
