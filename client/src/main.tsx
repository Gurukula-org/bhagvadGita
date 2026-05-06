import { hydrateRoot, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root")!;

if (rootEl.innerHTML.trim()) {
  hydrateRoot(
    rootEl,
    <HelmetProvider>
      <App />
    </HelmetProvider>,
  );
} else {
  createRoot(rootEl).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>,
  );
}
