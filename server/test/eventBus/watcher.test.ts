import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { watchFmHome } from "../../src/eventBus/watcher.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");

describe("watchFmHome", () => {
  it("logs watcher errors instead of leaving error events unhandled", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const watcher = watchFmHome(FIXTURE_HOME, () => undefined, 10);
    try {
      expect(watcher.listenerCount("error")).toBeGreaterThan(0);
      expect(watcher.emit("error", new Error("watch failed"))).toBe(true);
      expect(error).toHaveBeenCalledWith("FM home watcher error", expect.any(Error));
    } finally {
      await watcher.close();
      error.mockRestore();
    }
  });
});
