import { expect, test } from "@playwright/test";

test("the instructions page shows the agent's instructions", async ({
  page,
}) => {
  await page.goto("/instructions");
  await expect(
    page.getByRole("heading", { name: "Agent instructions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How to work a claim" }),
  ).toBeVisible();
  await expect(page.getByText("You are the UnderCover Agent.")).toBeVisible();
  await expect(
    page.getByText("If you approved, call pay with the payout you decided."),
  ).toBeVisible();
});
