import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as vscode from "vscode";
import { readConfig, type ApprovalMode } from "../config";
import { LANGUAGES, LANGUAGE_LABELS, isLang, t, type Lang } from "../i18n";
import { MCP_ENDPOINT } from "../mcp/http";
import type { ActivityEntry } from "../mcp/tools/types";
import type { SecretStore } from "../secrets";
import type { BridgeState, BridgeStateStore } from "../state";
import {
	readOpenAiTunnelId,
	writeOpenAiTunnelConfig,
} from "../tunnel/OpenAiTunnelConfig";

const MAX_ACTIVITY = 40;

const ONBOARDING_HELP_PROMPT = `Guide me step by step through setting up the GPT Bridge VS Code extension so its local MCP server can connect to ChatGPT through OpenAI Secure MCP Tunnel.

Guide me through these steps:
1. Create an OpenAI Secure MCP Tunnel and show me exactly where to do it.
2. Find and copy the generated Tunnel ID that starts with tunnel_.
3. Create the OpenAI API key required by tunnel-client.
4. Enter the tunnel-client executable path, Tunnel ID, and API key in the GPT Bridge onboarding screen.
5. Start GPT Bridge and create/connect the MCP Connector in ChatGPT.
6. Verify that the connection works correctly.

Instructions:
- Start with Step 1 and guide me through only one step at a time.
- Wait for me to confirm that each step is complete before continuing.
- Check the latest official OpenAI documentation on the web before giving UI instructions because the OpenAI and ChatGPT interfaces may have changed.
- Use the exact current menu and button names.
- Never ask me to paste API keys, Bridge authentication tokens, or other secrets into the chat.
- If something fails, troubleshoot only the current step and keep the checks concise.
- Explain the steps to me in Korean.

Start with Step 1.`;

interface ActivityRow extends ActivityEntry {
	readonly time: string;
}

/**
 * 사이드바 Webview (project.md §7.1).
 *
 * CSP를 엄격하게 적용하고 nonce를 쓴다. 이 패널은 인증 토큰을 다루므로
 * 외부 리소스를 하나도 불러오지 않는다(default-src 'none').
 */
export class BridgeViewProvider implements vscode.WebviewViewProvider {
	static readonly viewType = "gptBridge.panel";

