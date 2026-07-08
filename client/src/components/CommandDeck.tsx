import { Composer } from "./Composer";
import { ResponseTerminal } from "./ResponseTerminal";
import { useSessionSocket } from "../api/useSessionSocket";

export interface CommandDeckProps {
  fmHome: string | undefined;
}

/** The interactive spine: a busy-aware verified-submit composer over the app-owned first-mate
 * session, streamed live into a response terminal. Every instruction path converges here. */
export function CommandDeck({ fmHome }: CommandDeckProps) {
  const { composerState, subscribeTerminal } = useSessionSocket();

  return (
    <div className="flex flex-col gap-4">
      <ResponseTerminal subscribeTerminal={subscribeTerminal} />
      <Composer fmHome={fmHome} composerState={composerState} />
    </div>
  );
}
