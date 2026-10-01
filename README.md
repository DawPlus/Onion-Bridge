# 🧅 Onion Bridge

Onion Bridge is a **CLI that exposes the current terminal directory as an MCP server, allowing ChatGPT to read and modify project files directly.**

```text
ChatGPT → OpenAI Secure MCP Tunnel ← tunnel-client → Onion Bridge → Current Directory
```

## Derived from GPT-Bridge

Onion Bridge is derived from [GPT-Bridge](https://github.com/dreamurl/GPT-Bridge).

## Features

| Read | Write |
|---|---|
| `get_workspace_info` | `edit_file` |
| `list_directory` | `write_file` |
| `search_text` | `create_directory` |
| `read_file` | `delete_path` |

All file operations are restricted to the directory where Onion Bridge is started.

Writes and deletions are applied directly to disk without a separate approval step.

MCP activity is shown in the terminal in real time and is not persisted to a history file.

## Requirements

- Node.js 20 or later
- OpenAI `tunnel-client`
- OpenAI Secure MCP Tunnel ID
- OpenAI API Key

## Installation

From the repository:

```bash
npm install
npm pack
npm install -g ./onion-bridge-0.1.0.tgz
```

Then run:

```bash
onion
```

If the command is not found, make sure the npm global bin directory is in your PATH.

## Initial Setup

If no configuration exists when you run `onion` for the first time, onboarding starts automatically.

You will be asked for three values:

| Item | Description |
|---|---|
| tunnel-client path | Path to the `tunnel-client` executable |
| OpenAI Tunnel ID | Tunnel ID starting with `tunnel_` |
| OpenAI API key | API key starting with `sk-` |

After setup, Onion Bridge automatically configures the authentication token and the `onion` tunnel-client profile.

Configuration is stored in `.onion-bridge/config.json` in your home directory and can be reused across projects.

To change the configuration:

```bash
onion setup
```

Press Enter to keep an existing value.

### Need help with setup?

Copy the prompt below and paste it into a **new ChatGPT conversation**.

ChatGPT will check the latest official OpenAI documentation and guide you step by step from creating a Secure MCP Tunnel to verifying the Onion Bridge connection.

```text
Guide me step by step through setting up Onion Bridge with OpenAI Secure MCP Tunnel.

Use the latest official OpenAI documentation and verify the current setup process before giving me instructions.

Please guide me through these steps:
1. Create an OpenAI Secure MCP Tunnel.
2. Find the Tunnel ID that starts with tunnel_.
3. Create an OpenAI API key.
4. Run Onion Bridge setup and enter the tunnel-client executable path, Tunnel ID, and OpenAI API key.
5. Start Onion Bridge with the onion command.
6. Create or configure the MCP/Connector in ChatGPT using the Secure MCP Tunnel.
7. Verify that ChatGPT can call the Onion Bridge MCP tools.

Important:
- Explain each step in Korean.
- Give me only one step at a time.
- Wait until I confirm that I completed the current step before moving to the next step.
- Use official OpenAI documentation as the source of truth because the UI and setup process may change.
- Never ask me to paste API keys, bearer tokens, or other secret values into the ChatGPT conversation.
- If I encounter an error, troubleshoot that error before continuing to the next step.
```

## Usage

Go to the project you want to connect:

```bash
cd C:\workspace\my-project
onion
```

Or explicitly:

```bash
onion start
```

The current directory becomes the MCP workspace.

```text
🧅 Onion Bridge

workspace: C:\workspace\my-project
MCP: http://127.0.0.1:3737/mcp
tunnel: onion
```

Press `Ctrl+C` to stop Onion Bridge.

## Activity Log

When ChatGPT calls an MCP tool, the activity is shown in the terminal in real time.

```text
13:02:11  INFO    .
13:02:12  LIST    src
13:02:15  SEARCH  "loadConfig"
13:02:18  READ    src/server.js
13:02:22  EDIT    src/server.js
13:02:25  WRITE   src/test.js
13:02:30  DELETE  src/old.js
```

File contents are not printed, and activity logs are not persisted to disk.

## Connecting ChatGPT

Onion Bridge runs the MCP server locally at `127.0.0.1:3737/mcp`.

It also starts `tunnel-client` using the saved `onion` profile and connects it to the OpenAI Secure MCP Tunnel.

After registering an MCP Connector in ChatGPT that uses the same Tunnel, ChatGPT can use the tools from the project where `onion` is currently running.

Once the Connector is configured, normal usage is simply running `onion` inside the project directory.

## Security

> ⚠️ **All Onion Bridge file operations are automatically approved.**
>
> File modifications, creations, and deletions requested by ChatGPT are written to disk immediately without an additional confirmation step. An incorrect or unexpected request can therefore modify your project immediately.

For important projects, keep your work in a state that can be restored with Git or another version-control system. Check the terminal activity log and review actual file changes while Onion Bridge is running.

Onion Bridge uses the directory where it was started as its workspace. Run it only inside the project you intend to expose. Do not run it from your home directory or an unnecessarily broad parent directory.

Basic safeguards are still applied:

- The MCP server binds only to `127.0.0.1`.
- Tunnel requests are authenticated with an automatically generated Bearer Token.
- File access is restricted to the workspace.
- Absolute paths and paths that escape the workspace are rejected.
- `.git` and `node_modules` are excluded from file traversal.
- Activity is displayed only in the terminal and is not saved to a separate log file.

The OpenAI API Key is stored in `~/.onion-bridge/config.json`. Do not share this file or commit it to Git.

## CLI

```bash
onion          # Start MCP + Tunnel
onion start    # Start MCP + Tunnel
onion setup    # Create or update Tunnel configuration
onion -v       # Show version
onion --version
```

## Differences from GPT-Bridge

GPT-Bridge is centered around a VS Code Extension. Onion Bridge uses only a CLI.

VS Code and the Extension are not required. The directory where `onion` is started becomes the workspace. Editor-specific features such as the settings UI, approval UI, and change history are removed, leaving only the MCP connection and file-operation tools.

## Philosophy

None.

## License

MIT
