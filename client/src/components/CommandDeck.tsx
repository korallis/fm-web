import { Composer } from "./Composer";
import { ResponseTerminal } from "./ResponseTerminal";
import { useSessionSocket } from "../api/useSessionSocket";
import type { ComposerLocalState } from "../composer/useComposerLocalState";

export interface CommandDeckProps {
  fmHome: string | undefined;
  composerLocalState: ComposerLocalState;
}

/** The interactive spine: a busy-aware verified-submit composer over the app-owned first-mate
 * session, streamed live into a response terminal. Every instruction path converges here. */
export function CommandDeck({ fmHome, composerLocalState }: CommandDeckProps) {
  const { composerState, subscribeTerminal } = useSessionSocket();

  return (
    <div className="flex flex-col gap-4">
      <ResponseTerminal subscribeTerminal={subscribeTerminal} />
      <Composer fmHome={fmHome} composerState={composerState} composerLocalState={composerLocalState} />
    </div>
  );
}
