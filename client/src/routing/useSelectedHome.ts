import { useCallback, useState } from "react";

const STORAGE_KEY = "fm-deck.selected-home";

/** Which discovered home the Bridge/task-detail views read - a navigation convenience, so it
 * lives in localStorage like composer drafts, not in the URL. Defaults to the booted primary. */
export function useSelectedHomeId(): [string, (id: string) => void] {
  const [homeId, setHomeIdState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "primary");

  const setHomeId = useCallback((id: string): void => {
    setHomeIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return [homeId, setHomeId];
}
