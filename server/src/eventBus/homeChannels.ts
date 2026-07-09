import type { WSContext } from "hono/ws";
import type { TimingConstants } from "@fm-web/shared";
import { buildFleetSnapshot } from "../adapter/fleetState.js";
import { watchFmHome } from "./watcher.js";
import { SnapshotBroadcaster } from "../snapshotBroadcaster.js";

export interface HomeChannel {
  clients: Set<WSContext>;
  broadcaster: SnapshotBroadcaster;
}

/**
 * Lazily builds one chokidar watcher + snapshot broadcaster per distinct firstmate home path, so
 * `/ws?home=<id>` fans a switched-home Bridge view out to its own live client set. Home paths are
 * few and long-lived for the life of the process, so channels are created on demand and kept -
 * no eviction.
 */
export class HomeChannelRegistry {
  private readonly channels = new Map<string, HomeChannel>();

  constructor(
    private readonly timing: TimingConstants | undefined,
    private readonly captainRegex: RegExp | undefined,
    private readonly onError: (error: unknown) => void,
  ) {}

  get(homePath: string): HomeChannel {
    const existing = this.channels.get(homePath);
    if (existing !== undefined) return existing;

    const clients = new Set<WSContext>();
    const broadcaster = new SnapshotBroadcaster(() =>
      buildFleetSnapshot(homePath, Date.now(), this.timing, this.captainRegex),
    );
    watchFmHome(homePath, () => {
      void broadcaster.broadcast(clients).catch(this.onError);
    });

    const channel: HomeChannel = { clients, broadcaster };
    this.channels.set(homePath, channel);
    return channel;
  }
}
