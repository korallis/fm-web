import { useEffect, useState } from "react";

/**
 * Composer drafts + prompt history are UI convenience state, not fleet domain truth — they live in
 * the browser (namespaced per `fmHome`), never on disk under a firstmate home.
 */

const MAX_HISTORY = 50;

function draftKey(fmHome: string): string {
  return `fm-deck.composer.draft:${fmHome}`;
}

function historyKey(fmHome: string): string {
  return `fm-deck.composer.history:${fmHome}`;
}

function readHistory(fmHome: string): string[] {
  try {
    const raw = localStorage.getItem(historyKey(fmHome));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export interface ComposerLocalState {
  draft: string;
  setDraft: (value: string) => void;
  history: string[];
  /** Appends to history and clears the draft (call after a successful send). */
  pushHistory: (text: string) => void;
}

export function useComposerLocalState(fmHome: string | undefined): ComposerLocalState {
  const [draft, setDraftState] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (fmHome === undefined) return;
    setDraftState(localStorage.getItem(draftKey(fmHome)) ?? "");
    setHistory(readHistory(fmHome));
  }, [fmHome]);

  const setDraft = (value: string): void => {
    setDraftState(value);
    if (fmHome !== undefined) localStorage.setItem(draftKey(fmHome), value);
  };

  const pushHistory = (text: string): void => {
    setDraftState("");
    if (fmHome === undefined) return;
    localStorage.setItem(draftKey(fmHome), "");
    setHistory((prev) => {
      const next = [...prev.filter((entry) => entry !== text), text].slice(-MAX_HISTORY);
      localStorage.setItem(historyKey(fmHome), JSON.stringify(next));
      return next;
    });
  };

  return { draft, setDraft, history, pushHistory };
}
