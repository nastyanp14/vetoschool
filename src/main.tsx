import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyTheme, getStoredTheme } from "./lib/theme";

applyTheme(getStoredTheme());

createRoot(document.getElementById("root")!).render(<App />);

