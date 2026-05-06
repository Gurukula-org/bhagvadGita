import { hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

hydrateRoot(
  document.getElementById("root")!,
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
