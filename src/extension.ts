import {
  commands,
  window,
  type ExtensionContext,
  type OutputChannel,
} from "vscode";

import { diagnose } from "./commands/diagnose";
import { disable } from "./commands/disable";
import { enable } from "./commands/enable";
import { reapply } from "./commands/reapply";
import { COMMANDS, OUTPUT_CHANNEL_NAME } from "./constants";
import { errorMessage } from "./errors";
import { reconcileOnActivation } from "./lifecycle";
import { OperationQueue } from "./operationQueue";

export function activate(context: ExtensionContext): void {
  const output = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const operations = new OperationQueue();
  context.subscriptions.push(
    output,
    commands.registerCommand(COMMANDS.enable, () =>
      operations.run(() =>
        runCommand(output, "Enable", () => enable(context, output)),
      ),
    ),
    commands.registerCommand(COMMANDS.disable, () =>
      operations.run(() =>
        runCommand(output, "Disable", () => disable(context, output)),
      ),
    ),
    commands.registerCommand(COMMANDS.reapply, () =>
      operations.run(() =>
        runCommand(output, "Reapply", () => reapply(context, output)),
      ),
    ),
    commands.registerCommand(COMMANDS.diagnose, () =>
      operations.run(() =>
        runCommand(output, "Diagnose", () => diagnose(context, output)),
      ),
    ),
  );

  void operations
    .run(() => reconcileOnActivation(context, output))
    .catch((error: unknown) => {
      output.appendLine(
        `Startup reconciliation failed safely: ${errorMessage(error)}`,
      );
    });
}

async function runCommand(
  output: OutputChannel,
  name: string,
  operation: () => Promise<void>,
): Promise<void> {
  output.appendLine(`[${new Date().toISOString()}] ${name} started.`);
  try {
    await operation();
  } catch (error) {
    const message = errorMessage(error);
    output.appendLine(`${name} failed: ${message}`);
    // The error has already been recorded. A passive error banner must not
    // prevent the user from correcting the cause and queueing a retry.
    void window
      .showErrorMessage(`macOS Traffic Lights: ${message}`)
      .then(undefined, (notificationError: unknown) => {
        output.appendLine(
          `Command error notification failed safely: ${errorMessage(notificationError)}`,
        );
      });
  }
}

export function deactivate(): void {
  // Settings and CSS registration intentionally persist until Disable is run.
}
