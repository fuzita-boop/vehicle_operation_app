import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

const pendingPath = sessionStorage.getItem("vehicle-operation-pending-path");
if (pendingPath) {
  sessionStorage.removeItem("vehicle-operation-pending-path");
  const base = import.meta.env.BASE_URL;
  history.replaceState(null, "", `${base}${pendingPath.replace(/^\//, "")}`);
}

if ("serviceWorker" in navigator) {
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      void registration?.update();
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
