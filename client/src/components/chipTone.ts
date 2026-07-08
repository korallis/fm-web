import type { ChipTone } from "./StateChip";

const VERB_TONE: Record<string, ChipTone> = {
  working: "accent",
  done: "done",
  "needs-decision": "warn",
  blocked: "warn",
  failed: "danger",
  unknown: "neutral",
};

export function toneForVerb(verb: string): ChipTone {
  return VERB_TONE[verb] ?? "neutral";
}
