import { expect, test } from "@playwright/test";

test("the claim page shows the claim and its policy", async ({ page }) => {
  await page.goto("/claims/CLM-1001");
  await expect(page.getByRole("heading", { name: "CLM-1001" })).toBeVisible();
  await expect(
    page.getByText(
      "Flight home canceled by the airline, rebooked the next morning",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "My flight home from Rome on June 18 was canceled by Meridian Air",
    ),
  ).toBeVisible();
  await expect(page.getByText("UnderCover Premium")).toBeVisible();
  await expect(page.getByText("Trip delay waiting hours")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer" })).toBeVisible();
  await expect(
    page.getByText("Checked bag arrived 30 hours late in Lisbon"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Agent decision" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Agent activity" }),
  ).toBeVisible();
});
