import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux/tmuxClient.js", () => ({
  capturePaneTail: vi.fn(),
  hasSession: vi.fn(),
  newSession: vi.fn(),
  panePid: vi.fn(),
}));

const tmuxClient = await import("../../src/tmux/tmuxClient.js");
const { ensureFirstMateSession } = await import("../../src/tmux/sessionManager.js");

describe("ensureFirstMateSession failure handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when tmux new-session fails", async () => {
    vi.mocked(tmuxClient.hasSession).mockResolvedValue(false);
    vi.mocked(tmuxClient.newSession).mockResolvedValue({ code: 1, stdout: "", stderr: "tmux failed" });

    await expect(ensureFirstMateSession("/tmp/fm-web-test-home", "sleep 30")).rejects.toThrow(
      "tmux new-session failed: tmux failed",
    );
  });
});
