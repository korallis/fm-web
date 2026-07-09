import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

const { sendLiteral } = await import("../../src/tmux/tmuxClient.js");

type ExecFileCallback = (error: { code?: number } | null, stdout: string, stderr: string) => void;

function mockTmuxSuccess(): void {
  execFileMock.mockImplementation(
    (_file: string, _args: string[], _options: { encoding: string }, callback: ExecFileCallback) => {
      callback(null, "", "");
    },
  );
}

describe("sendLiteral", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    mockTmuxSuccess();
  });

  it("sends single-line text unchanged", async () => {
    await expect(sendLiteral("deck:main", "hello")).resolves.toBe(true);

    expect(execFileMock).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "deck:main", "-l", "--", "hello"],
      { encoding: "utf8" },
      expect.any(Function),
    );
  });

  it("wraps multiline text in bracketed paste markers", async () => {
    await expect(sendLiteral("deck:main", "hello\nworld")).resolves.toBe(true);

    expect(execFileMock).toHaveBeenCalledWith(
      "tmux",
      ["send-keys", "-t", "deck:main", "-l", "--", "\x1b[200~hello\nworld\x1b[201~"],
      { encoding: "utf8" },
      expect.any(Function),
    );
  });
});
