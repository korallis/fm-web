import { describe, expect, it, vi } from "vitest";
import type { ComposerQueueDeps } from "../../src/composer/queue.js";
import { ComposerQueue } from "../../src/composer/queue.js";
import type { SubmitVerdict } from "../../src/tmux/submit.js";

function makeDeps(overrides: Partial<ComposerQueueDeps> = {}): ComposerQueueDeps {
  return {
    submit: vi.fn().mockResolvedValue("empty"),
    isBusy: vi.fn().mockResolvedValue(false),
    isReadOnly: vi.fn().mockResolvedValue(false),
    getLock: vi.fn().mockResolvedValue({ pid: null, alive: null }),
    isSessionReady: vi.fn().mockResolvedValue(true),
    busyPollMs: 5,
    ...overrides,
  };
}

async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe("ComposerQueue.enqueue", () => {
  it("rejects empty/whitespace-only text without touching submit", async () => {
    const deps = makeDeps();
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("   ");
    expect(result.accepted).toBe(false);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("rejects sends while read-only", async () => {
    const deps = makeDeps({ isReadOnly: vi.fn().mockResolvedValue(true) });
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/read-only/);
  });

  it("rejects sends when the session isn't ready, even if not read-only", async () => {
    const deps = makeDeps({ isSessionReady: vi.fn().mockResolvedValue(false) });
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/not available/);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("accepts and eventually marks a prompt sent when the harness is idle", async () => {
    const deps = makeDeps();
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    expect(result.accepted).toBe(true);
    await vi.waitFor(() => {
      const entry = queue.getEntries().find((e) => e.id === result.entryId);
      expect(entry?.status).toBe("sent");
    });
    expect(deps.submit).toHaveBeenCalledWith("hello");
  });
});

describe("ComposerQueue busy-aware processing", () => {
  it("waits until the harness is idle before submitting", async () => {
    let busy = true;
    const deps = makeDeps({
      isBusy: vi.fn(async () => busy),
      submit: vi.fn().mockResolvedValue("empty"),
    });
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    await flush();
    expect(queue.getEntries().find((e) => e.id === result.entryId)?.status).toBe("sending");
    expect(deps.submit).not.toHaveBeenCalled();

    busy = false;
    await vi.waitFor(() => {
      expect(deps.submit).toHaveBeenCalled();
    });
  });

  it("re-checks read-only after waiting for a busy harness", async () => {
    let busy = true;
    let readOnly = false;
    const deps = makeDeps({
      isBusy: vi.fn(async () => busy),
      isReadOnly: vi.fn(async () => readOnly),
      submit: vi.fn().mockResolvedValue("empty"),
    });
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    await flush();
    expect(queue.getEntries().find((e) => e.id === result.entryId)?.status).toBe("sending");

    readOnly = true;
    busy = false;

    await vi.waitFor(() => {
      const entry = queue.getEntries().find((e) => e.id === result.entryId);
      expect(entry?.status).toBe("failed");
      expect(entry?.detail).toMatch(/read-only/);
    });
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("processes multiple queued prompts serially, in order", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      submit: vi.fn(async (text: string): Promise<SubmitVerdict> => {
        order.push(text);
        return "empty";
      }),
    });
    const queue = new ComposerQueue(deps);
    await queue.enqueue("first");
    await queue.enqueue("second");
    await queue.enqueue("third");
    await vi.waitFor(() => {
      expect(queue.getEntries().every((e) => e.status === "sent")).toBe(true);
    });
    expect(order).toEqual(["first", "second", "third"]);
  });
});

describe("ComposerQueue verdict handling", () => {
  it("marks a positively-confirmed swallowed Enter as failed with detail", async () => {
    const deps = makeDeps({ submit: vi.fn().mockResolvedValue("pending") });
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    await vi.waitFor(() => {
      const entry = queue.getEntries().find((e) => e.id === result.entryId);
      expect(entry?.status).toBe("failed");
    });
    expect(queue.getEntries()[0]?.detail).toMatch(/swallowed/);
  });

  it("stops processing and fails queued prompts after a swallowed Enter", async () => {
    let resolveSubmit!: (value: SubmitVerdict) => void;
    const submitPromise = new Promise<SubmitVerdict>((resolvePromise) => {
      resolveSubmit = resolvePromise;
    });
    const deps = makeDeps({ submit: vi.fn().mockReturnValue(submitPromise) });
    const queue = new ComposerQueue(deps);

    await queue.enqueue("first");
    await queue.enqueue("second");
    await vi.waitFor(() => {
      expect(queue.getEntries().find((e) => e.text === "first")?.status).toBe("sending");
      expect(queue.getEntries().find((e) => e.text === "second")?.status).toBe("queued");
    });

    resolveSubmit("pending");

    await vi.waitFor(() => {
      expect(queue.getEntries().find((e) => e.text === "first")?.status).toBe("failed");
      expect(queue.getEntries().find((e) => e.text === "second")?.status).toBe("failed");
    });
    expect(deps.submit).toHaveBeenCalledTimes(1);
    expect(queue.getEntries().find((e) => e.text === "second")?.detail).toMatch(/swallowed/);
  });

  it("marks an unreadable pane as sent (lenient), with an explanatory detail", async () => {
    const deps = makeDeps({ submit: vi.fn().mockResolvedValue("unknown") });
    const queue = new ComposerQueue(deps);
    const result = await queue.enqueue("hello");
    await vi.waitFor(() => {
      const entry = queue.getEntries().find((e) => e.id === result.entryId);
      expect(entry?.status).toBe("sent");
    });
    expect(queue.getEntries()[0]?.detail).toMatch(/unreadable/);
  });

  it("fails all still-queued entries if read-only becomes true mid-processing", async () => {
    let readOnly = false;
    let submitCalls = 0;
    const deps = makeDeps({
      isReadOnly: vi.fn(async () => readOnly),
      submit: vi.fn(async (): Promise<SubmitVerdict> => {
        submitCalls += 1;
        readOnly = true; // another session grabs the lock right after our first send
        return "empty";
      }),
    });
    const queue = new ComposerQueue(deps);
    await queue.enqueue("first");
    await queue.enqueue("second");
    await vi.waitFor(() => {
      expect(queue.getEntries().find((e) => e.text === "second")?.status).toBe("failed");
    });
    expect(submitCalls).toBe(1);
    expect(queue.getEntries().find((e) => e.text === "first")?.status).toBe("sent");
    expect(queue.getEntries().find((e) => e.text === "second")?.detail).toMatch(/read-only/);
  });
});

describe("ComposerQueue.buildState / onStateChange", () => {
  it("composes lock/busy/readOnly/sessionReady with the queue snapshot", async () => {
    const deps = makeDeps({
      isBusy: vi.fn().mockResolvedValue(true),
      getLock: vi.fn().mockResolvedValue({ pid: 123, alive: true }),
      skillInvocationPrefix: "$",
    });
    const queue = new ComposerQueue(deps);
    const state = await queue.buildState();
    expect(state).toMatchObject({
      busy: true,
      readOnly: false,
      sessionReady: true,
      skillInvocationPrefix: "$",
      lock: { pid: 123, alive: true },
    });
    expect(state.queue).toEqual([]);
  });

  it("defaults skill quick action invocations to slash commands", async () => {
    const queue = new ComposerQueue(makeDeps());
    await expect(queue.buildState()).resolves.toMatchObject({ skillInvocationPrefix: "/" });
  });

  it("notifies listeners as entries transition status", async () => {
    const deps = makeDeps();
    const queue = new ComposerQueue(deps);
    const seenStatuses: string[] = [];
    queue.onStateChange((state) => {
      const entry = state.queue[0];
      if (entry !== undefined) seenStatuses.push(entry.status);
    });
    await queue.enqueue("hello");
    await vi.waitFor(() => {
      expect(seenStatuses.at(-1)).toBe("sent");
    });
    expect(seenStatuses).toContain("queued");
    expect(seenStatuses).toContain("sending");
  });
});
