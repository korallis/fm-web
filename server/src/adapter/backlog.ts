import type { Backlog, BacklogDoneTask, BacklogTask, BlockedBy } from "@fm-web/shared";

interface ParenField {
  key: string;
  value: string;
}

/**
 * Extracts parenthetical field groups, returning the remaining text with them removed.
 * Covers both spellings seen in the wild: `(repo: <name>)` / `(kind: <ship|scout>)` with a
 * colon, and `(since <date>)` / `(done|merged|reported <date>)` without one.
 */
function parseParenFieldGroup(content: string): ParenField[] | null {
  const fields: ParenField[] = [];
  for (const segment of content.split(",")) {
    const match = /^\s*([a-zA-Z][a-zA-Z-]*)(?::\s*|\s+)(.+?)\s*$/.exec(segment);
    if (!match) return null;
    const [, key, value] = match as unknown as [string, string, string];
    fields.push({ key: key.toLowerCase(), value });
  }
  return fields;
}

function extractParenFields(text: string): { fields: ParenField[]; rest: string } {
  const fields: ParenField[] = [];
  const rest = text.replace(/\(([^()]*)\)/g, (match, content: string) => {
    const groupFields = parseParenFieldGroup(content);
    if (groupFields === null) return match;
    fields.push(...groupFields);
    return " ";
  });
  return { fields, rest };
}

function fieldValue(fields: readonly ParenField[], key: string): string | undefined {
  return fields.find((f) => f.key === key)?.value;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractBlockedBy(text: string): { blockedBy: BlockedBy | undefined; rest: string } {
  const re = /blocked-by:\s*(\S+)(?:\s*-\s*(.+))?$/;
  const match = re.exec(text);
  if (!match) return { blockedBy: undefined, rest: text };
  const [whole, id, reason] = match as unknown as [string, string, string | undefined];
  return {
    blockedBy: { id, reason: reason?.trim() ?? "" },
    rest: text.slice(0, match.index) + text.slice(match.index + whole.length),
  };
}

function removeTokenWithSeparator(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const separatorBefore = /\s+-\s*$/.exec(before);
  if (separatorBefore) return before.slice(0, before.length - separatorBefore[0].length) + after;
  const separatorAfter = /^\s+-\s*/.exec(after);
  if (separatorAfter) return before + after.slice(separatorAfter[0].length);
  return before + after;
}

function extractMergeTarget(text: string): { mergeTarget: string | undefined; rest: string } {
  const url = /(https?:\/\/\S+)/.exec(text);
  if (url) {
    const [whole] = url as unknown as [string];
    return { mergeTarget: whole, rest: removeTokenWithSeparator(text, url.index, whole.length) };
  }
  const report = /(data\/\S+\/report\.md)/.exec(text);
  if (report) {
    const [whole] = report as unknown as [string];
    return {
      mergeTarget: whole,
      rest: removeTokenWithSeparator(text, report.index, whole.length),
    };
  }
  const localMain = /\blocal main\b/.exec(text);
  if (localMain) {
    const [whole] = localMain as unknown as [string];
    return {
      mergeTarget: "local main",
      rest: removeTokenWithSeparator(text, localMain.index, whole.length),
    };
  }
  return { mergeTarget: undefined, rest: text };
}

const CHECKBOX_ITEM_RE = /^-\s*\[([ x])\]\s*(\S+)\s*-\s*(.+)$/;
const BOLD_ITEM_RE = /^-\s*\*\*(\S+?)\*\*\s*-\s*(.+)$/;
const DATE_KEYS = ["done", "merged", "reported"] as const;

function parseOpenItem(id: string, body: string): BacklogTask {
  const { fields, rest: afterParens } = extractParenFields(body);
  const { blockedBy, rest: afterBlockedBy } = extractBlockedBy(afterParens);
  const task: BacklogTask = { id, description: collapseWhitespace(afterBlockedBy) };
  const repo = fieldValue(fields, "repo");
  const kindTag = fieldValue(fields, "kind");
  const since = fieldValue(fields, "since");
  if (repo !== undefined) task.repo = repo;
  if (kindTag !== undefined) task.kindTag = kindTag;
  if (since !== undefined) task.since = since;
  if (blockedBy !== undefined) task.blockedBy = blockedBy;
  return task;
}

function isIndentedContinuation(line: string): boolean {
  return /^\s+\S/.test(line) && !/^\s*-\s*\[[ x]\]/.test(line);
}

function parseDoneItem(id: string, body: string, continuation: string | undefined): BacklogDoneTask {
  const { fields, rest: afterParens } = extractParenFields(body);
  const extracted = extractMergeTarget(afterParens);
  const rest = extracted.rest;
  // A continuation line (e.g. "  local main (demo-repo)") IS the merge target verbatim,
  // not another field to strip parens from.
  const mergeTarget = extracted.mergeTarget ?? continuation;
  const task: BacklogDoneTask = { id, description: collapseWhitespace(rest) };
  const repo = fieldValue(fields, "repo");
  const kindTag = fieldValue(fields, "kind");
  if (repo !== undefined) task.repo = repo;
  if (kindTag !== undefined) task.kindTag = kindTag;
  if (mergeTarget !== undefined) task.mergeTarget = mergeTarget;
  for (const dateKey of DATE_KEYS) {
    const value = fieldValue(fields, dateKey);
    if (value !== undefined) {
      task.dateLabel = dateKey;
      task.date = value;
      break;
    }
  }
  return task;
}

/** Parse `data/backlog.md` — `## In flight` / `## Queued` / `## Done` sections, tasks-axi-managed. */
export function parseBacklog(content: string): Backlog {
  const lines = content.split("\n");
  const backlog: Backlog = { inFlight: [], queued: [], done: [] };
  let section: "inFlight" | "queued" | "done" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading?.[1] !== undefined) {
      const title = heading[1].toLowerCase();
      if (title === "in flight") section = "inFlight";
      else if (title === "queued") section = "queued";
      else if (title === "done") section = "done";
      else section = null;
      continue;
    }
    if (section === null) continue;

    const checkboxItem = CHECKBOX_ITEM_RE.exec(line);
    if (checkboxItem) {
      const [, box, id, body] = checkboxItem as unknown as [string, string, string, string];
      if (box === "x") {
        let continuation: string | undefined;
        const next = lines[i + 1];
        if (next !== undefined && isIndentedContinuation(next)) {
          continuation = next.trim();
          i++;
        }
        backlog.done.push(parseDoneItem(id, body, continuation));
      } else {
        const parsed = parseOpenItem(id, body);
        if (section === "inFlight") backlog.inFlight.push(parsed);
        else if (section === "queued") backlog.queued.push(parsed);
      }
      continue;
    }

    const boldItem = BOLD_ITEM_RE.exec(line);
    if (!boldItem || section !== "inFlight") continue;
    const [, id, body] = boldItem as unknown as [string, string, string];
    backlog.inFlight.push(parseOpenItem(id, body));
  }

  return backlog;
}
