import { spawn, type ChildProcess } from "node:child_process";

import type { TunnelLogger, TunnelStatus } from "./TunnelManager";

const SIGKILL_DELAY_MS = 5_000;

export interface OpenAiTunnelOptions {
	readonly binPath: string;
	readonly profile: string;
	readonly apiKey?: string;
	readonly log: TunnelLogger;
	readonly onStatus: (status: TunnelStatus, message?: string) => void;
}

export class OpenAiTunnelManager {
	private child: ChildProcess | undefined;
	private stopping = false;

	constructor(private readonly options: OpenAiTunnelOptions) {}

	get isRunning(): boolean {
		return this.child !== undefined;
	}

	start(): void {
		if (this.child !== undefined) {
			return;
		}

		this.stopping = false;
		this.options.onStatus("starting");

		const child = spawn(
			this.options.binPath,
			["run", "--profile", this.options.profile],
			{
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
				env:
					this.options.apiKey === undefined
						? process.env
						: { ...process.env, OPENAI_API_KEY: this.options.apiKey },
			},
		);
		this.child = child;

		const scan = (data: Buffer): void => {
			for (const line of data.toString("utf8").split("\n")) {
				if (line.trim().length > 0) {
					this.options.log.info(`[tunnel-client] ${line.trim()}`);
				}
			}
		};

		child.stdout?.on("data", scan);
		child.stderr?.on("data", scan);

		child.once("spawn", () => {
			this.options.log.info(
				`OpenAI tunnel-client started with profile "${this.options.profile}" (pid ${child.pid ?? "unknown"})`,
			);
			this.options.onStatus("connected");
		});

		child.on("error", (error) => {
			this.child = undefined;
			this.options.log.error(
				`Failed to run OpenAI tunnel-client: ${error.message}`,
			);
			this.options.onStatus("failed", error.message);
		});

		child.on("exit", (code, signal) => {
			this.child = undefined;
			if (this.stopping) {
				this.options.onStatus("stopped");
				return;
			}

			const message = `OpenAI tunnel-client exited (code=${code}, signal=${signal})`;
			this.options.log.warn(message);
			this.options.onStatus("failed", message);
		});
	}

	async stop(): Promise<void> {
		this.stopping = true;
		const child = this.child;
		this.child = undefined;

		if (child === undefined || child.exitCode !== null) {
			this.options.onStatus("stopped");
			return;
		}

		if (process.platform === "win32") {
			await this.killProcessTreeWindows(child);
		} else {
			await this.killProcess(child);
		}

		this.options.onStatus("stopped");
	}

	private killProcess(child: ChildProcess): Promise<void> {
		return new Promise((resolve) => {
			const done = (): void => {
				clearTimeout(killTimer);
				resolve();
			};

			const killTimer = setTimeout(() => {
				if (child.exitCode === null) {
					child.kill("SIGKILL");
				}
				resolve();
			}, SIGKILL_DELAY_MS);

			child.once("exit", done);
			child.kill("SIGTERM");
		});
	}

	private killProcessTreeWindows(child: ChildProcess): Promise<void> {
		const pid = child.pid;
		if (pid === undefined) {
			child.kill();
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			const settle = (): void => {
				clearTimeout(fallbackTimer);
				resolve();
			};

			const fallbackTimer = setTimeout(() => {
				if (child.exitCode === null) {
					child.kill();
				}
				resolve();
			}, SIGKILL_DELAY_MS);

			const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
				stdio: "ignore",
				windowsHide: true,
			});

			killer.on("error", (error) => {
				this.options.log.warn(
					`taskkill failed: ${error.message}. Falling back to a direct kill.`,
				);
				child.kill();
				settle();
			});

			killer.on("exit", () => {
				this.options.log.info(
					`Terminated the OpenAI tunnel-client process tree (pid ${pid})`,
				);
				settle();
			});
		});
	}
}
