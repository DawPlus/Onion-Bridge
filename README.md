<div align="right">
  <b>한국어</b> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh-CN.md">简体中文</a>
</div>

# GPT Bridge

GPT Bridge는 현재 열려 있는 VS Code 워크스페이스를 MCP 서버로 연결해
**ChatGPT가 프로젝트의 코드를 직접 읽고 수정할 수 있게 해주는 VS Code 확장 프로그램**입니다.

OpenAI Secure MCP Tunnel을 사용하며, 최초 설정 이후에는 VS Code에서 GPT Bridge와
`tunnel-client`가 함께 실행됩니다.

> **핵심 원칙**
>
> 일반적인 텍스트 수정은 디스크가 아니라 VS Code 편집기 버퍼에 먼저 적용됩니다.
> 따라서 `Ctrl+Z`로 되돌릴 수 있으며, 자동 저장을 사용하지 않는 경우 `Ctrl+S` 전까지
> 디스크에 저장되지 않습니다. 파일 생성, 삭제, 이름 변경은 승인 후 즉시 디스크에 반영됩니다.

## 주요 기능

| 읽기 | 쓰기 |
|---|---|
| `get_workspace_info` 워크스페이스 정보 | `edit_file` 기존 파일 부분 수정 |
| `list_directory` 파일/폴더 목록 | `write_file` 새 파일 생성 |
| `read_file` 파일 읽기 | `create_directory` 폴더 생성 |
| `search_text` 코드 검색 | `delete_path` 파일/폴더 삭제 |
| `get_diagnostics` 타입/Lint 진단 | `save_file` 명시적 저장 |

`get_diagnostics`를 통해 ChatGPT가 수정 후 타입 오류와 Lint 문제를 다시 확인할 수 있습니다.
파일 목록과 검색은 `.gitignore`를 따릅니다.

---

## 설치

### 요구 사항

- Git
- Node.js LTS
- VS Code 1.90 이상
- OpenAI `tunnel-client`

저장소를 받은 뒤 설치합니다.

```bash
git clone https://github.com/DreamURL/GPT-Bridge.git
cd GPT-Bridge
npm install
npm run setup
```

`npm run setup`은 확장을 빌드하고 VSIX를 설치합니다.

설치가 끝나면 VS Code에서 `Ctrl+Shift+P` → **Developer: Reload Window**를 실행하세요.
왼쪽 Activity Bar에 GPT Bridge가 표시됩니다.

업데이트할 때는 다음 명령을 사용합니다.

```bash
git pull
npm install
npm run setup
```

> `code` 명령을 찾을 수 없다는 오류가 나오면 VSIX 빌드는 완료됐을 수 있습니다.
> VS Code의 Extensions 메뉴에서 **Install from VSIX**를 선택해 생성된 VSIX를 직접 설치할 수 있습니다.
>
> 파일 검색에 사용하는 ripgrep 바이너리는 OS/CPU 환경에 영향을 받으므로 다른 PC에서 만든 VSIX를
> 그대로 복사하기보다 사용할 PC에서 직접 빌드하는 것을 권장합니다.

---

## ChatGPT 연결

ChatGPT는 인터넷에 있고 GPT Bridge는 로컬 PC에서 실행됩니다.
OpenAI Secure MCP Tunnel을 통해 로컬 서버를 직접 공개하지 않고 연결합니다.

```
ChatGPT → OpenAI Secure MCP Tunnel ← tunnel-client → GPT Bridge → VS Code Workspace
```

### 1. tunnel-client 준비

OpenAI의 `tunnel-client`를 내려받아 압축을 풉니다.
온보딩에서 실행 파일 위치를 선택하므로 PATH에 등록할 필요는 없습니다.

### 2. 최초 온보딩

GPT Bridge를 처음 열면 설정 화면이 표시됩니다.

입력할 값은 다음 세 가지입니다.

| 항목 | 설명 |
|---|---|
| tunnel-client 실행 파일 | 내려받은 `tunnel-client` 실행 파일 |
| OpenAI Tunnel ID | `tunnel_`로 시작하는 Secure MCP Tunnel ID |
| OpenAI API Key | `sk-`로 시작하는 API Key |

설정을 저장하면 GPT Bridge가 자동으로 다음 작업을 처리합니다.

