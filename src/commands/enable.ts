import type { ExtensionContext, OutputChannel } from "vscode";

import { executeApply } from "./apply";

export async function enable(
  context: ExtensionContext,
  output: OutputChannel,
): Promise<void> {
  await executeApply(context, output, "enable");
}