	private view: vscode.WebviewView | undefined;
	private activity: ActivityRow[] = [];
	private onboardingComplete = false;
	private editingSetup = false;
	private existingTunnelId: string | undefined;
	private hasOpenAiApiKey = false;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly store: BridgeStateStore,
		private readonly secrets: SecretStore,
		private readonly globalState: vscode.Memento,
	) {
		this.onboardingComplete = globalState.get<boolean>(
			"gptBridge.onboardingComplete",
			false,
		);
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
		};

		webviewView.webview.onDidReceiveMessage((message: unknown) => {
			void this.handleMessage(message);
		});

		void this.loadExistingSetup();
	}

	private async loadExistingSetup(): Promise<void> {
		this.existingTunnelId = await readOpenAiTunnelId("gpt-bridge");
		this.hasOpenAiApiKey = (await this.secrets.getOpenAiApiKey()) !== undefined;
		this.render(this.store.current);
	}

	private async handleMessage(message: unknown): Promise<void> {
		if (!isPanelMessage(message)) {
			return;
		}

		if (message.type === "command") {
			await vscode.commands.executeCommand(message.command);
			return;
		}

		if (message.type === "setApprovalMode") {
			await vscode.workspace
				.getConfiguration("gptBridge")
				.update(
					"approval.mode",
					message.value,
					vscode.ConfigurationTarget.Global,
				);
			return;
		}

		if (message.type === "setAutoSave") {
			await vscode.workspace
				.getConfiguration("gptBridge")
				.update("autoSave", message.value, vscode.ConfigurationTarget.Global);
			return;
		}

		if (message.type === "setLanguage") {
			await vscode.workspace
				.getConfiguration("gptBridge")
				.update("language", message.value, vscode.ConfigurationTarget.Global);
			return;
		}

		if (message.type === "showDetail") {
			await vscode.commands.executeCommand("gptBridge.showLog");
			return;
		}

		if (message.type === "browseTunnelClient") {
			if (this.store.current.status !== "stopped") return;
			const picked = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: "Select tunnel-client",
			});
			if (picked?.[0] !== undefined) {
				await this.view?.webview.postMessage({
					type: "tunnelClientPicked",
					value: picked[0].fsPath,
				});
			}
			return;
		}

		if (message.type === "copyOnboardingHelp") {
			await vscode.env.clipboard.writeText(ONBOARDING_HELP_PROMPT);
			void vscode.window.showInformationMessage(
				"도움말 프롬프트를 복사했습니다. ChatGPT에 붙여넣고 안내에 따라 진행하세요.",
			);
			return;
		}

		if (message.type === "editSetup") {
			if (this.store.current.status !== "stopped") {
				void vscode.window.showInformationMessage(
					"터널 설정을 변경하려면 먼저 GPT Bridge를 중지하세요.",
				);
				return;
			}
			this.editingSetup = true;
			this.render(this.store.current);
			return;
		}

		if (message.type === "closeSetup") {
			this.editingSetup = false;
			this.render(this.store.current);
			return;
		}

		if (message.type === "saveSetup") {
			await this.saveSetup(message);
		}
	}

	private async saveSetup(
		message: Extract<PanelMessage, { type: "saveSetup" }>,
	): Promise<void> {
		if (this.store.current.status !== "stopped") {
			void vscode.window.showWarningMessage(
				"Stop GPT Bridge before editing tunnel settings.",
			);
			return;
		}

		const binPath = message.binPath.trim();
		const tunnelId = message.tunnelId.trim();
		const apiKey = message.apiKey.trim();
		const existingApiKey = await this.secrets.getOpenAiApiKey();
		const effectiveApiKey = apiKey.length > 0 ? apiKey : existingApiKey;
		if (
			binPath.length === 0 ||
			tunnelId.length === 0 ||
			effectiveApiKey === undefined
		) {
			void vscode.window.showWarningMessage(
				"Tunnel client path, Tunnel ID, and API key are required.",
			);
			return;
		}
		try {
			await fs.access(binPath);
		} catch {
			void vscode.window.showWarningMessage(
				"The selected tunnel-client executable does not exist.",
			);
			return;
		}
		if (!tunnelId.startsWith("tunnel_")) {
			void vscode.window.showWarningMessage(
				"Tunnel ID must start with tunnel_.",
			);
			return;
		}
		if (!effectiveApiKey.startsWith("sk-")) {
			void vscode.window.showWarningMessage(
				"OpenAI API key must start with sk-.",
			);
			return;
		}

		const config = vscode.workspace.getConfiguration("gptBridge");
		await config.update(
			"tunnel.provider",
			"openai",
			vscode.ConfigurationTarget.Global,
		);
		await config.update(
			"tunnel.openai.binPath",
			binPath,
			vscode.ConfigurationTarget.Global,
		);
		await config.update(
			"tunnel.openai.profile",
			"gpt-bridge",
			vscode.ConfigurationTarget.Global,
		);
		await config.update("autoStart", true, vscode.ConfigurationTarget.Global);
		await this.secrets.setOpenAiApiKey(effectiveApiKey);
		this.existingTunnelId = tunnelId;
		this.hasOpenAiApiKey = true;
		const bridgeToken = await this.secrets.ensureAuthToken();
		await writeOpenAiTunnelConfig({
			profile: "gpt-bridge",
			tunnelId,
			bridgeToken,
			port: readConfig().port,
		});
		await this.globalState.update("gptBridge.onboardingComplete", true);
		this.onboardingComplete = true;
		this.editingSetup = false;
		void vscode.window.showInformationMessage(
			"GPT Bridge onboarding saved. Start the server when ready.",
		);
	}

	refresh(): void {
		this.render(this.store.current);
	}

	pushActivity(entry: ActivityEntry): void {
		const time = new Date().toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		this.activity = [{ ...entry, time }, ...this.activity].slice(
			0,
			MAX_ACTIVITY,
		);
		this.render(this.store.current);
	}

	render(state: BridgeState): void {
		if (this.view === undefined) {
			return;
		}
		this.view.webview.html = this.html(this.view.webview, state);
	}

	private html(webview: vscode.Webview, state: BridgeState): string {
		const nonce = crypto.randomBytes(16).toString("base64");
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'nonce-${nonce}'`,
			`script-src 'nonce-${nonce}'`,
		].join("; ");

		const config = readConfig();
		const running = state.status !== "stopped" && state.status !== "error";
		const showSetup = !this.onboardingComplete || this.editingSetup;

		const connectorUrl =
			state.tunnelUrl !== undefined
				? `${state.tunnelUrl}${MCP_ENDPOINT}`
				: state.port !== undefined
					? `http://127.0.0.1:${state.port}${MCP_ENDPOINT}`
					: undefined;

		// 터널 URL이 없는 상태는 두 가지이고 뜻이 정반대다.
		//   provider=cloudflare → 확장이 터널을 띄우려다 실패했다. 진짜 경고.
		//   provider=none       → 터널을 확장이 만들지 않는 구성이다. OpenAI Secure
		//                         MCP Tunnel처럼 외부 터널을 따로 띄워 쓰는 경우이며,
		//                         ChatGPT에서 접근이 될 수도 있다. 확장은 알 수 없다.
		// 둘을 같은 문구로 묶으면 정상 구성에 대고 "ChatGPT에서 접근할 수 없습니다"라고
		// 단언하게 된다. 상태 표시가 실제와 어긋나는 것은 그 자체로 문제다.
		const noTunnelUrl =
			state.tunnelUrl === undefined && connectorUrl !== undefined;
		const isLocalOnly = noTunnelUrl && config.tunnelProvider === "cloudflare";
		const isExternalTunnel = noTunnelUrl && config.tunnelProvider === "none";
		const quickTunnel = state.tunnelUrl?.includes("trycloudflare.com") === true;

		return `<!DOCTYPE html>
<html lang="${config.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style nonce="${nonce}">
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 10px 12px 16px;
    margin: 0;
  }
  section { margin-bottom: 16px; }
  section + section { border-top: 1px solid var(--vscode-panel-border); padding-top: 14px; }
  h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 8px; font-weight: 600;
  }
  .row { display: flex; align-items: center; gap: 8px; }
  .row.between { justify-content: space-between; }
  .connector-url-row { margin-bottom: 24px; }
  .status { font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: ${dotColor(state)}; flex: none; }
  .value {
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    background: var(--vscode-textCodeBlock-background);
    border-radius: 2px;
    padding: 3px 6px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    flex: 1; min-width: 0;
  }
  .muted { color: var(--vscode-descriptionForeground); }
  .warn {
    color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground));
    background: var(--vscode-inputValidation-warningBackground);
    border: 1px solid var(--vscode-inputValidation-warningBorder);
    border-radius: 2px; padding: 6px 8px; margin-top: 8px; line-height: 1.5;
  }
  /* 경고가 아니라 구성 안내. 정상 상태에 경고색을 쓰면 신호가 무뎌진다. */
  .info {
    color: var(--vscode-inputValidation-infoForeground, var(--vscode-foreground));
    background: var(--vscode-inputValidation-infoBackground);
    border: 1px solid var(--vscode-inputValidation-infoBorder);
    border-radius: 2px; padding: 6px 8px; margin-top: 8px; line-height: 1.5;
  }
  details.notice { border-radius: 2px; padding: 6px 8px; margin-top: 8px; line-height: 1.5; }
  details.notice > summary {
    cursor: pointer; list-style: none; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
  }
  details.notice > summary::-webkit-details-marker { display: none; }
  /* 접힘/펼침을 텍스트로 드러낸다. 화살표만으로는 눌러야 하는 줄인지 모른다. */
  details.notice > summary::before { content: '▸'; flex: none; font-size: 10px; }
  details.notice[open] > summary::before { content: '▾'; }
  details.notice > p { margin: 6px 0 0; }
  details.notice.warn {
    color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground));
    background: var(--vscode-inputValidation-warningBackground);
    border: 1px solid var(--vscode-inputValidation-warningBorder);
  }
  details.notice.info {
    color: var(--vscode-inputValidation-infoForeground, var(--vscode-foreground));
    background: var(--vscode-inputValidation-infoBackground);
    border: 1px solid var(--vscode-inputValidation-infoBorder);
  }
  label.field { display: block; font-size: 11px; margin: 10px 0 3px; color: var(--vscode-descriptionForeground); }
  button {
    padding: 4px 10px; border: none; border-radius: 2px; cursor: pointer;
    font-family: inherit; font-size: inherit; white-space: nowrap;
    color: var(--vscode-button-secondaryForeground);
    background: var(--vscode-button-secondaryBackground);
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.primary {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
  }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button.block { display: block; width: 100%; margin-bottom: 6px; }
  select, input { font-family: inherit; font-size: inherit; }
  input[type=text], input[type=password] {
    width: 100%; box-sizing: border-box; padding: 5px 6px;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
  }
  .path-row { display: flex; gap: 6px; }
  .path-row input { flex: 1; min-width: 0; }
  .setup-actions { display: flex; gap: 6px; margin-top: 10px; }
  .setup-actions button { flex: 1; }
  .setup-cancel { margin-top: 6px; width: 100%; }
  select {
    width: 100%; padding: 3px 4px;
    color: var(--vscode-dropdown-foreground);
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
  }
  .check { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
  ul.activity { list-style: none; margin: 0; padding: 0; }
  ul.activity li {
    display: flex; gap: 6px; align-items: baseline;
    padding: 3px 4px; border-radius: 2px; font-size: 11px; cursor: pointer;
  }
  ul.activity li:hover { background: var(--vscode-list-hoverBackground); }
  ul.activity li.blocked {
    background: var(--vscode-inputValidation-errorBackground);
    color: var(--vscode-inputValidation-errorForeground, var(--vscode-foreground));
  }
  ul.activity .time { color: var(--vscode-descriptionForeground); flex: none; }
  ul.activity .tool { font-weight: 600; flex: none; }
  ul.activity .detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  code {
    font-family: var(--vscode-editor-font-family);
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 4px; border-radius: 2px;
  }
</style>
</head>
<body>
  ${
		showSetup
			? `<section>
    <h2>${this.onboardingComplete ? "OpenAI 터널 설정 수정" : "GPT Bridge 시작 설정"}</h2>
    <p class="muted">OpenAI 터널 정보를 설정하면 GPT Bridge가 tunnel-client 프로필을 자동으로 생성합니다.</p>
    <label class="field" for="tunnelBin">tunnel-client 실행 파일 경로</label>
    <div class="path-row">
      <input id="tunnelBin" type="text" value="${escapeHtml(config.openaiTunnelBinPath ?? "")}" ${running ? "disabled" : ""}>
      <button id="browseTunnel" ${running ? "disabled" : ""}>찾아보기</button>
    </div>
    <label class="field" for="tunnelId">OpenAI 터널 ID</label>
    <input id="tunnelId" type="text" value="${escapeHtml(this.existingTunnelId ?? "")}" placeholder="tunnel_..." ${running ? "disabled" : ""}>
    <label class="field" for="apiKey">OpenAI API 키</label>
    <input id="apiKey" type="password" placeholder="${this.hasOpenAiApiKey ? "********" : "sk-..."}" ${running ? "disabled" : ""}>
    <p class="muted">Bridge 인증 토큰과 gpt-bridge.yaml 파일은 자동으로 생성됩니다.</p>
    <div class="setup-actions">
      <button id="saveSetup" class="primary" ${running ? "disabled" : ""}>설정 저장</button>
      <button id="onboardingHelp">❔ 도와줘</button>
    </div>
    ${this.onboardingComplete ? `<button id="closeSetup" class="setup-cancel">닫기</button>` : ""}
    <p class="muted" style="margin:6px 0 0; line-height:1.5">도움말 프롬프트를 복사한 뒤 ChatGPT에 붙여넣고 단계별 안내를 따라하세요.</p>
  </section>`
			: ""
	}
  ${this.onboardingComplete && !showSetup ? `<section><button id="editSetup" class="block">설정하기</button></section>` : ""}
  <section>
    <div class="row between">
      <span class="status"><span class="dot"></span>${escapeHtml(describe(state))}</span>
      <button class="${running ? "" : "primary"}" data-command="${running ? "gptBridge.stop" : "gptBridge.start"}">
        ${running ? t("panel.stop") : t("panel.start")}
      </button>
    </div>
    ${state.message === undefined ? "" : `<div class="warn">${escapeHtml(state.message)}</div>`}
  </section>

  <section>
    <h2>${t("panel.connector")}</h2>
    <label class="field">${t("panel.connectorUrl")}</label>
    <div class="row connector-url-row">
      <span class="value">${connectorUrl === undefined ? t("panel.notRunning") : escapeHtml(connectorUrl)}</span>
      <button data-command="gptBridge.copyUrl">${t("panel.copy")}</button>
    </div>




    <div>
      <button class="block primary" data-command="gptBridge.copyInstructions">${t("panel.copyInstructions")}</button>
    </div>

    ${
			isLocalOnly
				? notice(
						"warn",
						t("panel.localOnlySummary"),
						t("panel.localOnly"),
						true,
					)
				: ""
		}
    ${
			isExternalTunnel
				? notice(
						"info",
						t("panel.externalTunnelSummary"),
						t("panel.externalTunnel"),
						false,
					)
				: ""
		}
    ${
			quickTunnel
				? notice(
						"warn",
						t("panel.quickTunnelSummary"),
						t("panel.quickTunnel"),
						false,
					)
				: ""
		}
  </section>

  <section>
    <h2>${t("panel.behavior")}</h2>
    <label class="field" for="approval">${t("panel.approvalMode")}</label>
    <select id="approval">
      ${approvalOption("always", t("panel.modeAlways"), config.approvalMode)}
      ${approvalOption("session", t("panel.modeSession"), config.approvalMode)}
      ${approvalOption("pattern", t("panel.modePattern"), config.approvalMode)}
    </select>
    <div class="check">
      <input type="checkbox" id="autosave" ${config.autoSave ? "checked" : ""}>
      <label for="autosave">${t("panel.autoSave")}</label>
    </div>
    <p class="muted" style="margin:6px 0 0; line-height:1.5">
      ${escapeHtml(t("panel.autoSaveHint"))}
    </p>

    <label class="field" for="language">${t("panel.language")}</label>
    <select id="language">
      ${LANGUAGES.map((code) => languageOption(code, config.language)).join("")}
    </select>
    <p class="muted" style="margin:6px 0 0; line-height:1.5">
      ${escapeHtml(t("panel.languageHint"))}
    </p>
  </section>

  <section>
    <h2>${t("panel.activity")}</h2>
    ${
			this.activity.length === 0
				? `<p class="muted">${t("panel.noActivity")}</p>`
				: `<ul class="activity">${this.activity.map(activityRow).join("")}</ul>`
		}
  </section>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();

    document.getElementById('browseTunnel')?.addEventListener('click', () => {
      vscodeApi.postMessage({ type: 'browseTunnelClient' });
    });
    document.getElementById('onboardingHelp')?.addEventListener('click', () => {
      vscodeApi.postMessage({ type: 'copyOnboardingHelp' });
    });
    document.getElementById('editSetup')?.addEventListener('click', () => {
      vscodeApi.postMessage({ type: 'editSetup' });
    });
    document.getElementById('closeSetup')?.addEventListener('click', () => {
      vscodeApi.postMessage({ type: 'closeSetup' });
    });
    document.getElementById('saveSetup')?.addEventListener('click', () => {
      vscodeApi.postMessage({
        type: 'saveSetup',
        binPath: document.getElementById('tunnelBin').value,
        tunnelId: document.getElementById('tunnelId').value,
        apiKey: document.getElementById('apiKey').value
      });
    });
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'tunnelClientPicked') {
        const input = document.getElementById('tunnelBin');
        if (input) input.value = event.data.value;
      }
    });

    for (const button of document.querySelectorAll('button[data-command]')) {
      button.addEventListener('click', () => {
        vscodeApi.postMessage({ type: 'command', command: button.dataset.command });
      });
    }

    document.getElementById('approval').addEventListener('change', (event) => {
      vscodeApi.postMessage({ type: 'setApprovalMode', value: event.target.value });
    });

    document.getElementById('language').addEventListener('change', (event) => {
      vscodeApi.postMessage({ type: 'setLanguage', value: event.target.value });
    });

    document.getElementById('autosave').addEventListener('change', (event) => {
      vscodeApi.postMessage({ type: 'setAutoSave', value: event.target.checked });
    });

    for (const item of document.querySelectorAll('ul.activity li')) {
      item.addEventListener('click', () => {
        vscodeApi.postMessage({ type: 'showDetail' });
      });
    }
  </script>
</body>
</html>`;
	}
}

