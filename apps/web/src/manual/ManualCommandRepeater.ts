export interface ManualCommand {
  vx: number;
  wz: number;
  brake?: boolean;
}

export interface ManualCommandRepeaterOptions {
  intervalMs: number;
  sendCommand(command: ManualCommand): void | Promise<void>;
  sendStop(): void | Promise<void>;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export class ManualCommandRepeater {
  readonly #intervalMs: number;
  readonly #sendCommand: (command: ManualCommand) => void | Promise<void>;
  readonly #sendStop: () => void | Promise<void>;
  readonly #setInterval: typeof setInterval;
  readonly #clearInterval: typeof clearInterval;
  #intervalId: ReturnType<typeof setInterval> | null = null;
  #activeCommand: ManualCommand | null = null;

  public constructor(options: ManualCommandRepeaterOptions) {
    this.#intervalMs = options.intervalMs;
    this.#sendCommand = options.sendCommand;
    this.#sendStop = options.sendStop;
    this.#setInterval = options.setIntervalFn ?? setInterval;
    this.#clearInterval = options.clearIntervalFn ?? clearInterval;
  }

  public start(command: ManualCommand): void {
    this.cancel();
    this.#activeCommand = command;
    void this.#sendCommand(command);
    this.#intervalId = this.#setInterval(() => {
      if (this.#activeCommand) {
        void this.#sendCommand(this.#activeCommand);
      }
    }, this.#intervalMs);
  }

  public stopAndSendStop(): void {
    if (!this.#activeCommand) {
      return;
    }

    this.cancel();
    void this.#sendStop();
  }

  public cancel(): void {
    if (this.#intervalId !== null) {
      this.#clearInterval(this.#intervalId);
    }
    this.#intervalId = null;
    this.#activeCommand = null;
  }

  public isRunning(): boolean {
    return this.#activeCommand !== null;
  }
}
