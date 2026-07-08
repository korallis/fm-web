import { watch, type FSWatcher } from "chokidar";
import { dataDir, stateDir } from "../adapter/paths.js";

/**
 * Watch `state/` + `data/` under a firstmate home, debouncing bursts of writes into a single
 * `onChange` call. Read-only: never touches watcher-internal files itself.
 */
export function watchFmHome(fmHome: string, onChange: () => void, debounceMs = 300): FSWatcher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  const watcher = watch([stateDir(fmHome), dataDir(fmHome)], {
    ignoreInitial: true,
    persistent: true,
  });
  watcher.on("all", debounced);
  watcher.on("error", (error) => {
    console.error("FM home watcher error", error);
  });
  return watcher;
}
