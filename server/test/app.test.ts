import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { FleetSnapshot, TaskDetail } from "@fm-web/shared";
import { createApp } from "../src/app.js";
import { DEFAULT_TIMING } from "../src/adapter/timing.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fm-home");

describe("createApp", () => {
  it("uses configured timing and captain relevance for REST snapshots", async () => {
    const app = createApp(FIXTURE_HOME, {
      timing: { ...DEFAULT_TIMING, guardGraceSeconds: 7 },
      captainRegex: /only-this-word/i,
    });

    const response = await app.request("/api/fleet");
    const body = (await response.json()) as FleetSnapshot;

    expect(body.supervision.timing.guardGraceSeconds).toBe(7);
    expect(body.tasks.find((task) => task.id === "task-a1")?.captainRelevant).toBe(false);
  });

  it("serves task detail for a known id", async () => {
    const app = createApp(FIXTURE_HOME);

    const response = await app.request("/api/tasks/task-b2");
    const body = (await response.json()) as TaskDetail;

    expect(response.status).toBe(200);
    expect(body.id).toBe("task-b2");
    expect(body.statusHistory.length).toBeGreaterThan(0);
  });

  it("404s task detail for an unknown id", async () => {
    const app = createApp(FIXTURE_HOME);

    const response = await app.request("/api/tasks/no-such-task");

    expect(response.status).toBe(404);
  });

  it("400s task detail ids that are not a single safe path segment", async () => {
    const app = createApp(FIXTURE_HOME);

    const slashResponse = await app.request("/api/tasks/..%2Ftask-b2");
    const backslashResponse = await app.request("/api/tasks/task%5Cb2");

    expect(slashResponse.status).toBe(400);
    expect(backslashResponse.status).toBe(400);
  });
});
