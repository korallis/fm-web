import { describe, expect, it } from "vitest";
import { classifyComposerLine, isBusyFromTail, stripGhost } from "../../src/tmux/composerState.js";

const ESC = "\x1b";
const DIM_ON = `${ESC}[2m`;
const RESET = `${ESC}[0m`;
const NORMAL_INTENSITY = `${ESC}[22m`;

describe("stripGhost", () => {
  it("passes plain text through untouched", () => {
    expect(stripGhost("hello world")).toBe("hello world");
  });

  it("drops dim/faint runs", () => {
    expect(stripGhost(`> ${DIM_ON}ghost suggestion${RESET}`)).toBe("> ");
  });

  it("treats SGR 22 (normal intensity) the same as reset", () => {
    expect(stripGhost(`${DIM_ON}dim${NORMAL_INTENSITY}bright`)).toBe("bright");
  });

  it("keeps text styled with an indexed 256-color (38;5;n)", () => {
    expect(stripGhost(`${ESC}[38;5;208mhello${RESET}`)).toBe("hello");
  });

  it("keeps text styled with an RGB truecolor (38;2;r;g;b)", () => {
    expect(stripGhost(`${ESC}[38;2;255;0;0mhello${RESET}`)).toBe("hello");
  });

  it("drops non-SGR CSI sequences (e.g. cursor movement) entirely", () => {
    expect(stripGhost(`abc${ESC}[2Kdef`)).toBe("abcdef");
  });

  it("drops a lone/malformed escape byte without eating following text", () => {
    expect(stripGhost(`${ESC}Xhello`)).toBe("Xhello");
  });

  it("resets dim after 0;2 processed left-to-right within one sequence (reset then dim = dim)", () => {
    expect(stripGhost(`${ESC}[0;2mghost${RESET}`)).toBe("");
  });
});

describe("classifyComposerLine", () => {
  it("classifies a bare empty prompt as empty", () => {
    expect(classifyComposerLine("> ")).toBe("empty");
  });

  it("classifies a box-bordered empty composer as empty", () => {
    expect(classifyComposerLine("│ > │")).toBe("empty");
  });

  it("classifies a heavy-border empty composer as empty", () => {
    expect(classifyComposerLine("┃ ❯ ┃")).toBe("empty");
  });

  it("classifies real unsubmitted text as pending", () => {
    expect(classifyComposerLine("│ > hello there │")).toBe("pending");
  });

  it("classifies dim ghost/placeholder text inside an empty box as empty", () => {
    expect(classifyComposerLine(`│ > ${DIM_ON}try "/help"${RESET} │`)).toBe("empty");
  });

  it("classifies a busy footer landing on the cursor line as empty (not pending)", () => {
    expect(classifyComposerLine("  esc to interrupt")).toBe("empty");
    expect(classifyComposerLine("  Working...")).toBe("empty");
    expect(classifyComposerLine("  Ctrl+c:cancel")).toBe("empty");
  });

  it("honors a custom composer-idle regex override", () => {
    expect(classifyComposerLine("│ READY │", /^READY$/)).toBe("empty");
  });

  it("does not let a custom idle regex swallow real pending text", () => {
    expect(classifyComposerLine("│ hello │", /^READY$/)).toBe("pending");
  });
});

describe("isBusyFromTail", () => {
  it("detects a busy footer within the last 6 non-blank lines", () => {
    const tail = ["some output", "", "more output", "esc to interrupt"].join("\n");
    expect(isBusyFromTail(tail)).toBe(true);
  });

  it("returns false when no busy footer is present", () => {
    const tail = ["some output", "", "> "].join("\n");
    expect(isBusyFromTail(tail)).toBe(false);
  });

  it("ignores a busy footer outside the tail window", () => {
    const lines = ["esc to interrupt", ...Array.from({ length: 10 }, (_, i) => `line ${i}`)];
    expect(isBusyFromTail(lines.join("\n"))).toBe(false);
  });
});
