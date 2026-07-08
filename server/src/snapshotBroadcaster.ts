import type { FleetSnapshot } from "@fm-web/shared";

export interface SnapshotClient {
  send(message: string): void;
}

export type SnapshotBuilder = () => Promise<FleetSnapshot>;

interface SnapshotPayload {
  sequence: number;
  message: string;
}

interface SnapshotRequest {
  sequence: number;
  payload: Promise<SnapshotPayload>;
}

interface QueuedSnapshotRequest extends SnapshotRequest {
  resolve(payload: SnapshotPayload): void;
  reject(error: unknown): void;
}

export class SnapshotBroadcaster {
  private nextSequence = 0;
  private activeBuild = false;
  private queuedRequest: QueuedSnapshotRequest | null = null;
  private readonly latestRequestedSequence = new WeakMap<SnapshotClient, number>();
  private readonly lastDeliveredSequence = new WeakMap<SnapshotClient, number>();

  constructor(private readonly buildSnapshot: SnapshotBuilder) {}

  async sendTo(client: SnapshotClient): Promise<void> {
    const clients = [client];
    const request = this.requestPayload();
    this.markRequested(clients, request.sequence);
    const payload = await request.payload;
    this.deliver(clients, payload);
  }

  async broadcast(clients: Iterable<SnapshotClient>): Promise<void> {
    const recipients = Array.from(clients);
    if (recipients.length === 0) return;
    const request = this.requestPayload();
    this.markRequested(recipients, request.sequence);
    const payload = await request.payload;
    this.deliver(recipients, payload);
  }

  private requestPayload(): SnapshotRequest {
    const sequence = (this.nextSequence += 1);
    if (this.activeBuild) {
      if (this.queuedRequest !== null) return this.queuedRequest;
      const request = this.createQueuedRequest(sequence);
      this.queuedRequest = request;
      return request;
    }
    return { sequence, payload: this.runBuild(sequence) };
  }

  private createQueuedRequest(sequence: number): QueuedSnapshotRequest {
    let resolvePayload: (payload: SnapshotPayload) => void = () => {
      throw new Error("queued snapshot request was not initialized");
    };
    let rejectPayload: (error: unknown) => void = () => {
      throw new Error("queued snapshot request was not initialized");
    };
    const payload = new Promise<SnapshotPayload>((resolve, reject) => {
      resolvePayload = resolve;
      rejectPayload = reject;
    });
    return {
      sequence,
      payload,
      resolve: (value) => resolvePayload(value),
      reject: (error) => rejectPayload(error),
    };
  }

  private async runBuild(sequence: number): Promise<SnapshotPayload> {
    this.activeBuild = true;
    try {
      const snapshot = await this.buildSnapshot();
      return {
        sequence,
        message: JSON.stringify(snapshot),
      };
    } finally {
      const queued = this.queuedRequest;
      if (queued === null) {
        this.activeBuild = false;
      } else {
        this.queuedRequest = null;
        this.runBuild(queued.sequence).then(queued.resolve, queued.reject);
      }
    }
  }

  private markRequested(clients: readonly SnapshotClient[], sequence: number): void {
    for (const client of clients) this.latestRequestedSequence.set(client, sequence);
  }

  private deliver(clients: readonly SnapshotClient[], payload: SnapshotPayload): void {
    for (const client of clients) {
      const latestRequested = this.latestRequestedSequence.get(client) ?? 0;
      if (payload.sequence < latestRequested) continue;
      const lastDelivered = this.lastDeliveredSequence.get(client) ?? 0;
      if (payload.sequence <= lastDelivered) continue;
      this.lastDeliveredSequence.set(client, payload.sequence);
      client.send(payload.message);
    }
  }
}
