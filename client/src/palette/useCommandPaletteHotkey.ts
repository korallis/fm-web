import { useEffect, useState } from "react";

/** Toggles the command palette on Cmd+K (mac) / Ctrl+K (elsewhere), from anywhere in the app. */
export function useCommandPaletteHotkey(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return [open, setOpen];
}
