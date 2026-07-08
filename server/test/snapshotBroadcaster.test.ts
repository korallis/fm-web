import { describe, expect, it } from "vitest";
import type { FleetSnapshot } from "@fm-web/shared";
import { SnapshotBroadcaster } from "../src/snapshotBroadcaster.js";
import { DEFAULT_TIMING } from "../src/adapter/timing.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

class FakeClient {
  readonly messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => {
      if (resolvePromise === undefined) throw new Error("deferred promise was not initialized");
      resolvePromise(value);
    },
  };
}

function snapshot(generatedAtMs: number): FleetSnapshot {
  return {
    generatedAtMs,
    fmHome: "/tmp/fm-home",
    tasks: [],
    backlog: { inFlight: [], queued: [], done: [] },
    projects: [],
    secondmates: [],
    supervision: {
      lock: { pid: null, alive: null },
      beaconLastBeatMs: null,
      beaconAgeSeconds: null,
      beaconFresh: false,
      afk: false,
      timing: DEFAULT_TIMING,
    },
  };
}

function messageTimestamps(client: FakeClient): number[] {
  return client.messages.map((message) => (JSON.parse(message) as FleetSnapshot).generatedAtMs);
}

describe("SnapshotBroadcaster", () => {
  it("serializes builds and drops a stale in-flight delivery after a newer request", async () => {
    const builds: Deferred<FleetSnapshot>[] = [];
    const broadcaster = new SnapshotBroadcaster(() => {
      const build = deferred<FleetSnapshot>();
      builds.push(build);
      return build.promise;
    });
    const client = new FakeClient();

    const olderBroadcast = broadcaster.broadcast([client]);
    expect(builds).toHaveLength(1);
    const newerSend = broadcaster.sendTo(client);
    expect(builds).toHaveLength(1);

    builds[0]?.resolve(snapshot(1));
    await olderBroadcast;
    expect(messageTimestamps(client)).toEqual([]);
    expect(builds).toHaveLength(2);

    builds[1]?.resolve(snapshot(2));
    await newerSend;
    expect(messageTimestamps(client)).toEqual([2]);
  });

  it("coalesces multiple requests into one pending rebuild while a build is active", async () => {
    const builds: Deferred<FleetSnapshot>[] = [];
    const broadcaster = new SnapshotBroadcaster(() => {
      const build = deferred<FleetSnapshot>();
      builds.push(build);
      return build.promise;
    });
    const client = new FakeClient();

    const firstBroadcast = broadcaster.broadcast([client]);
    const secondBroadcast = broadcaster.broadcast([client]);
    const thirdSend = broadcaster.sendTo(client);

    expect(builds).toHaveLength(1);
    builds[0]?.resolve(snapshot(1));
    await firstBroadcast;
    expect(messageTimestamps(client)).toEqual([]);
    expect(builds).toHaveLength(2);

    builds[1]?.resolve(snapshot(2));
    await Promise.all([secondBroadcast, thirdSend]);
    expect(messageTimestamps(client)).toEqual([2]);
  });

  it("keeps pending first snapshots independent across clients", async () => {
    const builds: Deferred<FleetSnapshot>[] = [];
    const broadcaster = new SnapshotBroadcaster(() => {
      const build = deferred<FleetSnapshot>();
      builds.push(build);
      return build.promise;
    });
    const firstClient = new FakeClient();
    const secondClient = new FakeClient();

    const firstSend = broadcaster.sendTo(firstClient);
    const secondSend = broadcaster.sendTo(secondClient);

    expect(builds).toHaveLength(1);
    builds[0]?.resolve(snapshot(1));
    await firstSend;
    expect(messageTimestamps(firstClient)).toEqual([1]);
    expect(messageTimestamps(secondClient)).toEqual([]);
    expect(builds).toHaveLength(2);

    builds[1]?.resolve(snapshot(2));
    await secondSend;
    expect(messageTimestamps(firstClient)).toEqual([1]);
    expect(messageTimestamps(secondClient)).toEqual([2]);
  });
});
