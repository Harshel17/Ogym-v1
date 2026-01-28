import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Hide loading screen after app mounts
const hideLoadingScreen = () => {
  const loadingEl = document.getElementById("app-loading");
  if (loadingEl) {
    // Stop all animations before fading
    const logoContainer = loadingEl.querySelector('.logo-container') as HTMLElement;
    if (logoContainer) {
      logoContainer.style.animation = 'none';
    }
    const dots = loadingEl.querySelectorAll('.loading-dots span');
    dots.forEach((dot: Element) => {
      (dot as HTMLElement).style.animation = 'none';
    });
    
    loadingEl.style.transition = "opacity 0.4s ease-out";
    loadingEl.style.opacity = "0";
    loadingEl.style.pointerEvents = "none";
    setTimeout(() => loadingEl.remove(), 400);
  }
};

createRoot(document.getElementById("root")!).render(<App />);

// Hide loading screen after app is rendered
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideLoadingScreen();
  });
});
