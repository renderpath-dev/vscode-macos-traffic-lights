import type { ExtensionContext, OutputChannel } from "vscode";

import { executeApply } from "./apply";

export async function reapply(
  context: ExtensionContext,
  output: OutputChannel,
): Promise<void> {
  await executeApply(context, output, "reapply");
}
