import { expect, test } from "@playwright/test";

function lastWaitingClaim(queue: {
  claims: { claim_id: string; status: string }[];
}): { claim_id: string; status: string } {
  const waiting = queue.claims
    .filter((claim) => claim.status === "waiting")
    .at(-1);
  if (waiting === undefined) {
    throw new Error(
      "No waiting claims left; delete backend/undercover.db and restart to reseed",
    );
  }
  return waiting;
}

test("a handler signs off and pays an over-limit claim", async ({
  page,
  request,
}) => {
  const queue = (await (await request.get("/api/claims")).json()) as {
    claims: { claim_id: string; status: string }[];
  };
  const claimId = lastWaitingClaim(queue).claim_id;

  const decided = (await (
    await request.post(`/api/claims/${claimId}/decide`, {
      data: {
        decision: "approve",
        payout: 1500,
        explanation: "The plan covers this loss and the documents support it.",
        policy_section: "Section 2, Trip Cancellation",
      },
    })
  ).json()) as { status: string };
  expect(decided.status).toBe("in_progress");

  const blocked = await request.post(`/api/claims/${claimId}/pay`, {
    data: { amount: 1500 },
  });
  expect(blocked.status()).toBe(403);

  await page.goto(`/claims/${claimId}`);
  await expect(page.getByText("Waiting for sign-off")).toBeVisible();
  await page.getByLabel("Handler").selectOption({ label: "Marcus Oyelaran" });
  await page.getByText("Sign off").click();
  await expect(page.getByText("Signed off by Marcus Oyelaran.")).toBeVisible();
  await page.getByText("Pay $1,500.00").click();
  await expect(page.getByText("Paid $1,500.00.")).toBeVisible();
  await expect(page.locator(".claim-head").getByText("Decided")).toBeVisible();
  await expect(page.getByText("Run agent")).toHaveCount(0);
});
