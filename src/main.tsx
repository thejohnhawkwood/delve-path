import React from "react";
import ReactDOM from "react-dom/client";
import { initPlatform, isTauri } from "./platform";
import { appVersion } from "./web/config";
import "./styles.css";
import "./web/site.css";

async function boot() {
  await initPlatform(appVersion);
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  if (isTauri()) {
    const { default: App } = await import("./App");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    return;
  }
  const { SiteApp } = await import("./web/SiteApp");
  root.render(
    <React.StrictMode>
      <SiteApp />
    </React.StrictMode>
  );
}

void boot();
