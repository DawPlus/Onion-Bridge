# Code Map

Project code entry points. Keep this map tiny and current.

Format:

```text
Area
Entry: path/to/main-file
Related: path/to/related-file, path/to/other-file
```

Rules:
- Record only useful entry points and important relationships.
- Do not catalog every file.
- Prefer 1 entry file and at most 2 related files per area.
- Update only when a change makes an existing map entry wrong or a repeatedly useful area has no entry.
- Remove stale entries instead of preserving history here.

```text
CLI / MCP bridge
Entry: bin/onionBridge.js
Related: src/server.js, src/setup.js

Web control API
Entry: src/control/server.js
Related: src/control/api.js, src/control/processManager.js

Web UI
Entry: apps/web/src/routes/index.tsx
Related: apps/web/src/routes/settings.tsx, apps/web/src/lib/api.ts
```

