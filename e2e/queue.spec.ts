import { expect, test } from "@playwright/test";

test("the queue lists every claim", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Claims queue" }),
  ).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(25);
  const first = rows.first();
  await expect(first).toContainText("CLM-1001");
  await expect(first).toContainText("Maya Patel");
  await expect(first).toContainText("Trip delay");
  await expect(first).toContainText("$420.00");
  await expect(first).toContainText("Waiting");
});
