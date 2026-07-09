import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SkillEntry } from "@fm-web/shared";

/**
 * Runtime skill quick-action discovery: scans `.claude/skills/<id>/SKILL.md` and
 * `.agents/skills/<id>/SKILL.md` under a firstmate home - never hardcoded, per the plan. Read-only.
 */

const SKILL_ROOTS = [".agents", ".claude"] as const;
type SkillSource = (typeof SKILL_ROOTS)[number];

const BLOCK_SCALAR_INDICATORS = new Set([">", ">-", ">+", "|", "|-", "|+"]);

function isBlockScalarIndicator(value: string): boolean {
  return BLOCK_SCALAR_INDICATORS.has(value);
}

/**
 * A deliberately minimal frontmatter reader for SKILL.md's known shape: flat `key: value` pairs,
 * folded (`>`) or literal (`|`) block scalars for long descriptions, and one level of nested
 * mapping (`metadata:`) that this app does not need and simply skips over.
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const lines = content.split(/\r?\n/);
  if ((lines[0] ?? "").trim() !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  const block = lines.slice(1, end);
  const result: Record<string, string> = {};
  let i = 0;
  while (i < block.length) {
    const line = block[i] ?? "";
    if (line.trim() === "" || /^\s/.test(line)) {
      i++;
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):[ \t]?(.*)$/.exec(line);
    if (match === null) {
      i++;
      continue;
    }
    const key = match[1] as string;
    const rest = (match[2] ?? "").trim();
    i++;
    if (isBlockScalarIndicator(rest)) {
      const folded = rest.startsWith(">");
      const parts: string[] = [];
      while (i < block.length && /^\s+\S/.test(block[i] ?? "")) {
        parts.push((block[i] ?? "").trim());
        i++;
      }
      result[key] = folded ? parts.join(" ") : parts.join("\n");
      continue;
    }
    result[key] = rest;
  }
  return result;
}

function toSkillEntry(
  id: string,
  frontmatter: Record<string, string>,
  source: SkillSource,
): SkillEntry | null {
  const name = frontmatter["name"];
  const description = frontmatter["description"];
  if (name === undefined || name === "" || description === undefined || description === "") return null;
  return {
    id,
    name,
    description,
    userInvocable: frontmatter["user-invocable"] === "true",
    source,
  };
}

function readSkillsFrom(fmHome: string, source: SkillSource): Map<string, SkillEntry> {
  const dir = join(fmHome, source, "skills");
  const found = new Map<string, SkillEntry>();
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
  } catch {
    return found;
  }
  for (const id of names) {
    const skillPath = join(dir, id, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    let content: string;
    try {
      content = readFileSync(skillPath, "utf8");
    } catch {
      continue;
    }
    const frontmatter = parseFrontmatter(content);
    if (frontmatter === null) continue;
    const entry = toSkillEntry(id, frontmatter, source);
    if (entry !== null) found.set(id, entry);
  }
  return found;
}

/** `.claude/skills` wins over `.agents/skills` for the same id (mirrored content, per firstmate convention). */
export function discoverSkills(fmHome: string): SkillEntry[] {
  const merged = new Map<string, SkillEntry>();
  for (const source of SKILL_ROOTS)
    for (const [id, entry] of readSkillsFrom(fmHome, source)) merged.set(id, entry);
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}
