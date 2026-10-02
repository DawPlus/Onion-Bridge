# 🧅 Onion Bridge

Onion Bridge is a CLI that exposes a local workspace as an MCP server for ChatGPT.

```text
ChatGPT → OpenAI Secure MCP Tunnel ← tunnel-client → Onion Bridge → Workspace
```

## Features

- Read and modify local project files through MCP.
- Workspace access is restricted to the configured profile directory.
- Multiple named profiles can run at the same time.
- One `tunnel-client` executable is shared by all profiles.
- Each profile has its own workspace, local MCP port, Tunnel ID, auth token, and tunnel-client profile.
- Activity is printed in the terminal and is not persisted.

## Requirements

- Node.js 20+
- OpenAI `tunnel-client`
- One OpenAI Secure MCP Tunnel ID per independent ChatGPT MCP connection
- OpenAI API key

## Installation

```bash
npm install -g onion-bridge
```

## Setup

Create the first profile:

```bash
onion setup default
```

Create another profile:

```bash
onion setup acorns
onion setup acorn-kit
```

Setup asks for:

- shared `tunnel-client` executable path, only if not already saved
- shared OpenAI API key, only if not already saved
- profile workspace
- profile OpenAI Tunnel ID; named profiles reuse the `default` Tunnel ID when left blank

Local MCP ports and Bearer tokens are assigned automatically.

Shared configuration is stored at:

```text
~/.onion-bridge/config.json
```

Named profiles are stored at:

```text
~/.onion-bridge/profiles/<name>.json
```

Generated tunnel-client profiles are stored in the normal tunnel-client config directory as:

```text
onion-<name>.yaml
```

Existing single-profile Onion Bridge configuration remains usable as the `default` profile.

## Usage

Start the default profile:

```bash
onion
```

Start a named profile:

```bash
onion acorns
```

Equivalent explicit form:

```bash
onion start acorns
```

List profiles:

```bash
onion profiles
```

Example:

```text
Terminal A
onion acorns
→ workspace: /Users/me/workspace/acorns
→ MCP: 127.0.0.1:3737
→ tunnel: onion-acorns

Terminal B
onion acorn-kit
→ workspace: /Users/me/workspace/acorn-kit
→ MCP: 127.0.0.1:3738
→ tunnel: onion-acorn-kit
```

Both can run simultaneously as long as their local MCP ports are different.

## Multiple ChatGPT Connections

For independent simultaneous ChatGPT conversations:

```text
Chat A → Tunnel A → Onion profile A
Chat B → Tunnel B → Onion profile B
```

Profiles may reuse the default Tunnel ID, but independent simultaneous ChatGPT connections should use separate Tunnel IDs. Local MCP ports are assigned automatically.

The `tunnel-client` executable itself is shared. Onion Bridge generates a separate tunnel-client profile and health port for each Onion profile so concurrent tunnel processes do not collide.

## Security

All Onion Bridge file operations are automatically approved and written directly to disk.

Safeguards:

- MCP binds only to `127.0.0.1`.
- Tunnel requests require a generated Bearer token.
- File access is restricted to the configured workspace.
- Absolute paths and workspace escapes are rejected.
- `.git` and `node_modules` are excluded from traversal.

Do not configure a workspace broader than necessary.

If multiple agents point at the same workspace, they can modify the same files concurrently. Onion Bridge does not currently provide file locking or conflict prevention.

## CLI

```bash
onion                    # Start default profile
onion <profile>          # Start named profile
onion start [profile]    # Start profile
onion setup [profile]    # Create/update profile
onion profiles           # List profiles
onion -v
onion --version
```

## Derived from GPT-Bridge

Onion Bridge is derived from [GPT-Bridge](https://github.com/dreamurl/GPT-Bridge).

## License

MIT
