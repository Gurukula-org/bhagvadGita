import { renderToString } from "react-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { Router } from "wouter";
import App from "./App";

interface HelmetContext {
  helmet: HelmetServerState | null;
}

export function render(url: string) {
  const helmetContext: HelmetContext = { helmet: null };

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <Router ssrPath={url}>
        <App />
      </Router>
    </HelmetProvider>,
  );

  return { html, helmet: helmetContext.helmet };
}
