// Minimal raw-mode fake composer harness for verified-submit integration tests: renders a
// `> <buffer>` prompt on one line, and only clears the buffer once at least CLEAR_AFTER Enters
// have been received, so tests can exercise the Enter-swallow-then-land retry path deterministically.
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

const clearAfter = Number(process.env.CLEAR_AFTER ?? "1");
let buffer = "";
let enters = 0;

function render() {
  process.stdout.write(`\x1b[2K\r> ${buffer}`);
}

render();

process.stdin.on("data", (chunk) => {
  for (const ch of chunk) {
    if (ch === "\r" || ch === "\n") {
      enters += 1;
      if (enters >= clearAfter) buffer = "";
    } else if (ch === "") {
      process.exit(0);
    } else {
      buffer += ch;
    }
  }
  render();
});
