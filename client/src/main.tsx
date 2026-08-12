import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const pendingPath = sessionStorage.getItem("vehicle-operation-pending-path");
if (pendingPath) {
  sessionStorage.removeItem("vehicle-operation-pending-path");
  const base = import.meta.env.BASE_URL;
  history.replaceState(null, "", `${base}${pendingPath.replace(/^\//, "")}`);
}

createRoot(document.getElementById("root")!).render(<App />);
