import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux/tmuxClient.js", () => ({
  capturePaneVisibleAnsi: vi.fn(),
  pipePaneAppend: vi.fn(),
}));

const tmuxClient = await import("../../src/tmux/tmuxClient.js");
const { ensurePaneStream } = await import("../../src/tmux/paneStream.js");

describe("ensurePaneStream failure handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when tmux refuses to start the pane pipe", async () => {
    vi.mocked(tmuxClient.pipePaneAppend).mockResolvedValue(false);

    await expect(ensurePaneStream("missing-session:main", "missing-session")).rejects.toThrow(
      "tmux pipe-pane failed",
    );
  });
});
