import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./App";
import { Claim } from "./pages/Claim";
import { Instructions } from "./pages/Instructions";
import { Queue } from "./pages/Queue";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Queue /> },
      { path: "claims/:claimId", element: <Claim /> },
      { path: "instructions", element: <Instructions /> },
    ],
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
