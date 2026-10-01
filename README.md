# 🧅 Onion Bridge

Onion Bridge는 **현재 터미널 디렉터리를 MCP 서버로 열어 ChatGPT가 프로젝트 파일을 직접 읽고 수정할 수 있게 해주는 CLI**입니다.

VS Code Extension이 필요하지 않습니다. 프로젝트 폴더에서 `onion`만 실행하면 로컬 MCP 서버와 OpenAI Secure MCP Tunnel이 함께 시작됩니다.

```text
ChatGPT → OpenAI Secure MCP Tunnel ← tunnel-client → Onion Bridge → Current Directory
```

## GPT-Bridge에서 시작했습니다

Onion Bridge는 [GPT-Bridge](https://github.com/dreamurl/GPT-Bridge)에서 파생된 프로젝트입니다.

기존 GPT-Bridge의 **ChatGPT와 로컬 개발 환경을 MCP로 연결한다**는 아이디어와 구현을 바탕으로, VS Code Extension 대신 터미널에서 바로 실행할 수 있는 CLI 형태로 단순화했습니다.

현재 Onion Bridge는 별도의 VS Code UI 없이 현재 디렉터리를 workspace로 사용하며, MCP 서버와 `tunnel-client`를 함께 실행합니다.

원본 프로젝트와 기여자들에게 감사드립니다.

## 기능

| 읽기 | 쓰기 |
|---|---|
| `get_workspace_info` | `edit_file` |
| `list_directory` | `write_file` |
| `search_text` | `create_directory` |
| `read_file` | `delete_path` |

모든 파일 작업은 Onion Bridge를 실행한 디렉터리 내부로 제한됩니다.

쓰기/삭제는 별도 승인 없이 즉시 디스크에 반영됩니다.

실행 중 MCP 활동은 터미널에 실시간으로 표시되며 별도 히스토리 파일은 남기지 않습니다.

## 요구 사항

- Node.js 20 이상
- OpenAI `tunnel-client`
- OpenAI Secure MCP Tunnel ID
- OpenAI API Key

## 설치

저장소에서:

```bash
npm install
npm pack
npm install -g ./onion-bridge-0.1.0.tgz
```

설치 후:

```bash
onion
```

명령을 찾을 수 없다면 npm global bin 경로가 PATH에 등록되어 있는지 확인하세요.

## 최초 설정

처음 `onion`을 실행했는데 설정이 없으면 자동으로 onboarding이 시작됩니다.

입력값은 세 가지입니다.

| 항목 | 설명 |
|---|---|
| tunnel-client path | `tunnel-client` 실행 파일 경로 |
| OpenAI Tunnel ID | `tunnel_`로 시작하는 Tunnel ID |
| OpenAI API key | `sk-`로 시작하는 API Key |

설정이 완료되면 Onion Bridge가 인증 토큰과 `gpt-bridge` tunnel-client profile을 자동으로 구성합니다.

설정은 사용자 홈의 `.onion-bridge/config.json`에 저장되어 다른 프로젝트에서도 재사용됩니다.

설정을 변경하려면:

```bash
onion setup
```

기존 값을 유지하려면 해당 항목에서 Enter를 누르면 됩니다.

### 설정 방법을 모르겠다면

아래 프롬프트를 복사해서 **새 ChatGPT 대화에 붙여넣으세요.**

ChatGPT가 최신 OpenAI 공식 문서를 확인한 뒤 Secure MCP Tunnel 생성부터 Onion Bridge 연결 확인까지 한 단계씩 안내합니다.

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

## 사용법

연결할 프로젝트로 이동합니다.

```bash
cd C:\workspace\my-project
onion
```

또는 명시적으로:

```bash
onion start
```

현재 디렉터리가 MCP workspace가 됩니다.

```text
🧅 Onion Bridge

workspace: C:\workspace\my-project
MCP: http://127.0.0.1:3737/mcp
tunnel: gpt-bridge
```

종료는 `Ctrl+C`입니다.

## 활동 로그

ChatGPT가 MCP 도구를 호출하면 터미널에서 실시간으로 확인할 수 있습니다.

```text
13:02:11  INFO    .
13:02:12  LIST    src
13:02:15  SEARCH  "loadConfig"
13:02:18  READ    src/server.js
13:02:22  EDIT    src/server.js
13:02:25  WRITE   src/test.js
13:02:30  DELETE  src/old.js
```

파일 내용 자체는 출력하지 않으며 로그를 파일로 저장하지 않습니다.

## ChatGPT 연결

Onion Bridge는 로컬 `127.0.0.1:3737/mcp`에서 MCP 서버를 실행합니다.

동시에 저장된 `gpt-bridge` profile로 `tunnel-client`를 실행해 OpenAI Secure MCP Tunnel과 연결합니다.

ChatGPT에서 해당 Tunnel을 사용하는 MCP Connector를 등록하면 현재 `onion`을 실행한 프로젝트의 도구를 사용할 수 있습니다.

한 번 Connector를 구성한 뒤에는 평소에 프로젝트 폴더에서 `onion`만 실행하면 됩니다.

## 보안

Onion Bridge는 강력한 권한을 가진 개발 도구입니다.

- MCP 서버는 `127.0.0.1`에만 바인딩됩니다.
- Tunnel 요청은 자동 생성된 Bearer Token으로 인증합니다.
- 파일 접근은 Onion Bridge를 실행한 workspace 내부로 제한됩니다.
- 절대 경로와 workspace 밖으로 빠져나가는 경로는 거부합니다.
- `.git`과 `node_modules`은 파일 탐색에서 제외됩니다.
- 파일 수정, 생성, 삭제는 별도 승인 없이 즉시 실행됩니다.
- 활동 로그는 터미널에만 표시하고 저장하지 않습니다.

OpenAI API Key는 `~/.onion-bridge/config.json`에 저장되므로 해당 파일을 외부에 공유하거나 Git에 커밋하지 마세요.

## CLI

```bash
onion          # MCP + Tunnel 시작
onion start    # MCP + Tunnel 시작
onion setup    # Tunnel 설정 생성/변경
onion -v       # 버전 확인
onion --version
```

## 원본과의 차이

GPT-Bridge가 VS Code Extension을 중심으로 동작했다면 Onion Bridge는 CLI만 사용합니다.

VS Code 설치나 Extension 실행이 필요하지 않고, `onion`을 실행한 디렉터리가 바로 workspace가 됩니다. 설정 UI, 승인 UI, 변경 히스토리 같은 에디터 기능은 제외하고 MCP 연결과 파일 작업에 필요한 기능만 남겼습니다.

## 개발 철학

Onion Bridge는 에디터나 IDE에 종속되지 않는 작은 MCP Bridge를 목표로 합니다.

복잡한 UI, 승인 시스템, 변경 히스토리, 에디터 상태 관리는 두지 않습니다.

**터미널에서 실행하고, 현재 폴더를 연결하고, ChatGPT가 MCP로 작업한다.**

그게 전부입니다.

## License

MIT