- 터널 Provider를 OpenAI로 설정
- 자동 시작 활성화
- GPT Bridge 인증 토큰 생성
- `gpt-bridge.yaml` 생성
- API Key를 VS Code SecretStorage에 저장
- `tunnel-client` 실행 시 API Key를 환경 변수로 전달

API Key 원문은 설정 화면에 다시 표시하지 않습니다.
이미 저장된 키가 있으면 `********`로 표시되며, API Key 입력란을 비워둔 채 저장하면 기존 키를 유지합니다.

### 3. 설정 방법을 모르겠다면

온보딩 화면의 **❔ 도와줘** 버튼을 누르세요.

ChatGPT용 설정 가이드 프롬프트가 클립보드에 복사됩니다.
새 ChatGPT 대화에 붙여넣으면 최신 OpenAI 공식 문서를 기준으로 다음 과정을 한 단계씩 안내하도록 구성되어 있습니다.

1. Secure MCP Tunnel 생성
2. Tunnel ID 확인
3. OpenAI API Key 생성
4. GPT Bridge 온보딩 입력
5. ChatGPT MCP/Connector 생성 및 연결
6. 연결 확인

API Key나 인증 토큰 같은 비밀값을 ChatGPT 대화에 붙여넣도록 요구하지 않게 구성되어 있습니다.

### 4. ChatGPT Connector 등록

온보딩을 저장한 뒤 GPT Bridge를 실행합니다.

ChatGPT에서 Secure MCP Tunnel을 사용하는 MCP/Connector를 생성하고,
온보딩에서 사용한 Tunnel을 선택합니다.

GPT Bridge 패널의 **Connector URL**은 연결 확인이나 문제 해결 시 사용할 수 있습니다.
인증 토큰은 GPT Bridge가 자동으로 생성하고 터널 설정에 넣기 때문에 사용자가 직접 복사할 필요가 없습니다.

### 5. ChatGPT 지침 복사

GPT Bridge 패널에서 **GPT 지침 복사** 버튼을 누른 뒤 ChatGPT에 붙여넣습니다.

이 지침은 ChatGPT가 GPT Bridge 도구를 사용할 때 필요한 작업 규칙을 제공합니다.
프로젝트 단위로 사용할 경우 해당 프로젝트의 지침에 넣는 방식을 권장합니다.

---

## 평소 사용법

최초 온보딩을 완료한 뒤에는 별도로 YAML을 작성하거나 터널 명령을 실행할 필요가 없습니다.

VS Code에서 프로젝트를 열면 자동 시작 설정에 따라:

1. GPT Bridge 로컬 MCP 서버가 시작됩니다.
2. `tunnel-client`가 `gpt-bridge` 프로필로 시작됩니다.
3. 기존 ChatGPT Connector에서 해당 워크스페이스의 MCP 도구를 사용할 수 있습니다.

패널의 **시작 / 중지** 버튼으로 직접 제어할 수도 있습니다.

### 터널 설정 변경

패널 상단의 **설정하기** 버튼을 사용합니다.

터널 설정은 GPT Bridge가 중지된 상태에서만 변경할 수 있습니다.
실행 중 설정하기를 누르면 먼저 서버를 중지하라는 안내가 표시됩니다.

설정 화면에서는 기존 Tunnel ID와 tunnel-client 경로가 표시됩니다.
API Key는 보안을 위해 원문 대신 `********`로 표시됩니다.

변경하지 않으려면 **닫기**를 눌러 설정 화면을 빠져나올 수 있습니다.

---

## 보안

This tool opens your local filesystem to an external AI. These are the defenses.

- **Path gate** — every file access passes a single validation. It blocks escapes
  outside the workspace, symlink tricks, and Windows-specific bypasses: alternate
  data streams (`.env::$DATA`), reserved device names (`CON`), and drive-relative
  paths. Only `/` is accepted as a separator.
- **Deny list** — `.git/**`, `.env*`, `*.pem`, `*.key`, `id_rsa*`, `.ssh/**`,
  `.aws/**`, `.npmrc`, `.netrc` and more. You can add entries but not remove them.
