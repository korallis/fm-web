import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux/tmuxClient.js", () => ({
  capturePaneLineAnsi: vi.fn(),
  cursorY: vi.fn(),
  sendKey: vi.fn(),
  sendLiteral: vi.fn(),
}));

const tmuxClient = await import("../../src/tmux/tmuxClient.js");
const { submitText } = await import("../../src/tmux/submit.js");

describe("submitText failure handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports send-failed when Enter cannot be delivered after literal text", async () => {
    vi.mocked(tmuxClient.sendLiteral).mockResolvedValue(true);
    vi.mocked(tmuxClient.sendKey).mockResolvedValue(false);

    const verdict = await submitText("deck:main", "hello", {
      enterSleepMs: 0,
      postSubmitSettleMs: 0,
      settleMs: 0,
    });

    expect(verdict).toBe("send-failed");
    expect(tmuxClient.cursorY).not.toHaveBeenCalled();
  });
});
