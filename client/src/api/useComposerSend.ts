import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ComposerSendResult } from "@fm-web/shared";

async function sendComposerText(text: string): Promise<ComposerSendResult> {
  const res = await fetch("/api/composer/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return (await res.json()) as ComposerSendResult;
}

export function useComposerSend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendComposerText,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["composerState"] }),
  });
}

export async function interruptSession(): Promise<{ sent: boolean }> {
  const res = await fetch("/api/session/interrupt", { method: "POST" });
  return (await res.json()) as { sent: boolean };
}
