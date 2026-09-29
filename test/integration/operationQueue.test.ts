import { describe, expect, it } from "vitest";

import { OperationQueue } from "../../src/operationQueue";

describe("operation queue", () => {
  it("serializes startup reconciliation and command mutations", async () => {
    const queue = new OperationQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const startup = queue.run(async () => {
      events.push("startup-begin");
      await firstGate;
      events.push("startup-end");
    });
    const disable = queue.run(() => {
      events.push("disable");
      return Promise.resolve();
    });

    await Promise.resolve();
    expect(events).toEqual(["startup-begin"]);
    releaseFirst?.();
    await Promise.all([startup, disable]);
    expect(events).toEqual(["startup-begin", "startup-end", "disable"]);
  });

  it("continues after a failed operation", async () => {
    const queue = new OperationQueue();
    const failure = queue.run(() =>
      Promise.reject(new Error("expected test failure")),
    );
    const success = queue.run(() => Promise.resolve("continued"));
    await expect(failure).rejects.toThrow("expected test failure");
    await expect(success).resolves.toBe("continued");
  });
});
