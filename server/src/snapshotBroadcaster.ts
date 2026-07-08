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

export class SnapshotBroadcaster {
  private nextSequence = 0;
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
    const payload = this.buildSnapshot().then((snapshot) => ({
      sequence,
      message: JSON.stringify(snapshot),
    }));
    return { sequence, payload };
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
