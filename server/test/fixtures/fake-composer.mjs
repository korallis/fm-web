// Minimal raw-mode fake composer harness for verified-submit integration tests: renders a
// `> <buffer>` prompt on one line, and only clears the buffer once at least CLEAR_AFTER Enters
// have been received, so tests can exercise the Enter-swallow-then-land retry path deterministically.
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

const clearAfter = Number(process.env.CLEAR_AFTER ?? "1");
let buffer = "";
let enters = 0;
let inPaste = false;

function render() {
  process.stdout.write(`\x1b[2K\r> ${buffer}`);
}

render();

function submittedText(value) {
  return value.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

function submitBuffer() {
  enters += 1;
  if (enters >= clearAfter) {
    process.stdout.write(`\nsubmitted:${submittedText(buffer)}\n`);
    buffer = "";
  }
}

process.stdin.on("data", (chunk) => {
  for (let i = 0; i < chunk.length; i += 1) {
    if (chunk.startsWith("\x1b[200~", i)) {
      inPaste = true;
      i += "\x1b[200~".length - 1;
      continue;
    }
    if (chunk.startsWith("\x1b[201~", i)) {
      inPaste = false;
      i += "\x1b[201~".length - 1;
      continue;
    }

    const ch = chunk[i];
    if (ch === "\r" || ch === "\n") {
      if (inPaste) buffer += ch;
      else submitBuffer();
    } else if (ch === "") {
      process.exit(0);
    } else {
      buffer += ch;
    }
  }
  render();
});
