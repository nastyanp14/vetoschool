import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { installWorkbookAssetFetchDebug } from "./lib/workbooks";

applyTheme(getStoredTheme());
installWorkbookAssetFetchDebug();

createRoot(document.getElementById("root")!).render(<App />);
