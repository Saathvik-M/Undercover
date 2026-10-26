import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Claim as ClaimDetail, Handler } from "../api";
import { Claim } from "./Claim";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HANDLERS: Handler[] = [
  { handler_id: "HND-01", name: "Dana Whitfield", role: "", email: "" },
  { handler_id: "HND-02", name: "Marcus Oyelaran", role: "", email: "" },
];

function pathOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  return input.url;
}

function respond(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input);
      for (const [key, body] of Object.entries(routes)) {
        if (path.startsWith(key)) {
          return respond(body);
        }
      }
      return respond({ detail: "not found" }, 404);
    }),
  );
}

function claimOf(overrides: Partial<ClaimDetail>): ClaimDetail {
  return {
    claim_id: "CLM-1001",
    policy_id: "POL-2001",
    customer_id: "CUS-3001",
    claim_type: "trip_delay",
    submitted_on: "2026-06-24",
    incident_date: "2026-06-18",
    incident_location: "Rome, Italy",
    summary: "Flight home canceled by the airline",
    story: "My flight home from Rome was canceled.",
    items: [
      {
        description: "Airport hotel, one night",
        category: "accommodation",
        amount: 245,
      },
      { description: "Dinner and breakfast", category: "meals", amount: 95 },
    ],
    documents: [
      {
        name: "Meridian Air cancellation notice",
        type: "carrier_report",
        content: "Flight MA 611 was canceled because of crew availability.",
      },
    ],
    amount_claimed: 420,
    status: "waiting",
    decision: null,
    signed_off_by: null,
    paid_amount: null,
    policy: {
      policy_id: "POL-2001",
      customer_id: "CUS-3001",
      plan: "premium",
      purchased_on: "2026-04-22",
      sold_through: "Meridian Air checkout",
      status: "active",
      trip: {
        destination: "Rome, Italy",
        departs_on: "2026-06-10",
        returns_on: "2026-06-18",
        trip_cost: 3100,
      },
      travelers: ["Maya Patel"],
      plan_limits: {
        plan: "premium",
        name: "UnderCover Premium",
        trip_cancellation_max: 5000,
        trip_delay_waiting_hours: 6,
        trip_delay_max: 800,
        baggage_delay_waiting_hours: 12,
        baggage_delay_max: 300,
        baggage_max: 1500,
        per_item_limit: 300,
        passport_max: 250,
        emergency_medical_max: 100000,
        deductible: 50,
      },
      deductible_applies_to: ["baggage", "emergency_medical"],
      add_ons: [
        {
          add_on: "electronics_plus",
          name: "Electronics Plus",
          effect: "Raises the per-item limit for electronics to $1,200.",
        },
      ],
    },
    customer: {
      customer_id: "CUS-3001",
      name: "Maya Patel",
      email: "maya.patel@example.com",
      phone: "+1 201 555 0143",
      date_of_birth: "1988-03-14",
      address: {
        street: "48 Wayne Street",
        city: "Jersey City",
        state: "NJ",
        zip: "07302",
      },
      customer_since: "2023-04-11",
      previous_claims: [
        {
          claim_id: "CLM-0412",
          filed_on: "2024-08-19",
          incident_date: "2024-08-09",
          claim_type: "baggage_delay",
          summary: "Checked bag arrived 30 hours late in Lisbon",
          outcome: "approved",
          amount_paid: 140,
        },
      ],
    },
    events: [
      {
        seq: 1,
        step: "Read the claim",
        created_at: "2026-06-24T10:00:00+00:00",
      },
    ],
    ...overrides,
  };
}

async function renderClaim(claim: ClaimDetail) {
  stubFetch({
    "/api/handlers": { handlers: HANDLERS },
    "/api/claims/CLM-1001": claim,
  });
  render(
    <MemoryRouter initialEntries={["/claims/CLM-1001"]}>
      <Routes>
        <Route path="/claims/:claimId" element={<Claim />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.getByText(claim.summary)).toBeDefined();
  });
}

it("shows the claim, its items and its documents", async () => {
  await renderClaim(claimOf({}));
  expect(screen.getByText("Flight home canceled by the airline")).toBeDefined();
  expect(
    screen.getByText("My flight home from Rome was canceled."),
  ).toBeDefined();
  expect(screen.getByText("Airport hotel, one night")).toBeDefined();
  expect(screen.getByText("$245.00")).toBeDefined();
  expect(screen.getByText("Meridian Air cancellation notice")).toBeDefined();
});

it("shows the policy with its plan limits and add-ons", async () => {
  await renderClaim(claimOf({}));
  expect(screen.getByText("UnderCover Premium")).toBeDefined();
  expect(screen.getByText("Trip delay waiting hours")).toBeDefined();
  expect(screen.getByText("6 hours")).toBeDefined();
  expect(screen.getByText("Trip cancellation max")).toBeDefined();
  expect(screen.getAllByText("$5,000.00").length).toBeGreaterThan(0);
  expect(screen.getByText("Electronics Plus:")).toBeDefined();
});

