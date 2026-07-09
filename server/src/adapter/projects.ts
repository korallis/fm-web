import type { ProjectEntry } from "@fm-web/shared";

// `- <name> [<mode> +yolo] - <description> (added <date>)`; bracket is optional (defaults to no-mistakes).
const LINE_RE = /^-\s*(\S+)\s*(?:\[([^\]]*)\])?\s*-\s*(.+?)\s*\(added\s+([^)]+)\)\s*$/;

/** Parse `data/projects.md` - the project registry. Mode is read-only; edit via the first mate. */
export function parseProjects(content: string): ProjectEntry[] {
  const entries: ProjectEntry[] = [];
  for (const line of content.split("\n")) {
    const match = LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, name, bracket, description, added] = match as unknown as [
      string,
      string,
      string | undefined,
      string,
      string,
    ];
    const tokens = (bracket ?? "").trim().split(/\s+/).filter(Boolean);
    const yolo = tokens.some((t) => t.toLowerCase() === "+yolo");
    const mode = tokens.find((t) => t.toLowerCase() !== "+yolo") ?? "no-mistakes";
    entries.push({ name, mode, yolo, description, added });
  }
  return entries;
}
