import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CodeScopeApp from "../CodeScopeApp.jsx";
import CodeScopeLanding from "../CodeScopeLanding.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>
);