it("shows the customer and their earlier claims", async () => {
  await renderClaim(claimOf({}));
  expect(screen.getByText("maya.patel@example.com")).toBeDefined();
  expect(
    screen.getByText("Checked bag arrived 30 hours late in Lisbon"),
  ).toBeDefined();
});

it("shows the agent's decision and its activity", async () => {
  await renderClaim(
    claimOf({
      status: "decided",
      decision: {
        decision: "approve",
        payout: 420,
        explanation: "The delay exceeded the 6 hour waiting period.",
        policy_section: "Section 3, Trip Delay",
      },
      signed_off_by: "Dana Whitfield",
      paid_amount: 420,
    }),
  );
  expect(
    screen.getByText("The delay exceeded the 6 hour waiting period."),
  ).toBeDefined();
  expect(screen.getByText("Section 3, Trip Delay")).toBeDefined();
  expect(screen.getByText("Signed off by Dana Whitfield.")).toBeDefined();
  expect(screen.getByText("Paid $420.00.")).toBeDefined();
  expect(screen.getByText("Read the claim")).toBeDefined();
});

it("offers to run the agent on a waiting claim", async () => {
  await renderClaim(claimOf({}));
  const button = screen.getByText("Run agent").closest("button");
  expect(button).not.toBeNull();
  expect(button?.disabled).toBe(false);
});

it("offers no actions on a decided claim", async () => {
  await renderClaim(claimOf({ status: "decided" }));
  expect(screen.queryByText("Run agent")).toBeNull();
  expect(screen.queryByText("Sign off")).toBeNull();
});

it("signs off a waiting claim, then offers to pay", async () => {
  const waiting = claimOf({
    status: "waiting_for_signoff",
    decision: {
      decision: "approve",
      payout: 1500,
      explanation: "Covered cancellation.",
      policy_section: "Section 2, Trip Cancellation",
    },
  });
  const signed = { ...waiting, signed_off_by: "Dana Whitfield" };
  let signedOff = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path.startsWith("/api/claims/CLM-1001/signoff")) {
        signedOff = true;
        return respond({});
      }
      if (path.startsWith("/api/handlers")) {
        return respond({ handlers: HANDLERS });
      }
      return respond(signedOff ? signed : waiting);
    }),
  );
  render(
    <MemoryRouter initialEntries={["/claims/CLM-1001"]}>
      <Routes>
        <Route path="/claims/:claimId" element={<Claim />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("Covered cancellation.");
  expect(screen.getByText("Sign off")).toBeDefined();
  act(() => {
    screen.getByText("Sign off").closest("button")?.click();
  });
  expect(
    await screen.findByText("Signed off by Dana Whitfield."),
  ).toBeDefined();
  expect(screen.getByText("Pay $1,500.00")).toBeDefined();
});

it("pays a signed-off claim", async () => {
  const signed = claimOf({
    status: "waiting_for_signoff",
    decision: {
      decision: "approve",
      payout: 1500,
      explanation: "Covered cancellation.",
      policy_section: "Section 2, Trip Cancellation",
    },
    signed_off_by: "Dana Whitfield",
  });
  const paid = { ...signed, status: "decided", paid_amount: 1500 };
  let isPaid = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path.startsWith("/api/claims/CLM-1001/pay")) {
        isPaid = true;
        return respond({});
      }
      if (path.startsWith("/api/handlers")) {
        return respond({ handlers: HANDLERS });
      }
      return respond(isPaid ? paid : signed);
    }),
  );
  render(
    <MemoryRouter initialEntries={["/claims/CLM-1001"]}>
      <Routes>
        <Route path="/claims/:claimId" element={<Claim />} />
      </Routes>
    </MemoryRouter>,
  );
  const button = await screen.findByText("Pay $1,500.00");
  act(() => {
    button.closest("button")?.click();
  });
  expect(await screen.findByText("Paid $1,500.00.")).toBeDefined();
  expect(screen.getByText("Decided")).toBeDefined();
});

it("shows the error when a payment is blocked", async () => {
  const unsigned = claimOf({
    status: "waiting_for_signoff",
    signed_off_by: "Dana Whitfield",
    decision: {
      decision: "approve",
      payout: 1500,
      explanation: "Covered cancellation.",
      policy_section: "Section 2, Trip Cancellation",
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (path.startsWith("/api/claims/CLM-1001/pay")) {
        return respond(
          { detail: "A payout of $1,500.00 waits for a sign-off" },
          403,
        );
      }
      if (path.startsWith("/api/handlers")) {
        return respond({ handlers: HANDLERS });
      }
      return respond(unsigned);
    }),
  );
  render(
    <MemoryRouter initialEntries={["/claims/CLM-1001"]}>
      <Routes>
        <Route path="/claims/:claimId" element={<Claim />} />
      </Routes>
    </MemoryRouter>,
  );
  const button = await screen.findByText("Pay $1,500.00");
  act(() => {
    button.closest("button")?.click();
  });
  expect(
    await screen.findByText(
      "Error: A payout of $1,500.00 waits for a sign-off",
    ),
  ).toBeDefined();
});
