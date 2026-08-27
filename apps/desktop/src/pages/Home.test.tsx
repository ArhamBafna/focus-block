/**
 * @vitest-environment jsdom
 *
 * Desktop Home status machine (issue #18): loading → unreachable (no Start
 * buttons) → ready with auto-recovery on the next poll, and mid-session
 * failure keeps last-known-good data instead of faking healthy idle.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";
import type { ServiceStatus } from "../lib/ipc";

vi.mock("../lib/ipc", () => ({
  ipc: {
    getStatusSafe: vi.fn(),
    startSession: vi.fn(),
    stopSession: vi.fn(),
  },
}));

import { ipc } from "../lib/ipc";

const getStatusSafe = vi.mocked(ipc.getStatusSafe);

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Envelope =
  | { ok: true; data: Awaited<ReturnType<typeof buildStatus>> }
  | { ok: false; kind: "unavailable" | "app"; message: string };

interface Deferred {
  promise: Promise<Envelope>;
  resolve: (envelope: Envelope) => void;
}

function deferred(): Deferred {
  let resolve!: (envelope: Envelope) => void;
  const promise = new Promise<Envelope>((res) => (resolve = res));
  return { promise, resolve };
}

/** Queue of polls: each getStatusSafe call returns a deferred the test resolves manually. */
function queuePolls(): Deferred[] {
  const pending: Deferred[] = [];
  getStatusSafe.mockImplementation(() => {
    const entry = deferred();
    pending.push(entry);
    return entry.promise;
  });
  return pending;
}

function buildStatus(activeSession: null | {
  id: string;
  mode: "blocklist" | "lockdown";
  started_at: string;
  planned_duration_sec: number;
  blocklist_snapshot: string[];
}): ServiceStatus {
  if (!activeSession) {
    return { health: { running: true, version: "0.1.0-mock" }, active_session: null };
  }
  const elapsed = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000);
  return {
    health: { running: true, version: "0.1.0-mock" },
    active_session: {
      session: {
        ...activeSession,
        preset_id: null,
        ended_at: null,
        status: "active",
        whitelist_snapshot: [],
      },
      elapsed_sec: elapsed,
      remaining_sec: Math.max(0, activeSession.planned_duration_sec - elapsed),
    },
  };
}

const okIdle = (): Envelope => ({ ok: true, data: buildStatus(null) });

const okActive = (): Envelope => ({
  ok: true,
  data: buildStatus({
    id: "session-1",
    mode: "blocklist",
    started_at: new Date().toISOString(),
    planned_duration_sec: 25 * 60,
    blocklist_snapshot: ["news.com"],
  }),
});

const unreachable = (): Envelope => ({
  ok: false,
  kind: "unavailable",
  message: "daemon not running",
});

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  getStatusSafe.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Home phases", () => {
  it("starts in loading and lands on ready once the first poll succeeds", async () => {
    const polls = queuePolls();
    render(<Home />);

    expect(screen.getByText(/Loading/i)).toBeTruthy();

    polls[0].resolve(okIdle());
    await flush();

    expect(screen.getByText(/ready to focus/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Focus/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /lockdown/i })).toBeTruthy();
  });

  it("renders unreachable without any Start buttons while the daemon is down", async () => {
    const polls = queuePolls();
    render(<Home />);

    polls[0].resolve(unreachable());
    await flush();

    expect(screen.getByText(/Service Unreachable/i)).toBeTruthy();
    expect(screen.getByText(/FocusBlock service is not running/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Focus/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /lockdown/i })).toBeNull();
  });

  it("recovers to ready automatically on the next poll", async () => {
    const polls = queuePolls();
    render(<Home />);

    polls[0].resolve(unreachable());
    await flush();
    expect(screen.getByText(/Service Unreachable/i)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(polls.length).toBeGreaterThanOrEqual(2);
    polls[1].resolve(okIdle());
    await flush();

    expect(screen.getByText(/ready to focus/i)).toBeTruthy();
    expect(screen.queryByText(/Service Unreachable/i)).toBeNull();
  });

  it("keeps the live session view during a mid-session outage instead of faking idle", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const polls = queuePolls();
      render(<Home />);

      polls[0].resolve(okActive());
      await flush();
      expect(screen.getByText(/Focus Mode Active/i)).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      polls[1].resolve(unreachable());
      await flush();

      // Last-known-good data still renders, with an honest degraded banner.
      expect(screen.getByText(/Focus Mode Active/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Stop Session/i })).toBeTruthy();
      expect(screen.getByText(/Connection to the service was lost/i)).toBeTruthy();
      expect(screen.queryByText(/ready to focus/i)).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("treats an app-arm failure before any data as unreachable, not ready", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const polls = queuePolls();
      render(<Home />);

      polls[0].resolve({ ok: false, kind: "app", message: "store corrupted" });
      await flush();

      expect(screen.getByText(/Service Unreachable/i)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Focus/i })).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
