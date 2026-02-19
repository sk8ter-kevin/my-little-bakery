import React from "react";
import ReactDOM from "react-dom/client";
import RecipeOrganizer from "./App.jsx";

// Reset default browser styles
document.documentElement.style.cssText = "height:100%;margin:0;padding:0;";
document.body.style.cssText = "height:100%;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RecipeOrganizer />
  </React.StrictMode>
);

// ─── PWA: register service worker + request persistent storage ───
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { });
  });
}
if (navigator.storage?.persist) {
  navigator.storage.persist();
}