- **Approval gate** — writes prompt for confirmation. Concurrent requests are
  serialized so prompts never overlap; 90 seconds of silence counts as a denial,
  and **a choice made after expiry is discarded.** `delete_path` always confirms,
  in every mode.
- **Authentication** — 32-byte random Bearer token, bound to `127.0.0.1`, CORS off.
- **Audit log** — JSONL covering not just tool calls but blocks, denials,
  expiries, and auth failures.

If the token leaks, the whole workspace is exposed. That is an accepted trade-off;
the response is `GPT Bridge: Regenerate token`. After regenerating,
update `Authorization` in the config file too.

## Settings

| Key | Default | Description |
|---|---|---|
| `gptBridge.port` | `3737` | Server port |
| `gptBridge.autoStart` | `false` | Start automatically with VS Code |
| `gptBridge.tunnel.provider` | `none` | `none` = the extension starts no tunnel (default). `cloudflare` = run cloudflared for a public URL |
| `gptBridge.approval.mode` | `always` | `always` / `session` / `pattern` |
| `gptBridge.autoSave` | `false` | Leave off to keep disk safe until `Ctrl+S` |
| `gptBridge.maxReadBytes` | `1048576` | Max bytes per read |

## Known limitations

1. Works only while your PC and the tunnel are up.
2. Writes are confirmed on both the ChatGPT side and the extension side — **two steps**.
3. A `.vsix` contains **ripgrep only for the platform that built it.**
4. If the workspace is not a git repository, `.gitignore` is not applied.
5. Multi-root workspaces use the first folder only.
6. No terminal-execution or Git-manipulation tools are provided.
7. **"Safe until you save" applies to text edits only.**

## Uninstall

The extension ID is `local.gpt-bridge`.

```bash
code --uninstall-extension local.gpt-bridge
```

Then run `Ctrl+Shift+P` → **`Developer: Reload Window`**.

From the UI instead: Extensions panel (`Ctrl+Shift+X`) → search
**`@installed gpt bridge`** → gear icon on the entry → **Uninstall**.

> Search without `@installed` and Marketplace results come first, so you may not
> spot it. The publisher is `local`, so it never appears on the Marketplace.

### What stays behind

Uninstalling removes the extension and nothing else.

| What | Removed for you? |
|---|---|
| The extension itself (`~/.vscode/extensions/local.gpt-bridge-<version>`) | ✅ |
| Audit logs and the downloaded `cloudflared`, in VS Code global storage | ❌ |
| Auth token and tunnel token, in VS Code SecretStorage | ❌ |
| `gptBridge.*` entries in your `settings.json` | ❌ |

The audit log lists every file GPT read or wrote. Delete the folder if that history
is sensitive:

```powershell
# Windows
Remove-Item -Recurse -Force "$env:APPDATA\Code\User\globalStorage\local.gpt-bridge"
```
```bash
# macOS
rm -rf ~/Library/Application\ Support/Code/User/globalStorage/local.gpt-bridge
# Linux
rm -rf ~/.config/Code/User/globalStorage/local.gpt-bridge
```

The leftover Bearer token is inert. It only ever authorized a GPT Bridge server on
`127.0.0.1`, and once the extension is gone nothing answers there.

### The tunnel outlives the extension

Nothing you set up under **Connecting ChatGPT** is undone by the uninstall. Clear it
separately:

1. **Stop `tunnel-client`** — close the window holding the connection open.
2. **Delete `gpt-bridge.yaml`** — it stores your **OpenAI API key in plain text**.
   `%APPDATA%\tunnel-client\` on Windows, `~/.config/tunnel-client/` elsewhere.
3. **Revoke that API key** on
   [platform.openai.com](https://platform.openai.com/settings/organization/api-keys).
   Deleting the local file does not invalidate the key — only revoking does.
4. **Delete the tunnel** on
   [platform.openai.com](https://platform.openai.com/settings/organization/tunnels),
   then remove the connector in ChatGPT → Settings → Apps & Connectors.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run build       # esbuild → dist/extension.js
npm run watch       # watch mode
npm run package     # build the .vsix only
```

Launching the Extension Development Host with `F5` needs a `.vscode/launch.json`.
That is personal editor configuration and is not committed, so create it yourself:

```jsonc
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

Start `npm run watch` first, then press `F5`.

## License

MIT
