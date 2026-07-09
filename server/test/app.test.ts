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

  it("lists discoverable homes with the command deck's bound home id", async () => {
    const app = createApp(FIXTURE_HOME);

    const response = await app.request("/api/homes");
    const body = (await response.json()) as { commandDeckHomeId: string; homes: { id: string }[] };

    expect(body.commandDeckHomeId).toBe("primary");
    expect(body.homes.map((home) => home.id)).toEqual(["primary", "demo-secondmate"]);
  });

  it("serves a fleet snapshot for a registered secondmate home via ?home=", async () => {
    const app = createApp(FIXTURE_HOME);

    const response = await app.request("/api/fleet?home=demo-secondmate");
    const body = (await response.json()) as FleetSnapshot;

    expect(body.fmHome).toBe("/tmp/fixture-home-secondmate");
  });

  it("400s an unknown ?home= id", async () => {
    const app = createApp(FIXTURE_HOME);

    const response = await app.request("/api/fleet?home=no-such-home");

    expect(response.status).toBe(400);
  });

  it("400s task detail for an unknown ?home= id", async () => {
    const app = createApp(FIXTURE_HOME);

    const response = await app.request("/api/tasks/task-b2?home=no-such-home");

    expect(response.status).toBe(400);
  });
});