function approvalOption(
	value: ApprovalMode,
	label: string,
	current: ApprovalMode,
): string {
	return `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
}

/**
 * 접을 수 있는 안내 상자.
 *
 * 상태가 정상인데도 긴 설명이 항상 펼쳐져 있으면 패널의 다른 정보를 밀어낸다.
 * 제목만 보이게 접어 두되, 진짜 문제(터널 실패)는 펼친 채로 둔다 — 경고를
 * 접어 숨기면 알아차리지 못한다.
 */
function notice(
	kind: "warn" | "info",
	summary: string,
	body: string,
	open: boolean,
): string {
	return (
		`<details class="notice ${kind}"${open ? " open" : ""}>` +
		`<summary>${escapeHtml(summary)}</summary>` +
		`<p>${body}</p>` +
		`</details>`
	);
}

/** 언어 이름은 그 언어로 적는다. 못 읽는 언어로 표시하면 되돌아올 수 없다. */
function languageOption(value: Lang, current: Lang): string {
	const selected = value === current ? " selected" : "";
	return `<option value="${value}"${selected}>${LANGUAGE_LABELS[value]}</option>`;
}

function activityRow(entry: ActivityRow): string {
	const blocked = entry.blocked === true;
	const mark = blocked ? t("activity.blocked") : entry.ok ? "✓" : "✗";
	return (
		`<li class="${blocked ? "blocked" : ""}" title="${t("activity.detailHint")}">` +
		`<span class="time">${escapeHtml(entry.time)}</span>` +
		`<span class="tool">${escapeHtml(entry.tool)}</span>` +
		`<span class="detail">${escapeHtml(entry.detail)}</span>` +
		`<span>${mark}</span>` +
		`</li>`
	);
}

function describe(state: BridgeState): string {
	switch (state.status) {
		case "stopped":
			return t("state.stopped");
		case "starting":
			return t("state.starting");
		case "running":
			return t("state.running", state.port ?? "?");
		case "tunneled":
			return t("state.tunneled");
		case "error":
			return t("state.error");
	}
}

function dotColor(state: BridgeState): string {
	switch (state.status) {
		case "tunneled":
			return "var(--vscode-charts-green)";
		case "running":
			return "var(--vscode-charts-blue)";
		case "starting":
			return "var(--vscode-charts-yellow)";
		case "error":
			return "var(--vscode-charts-red)";
		case "stopped":
			return "var(--vscode-descriptionForeground)";
	}
}

type PanelMessage =
	| { type: "command"; command: string }
	| { type: "setApprovalMode"; value: ApprovalMode }
	| { type: "setAutoSave"; value: boolean }
	| { type: "setLanguage"; value: Lang }
	| { type: "showDetail" }
	| { type: "browseTunnelClient" }
	| { type: "copyOnboardingHelp" }
	| { type: "editSetup" }
	| { type: "closeSetup" }
	| { type: "saveSetup"; binPath: string; tunnelId: string; apiKey: string };

function isPanelMessage(value: unknown): value is PanelMessage {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const record = value as Record<string, unknown>;

	switch (record.type) {
		case "command":
			// gptBridge.* 명령만 허용한다. Webview가 임의의 VS Code 명령을 실행하게 두면 안 된다.
			return (
				typeof record.command === "string" &&
				record.command.startsWith("gptBridge.")
			);
		case "setApprovalMode":
			return (
				record.value === "always" ||
				record.value === "session" ||
				record.value === "pattern"
			);
		case "setAutoSave":
			return typeof record.value === "boolean";
		case "setLanguage":
			return typeof record.value === "string" && isLang(record.value);
		case "showDetail":
		case "browseTunnelClient":
		case "copyOnboardingHelp":
		case "editSetup":
		case "closeSetup":
			return true;
		case "saveSetup":
			return (
				typeof record.binPath === "string" &&
				typeof record.tunnelId === "string" &&
				typeof record.apiKey === "string"
			);
		default:
			return false;
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
