import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function safeInitCapacitor() {
  try {
    import("./lib/capacitor-init").then(mod => {
      mod.initializeCapacitor().catch(() => {});
    }).catch(() => {});
  } catch (e) {
    console.warn("Capacitor init skipped:", e);
  }
}

safeInitCapacitor();

const hideLoadingScreen = () => {
  const loadingEl = document.getElementById("app-loading");
  if (loadingEl) {
    loadingEl.style.transition = "opacity 0.3s ease-out";
    loadingEl.style.opacity = "0";
    loadingEl.style.pointerEvents = "none";
    setTimeout(() => loadingEl.remove(), 300);
  }
};

try {
  createRoot(document.getElementById("root")!).render(<App />);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hideLoadingScreen();
    });
  });
} catch (e) {
  console.error("App render failed:", e);
  const errDiv = document.createElement("div");
  errDiv.style.cssText = "position:fixed;inset:0;background:#0b1220;color:#fff;padding:40px 20px;font-family:-apple-system,sans-serif;z-index:99999;";
  errDiv.innerHTML = `<h3 style="color:#f87171">Render Error</h3><pre style="color:#fbbf24;white-space:pre-wrap;font-size:12px">${e instanceof Error ? e.message + '\n' + e.stack : String(e)}</pre>`;
  document.body.appendChild(errDiv);
}
