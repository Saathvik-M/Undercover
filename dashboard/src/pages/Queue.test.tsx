import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  claimTypeLabel,
  decisionLabel,
  money,
  statusLabel,
  type Decision,
  type QueueClaim,
  type Status,
} from "../api";
import { Queue } from "./Queue";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const STATUSES: Status[] = [
  "waiting",
  "in_progress",
  "waiting_for_signoff",
  "decided",
];

function queueOf(count: number): QueueClaim[] {
  return Array.from({ length: count }, (_, index) => ({
    claim_id: `CLM-${String(1001 + index)}`,
    customer_name: `Customer ${String(index + 1)}`,
    claim_type: "trip_delay",
    amount_claimed: 100 + index,
    status: STATUSES[index % STATUSES.length],
    decision:
      index === 1 ? { decision: "approve" as Decision, payout: 1240.5 } : null,
  }));
}

function stubQueue(claims: QueueClaim[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ claims }))),
  );
}

async function renderQueue() {
  render(
    <MemoryRouter>
      <Queue />
    </MemoryRouter>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

it("renders every claim in the queue", async () => {
  stubQueue(queueOf(25));
  await renderQueue();
  const rows = document.querySelectorAll("tbody tr");
  expect(rows).toHaveLength(25);
  expect(screen.getByText("CLM-1001")).toBeDefined();
  expect(screen.getByText("Customer 7")).toBeDefined();
});

it("formats money as dollars and links to the claim", async () => {
  stubQueue(queueOf(3));
  await renderQueue();
  const link = screen.getByText("CLM-1001").closest("a");
  expect(link?.getAttribute("href")).toBe("/claims/CLM-1001");
  expect(screen.getByText("$100.00")).toBeDefined();
  expect(screen.getByText("Approved $1,240.50")).toBeDefined();
});

it("shows a badge for every status", async () => {
  stubQueue(queueOf(8));
  await renderQueue();
  expect(screen.getAllByText("Waiting").length).toBeGreaterThan(0);
  expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Waiting for sign-off").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Decided").length).toBeGreaterThan(0);
});

it("shows a loading note, then the queue", async () => {
  stubQueue(queueOf(1));
  render(
    <MemoryRouter>
      <Queue />
    </MemoryRouter>,
  );
  expect(screen.getByText("Loading the queue…")).toBeDefined();
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText("CLM-1001")).toBeDefined();
});

it("says the queue is unavailable when the backend fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await renderQueue();
  expect(screen.getByText("The queue is unavailable.")).toBeDefined();
});

it("polls every three seconds and stops on unmount", async () => {
  vi.useFakeTimers();
  stubQueue(queueOf(1));
  render(
    <MemoryRouter>
      <Queue />
    </MemoryRouter>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  cleanup();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(9000);
  });
  expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
});

it("labels the statuses, decisions and claim types", () => {
  expect(statusLabel("waiting_for_signoff")).toBe("Waiting for sign-off");
  expect(decisionLabel("refer")).toBe("Referred");
  expect(claimTypeLabel("trip_delay")).toBe("Trip delay");
  expect(money(1240.5)).toBe("$1,240.50");
});
