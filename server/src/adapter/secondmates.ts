import type { SecondmateEntry } from "@fm-web/shared";

// `- <id> - <summary> (home: <home>; scope: <scope>; projects: <csv>; added <date>)` (fm-home-seed.sh:799).
const LINE_RE =
  /^-\s*(\S+)\s*-\s*(.+?)\s*\(home:\s*([^;]+);\s*scope:\s*([^;]+);\s*projects:\s*([^;]*);\s*added\s+([^)]+)\)\s*$/;

/** Parse `data/secondmates.md`. Never write this file (safety contract). */
export function parseSecondmates(content: string): SecondmateEntry[] {
  const entries: SecondmateEntry[] = [];
  for (const line of content.split("\n")) {
    const match = LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, id, summary, home, scope, projectsCsv, added] = match as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const projects = projectsCsv
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    entries.push({ id, summary, home, scope, projects, added });
  }
  return entries;
}
