import { describe, expect, it, vi } from "vitest";
import type { PaneTailer } from "../../src/tmux/paneStream.js";
import { bootstrapCommandDeck, type BootstrapCommandDeckDeps } from "../../src/commandDeck/bootstrap.js";

function makeDeps(overrides: Partial<BootstrapCommandDeckDeps> = {}): BootstrapCommandDeckDeps {
  return {
    ensureSession: vi.fn().mockResolvedValue({ target: "fm-deck-test:main", created: true }),
    ensureStream: vi.fn().mockResolvedValue("/tmp/fm-deck-test.log"),
    createTailer: vi.fn(
      () =>
        ({
          start: vi.fn(),
          onChunk: vi.fn(),
        }) as unknown as PaneTailer,
    ),
    killSession: vi.fn().mockResolvedValue(undefined),
    logger: { log: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

describe("bootstrapCommandDeck", () => {
  it("kills a newly-created session when stream setup fails", async () => {
    const deps = makeDeps({
      ensureStream: vi.fn().mockRejectedValue(new Error("pipe failed")),
    });

    const result = await bootstrapCommandDeck("/fm-home", "agent", deps);

    expect(result).toEqual({ target: null, tailer: null });
    expect(deps.killSession).toHaveBeenCalledWith("fm-deck-test");
  });

  it("does not kill a reused session when stream setup fails", async () => {
    const deps = makeDeps({
      ensureSession: vi.fn().mockResolvedValue({ target: "fm-deck-test:main", created: false }),
      ensureStream: vi.fn().mockRejectedValue(new Error("pipe failed")),
    });

    const result = await bootstrapCommandDeck("/fm-home", "agent", deps);

    expect(result).toEqual({ target: null, tailer: null });
    expect(deps.killSession).not.toHaveBeenCalled();
  });
});
