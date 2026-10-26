import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Instructions } from "./Instructions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the agent's instructions read only", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          instructions:
            "You are the UnderCover Agent.\n\n## How to work a claim\n\n1. Read the claim.",
        }),
      ),
    ),
  );
  render(<Instructions />);
  expect(
    await screen.findByText("You are the UnderCover Agent."),
  ).toBeDefined();
  expect(screen.getByText("How to work a claim").tagName).toBe("H3");
  expect(screen.getByText("1. Read the claim.")).toBeDefined();
});

it("says so when the instructions are unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<Instructions />);
  expect(
    await screen.findByText("The instructions are unavailable."),
  ).toBeDefined();
});
