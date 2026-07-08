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
  it("drops an older snapshot when it finishes after a newer request", async () => {
    const first = deferred<FleetSnapshot>();
    const second = deferred<FleetSnapshot>();
    const builds = [first, second];
    let buildIndex = 0;
    const broadcaster = new SnapshotBroadcaster(() => {
      const build = builds[buildIndex];
      buildIndex += 1;
      if (build === undefined) throw new Error("unexpected snapshot build");
      return build.promise;
    });
    const client = new FakeClient();

    const olderBroadcast = broadcaster.broadcast([client]);
    const newerSend = broadcaster.sendTo(client);

    second.resolve(snapshot(2));
    await newerSend;
    expect(messageTimestamps(client)).toEqual([2]);

    first.resolve(snapshot(1));
    await olderBroadcast;
    expect(messageTimestamps(client)).toEqual([2]);
  });

  it("drops an older snapshot once a newer request starts for the same client", async () => {
    const first = deferred<FleetSnapshot>();
    const second = deferred<FleetSnapshot>();
    const builds = [first, second];
    let buildIndex = 0;
    const broadcaster = new SnapshotBroadcaster(() => {
      const build = builds[buildIndex];
      buildIndex += 1;
      if (build === undefined) throw new Error("unexpected snapshot build");
      return build.promise;
    });
    const client = new FakeClient();

    const olderBroadcast = broadcaster.broadcast([client]);
    const newerSend = broadcaster.sendTo(client);

    first.resolve(snapshot(1));
    await olderBroadcast;
    expect(messageTimestamps(client)).toEqual([]);

    second.resolve(snapshot(2));
    await newerSend;
    expect(messageTimestamps(client)).toEqual([2]);
  });

  it("keeps pending first snapshots independent across clients", async () => {
    const first = deferred<FleetSnapshot>();
    const second = deferred<FleetSnapshot>();
    const builds = [first, second];
    let buildIndex = 0;
    const broadcaster = new SnapshotBroadcaster(() => {
      const build = builds[buildIndex];
      buildIndex += 1;
      if (build === undefined) throw new Error("unexpected snapshot build");
      return build.promise;
    });
    const firstClient = new FakeClient();
    const secondClient = new FakeClient();

    const firstSend = broadcaster.sendTo(firstClient);
    const secondSend = broadcaster.sendTo(secondClient);

    second.resolve(snapshot(2));
    await secondSend;
    expect(messageTimestamps(firstClient)).toEqual([]);
    expect(messageTimestamps(secondClient)).toEqual([2]);

    first.resolve(snapshot(1));
    await firstSend;
    expect(messageTimestamps(firstClient)).toEqual([1]);
    expect(messageTimestamps(secondClient)).toEqual([2]);
  });
});
