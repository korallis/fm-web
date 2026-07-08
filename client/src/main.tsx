import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { App } from "./App";

// This app is local-only (127.0.0.1) by design — the browser's general internet online/offline
// detection has no bearing on whether our own local server is reachable, so the default
// `networkMode: "online"` would incorrectly pause retries (e.g. captain's laptop has no wifi but
// the local FM Deck server is still right there).
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: "always" } },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element missing");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
