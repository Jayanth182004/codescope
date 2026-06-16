import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import CodeScopeApp from "../CodeScopeApp.jsx";
import CodeScopeLanding from "../CodeScopeLanding (1).jsx";

function Root() {
  const [mode, setMode] = useState("landing");
  const [initialScreen, setInitialScreen] = useState("app");

  const enterApp = (screen = "app") => {
    setInitialScreen(screen);
    setMode("app");
    window.scrollTo(0, 0);
  };

  return mode === "landing"
    ? <CodeScopeLanding onEnterApp={enterApp} />
    : <CodeScopeApp initialScreen={initialScreen} onBackToLanding={() => setMode("landing")} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
