import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeCapacitor } from "./lib/capacitor-init";

initializeCapacitor().catch(() => {});

const hideLoadingScreen = () => {
  const loadingEl = document.getElementById("app-loading");
  if (loadingEl) {
    loadingEl.style.transition = "opacity 0.3s ease-out";
    loadingEl.style.opacity = "0";
    loadingEl.style.pointerEvents = "none";
    setTimeout(() => loadingEl.remove(), 300);
  }
};

createRoot(document.getElementById("root")!).render(<App />);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideLoadingScreen();
  });
});
