import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { App } from "./App";

afterEach(() => {
  cleanup();
});

function renderWithChild() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<p>The queue goes here.</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

it("shows the brand, the navigation and the page", () => {
  renderWithChild();
  expect(screen.getByText("UnderCover")).toBeDefined();
  expect(screen.getByText("Queue")).toBeDefined();
  expect(screen.getByText("Agent instructions")).toBeDefined();
  expect(screen.getByText("The queue goes here.")).toBeDefined();
});

it("highlights the active page in the navigation", () => {
  renderWithChild();
  const active = screen.getByText("Queue").closest("a");
  expect(active?.className).toContain("active");
});
