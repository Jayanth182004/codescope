import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { ReactFlow, ReactFlowProvider, useReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, MarkerType, Handle, Position, BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NAV_ITEMS, PAGE_META, dashboardData } from "./src/app/appConfig.jsx";
import { architectureMockData } from "./src/features/architecture/architectureData.js";
import { dependencyMockData, dependencyTree } from "./src/features/dependencies/dependencyData.js";
import { gitMockData } from "./src/features/git/gitData.js";
import { impactMockData, impactTargets, impactHistory } from "./src/features/impact/impactData.js";
import { DashButton, Pill, ProgressBar, WidgetShell, MetricCard } from "./src/ui/dashboardPrimitives.jsx";
import { T, Icons, GLOBAL_CSS } from "./src/ui/foundation.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem("codescope_access_token") || localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const readEnvelope = response => response.data?.data ?? response.data;
const friendlyApiError = error => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message;
  if (status === 401) return "Please sign in before running repository analysis.";
  if (status === 403) return "You do not have permission to analyze this repository.";
  if (status === 404) return "Repository analysis data was not found. Run analysis first.";
  if (status === 409) return "An analysis run is already active or cannot be started yet.";
  if (status === 422) return "This repository cannot be analyzed yet. Upload a ZIP repository first.";
  if (!error?.response) return "Network error. Confirm the backend is running and retry.";
  return detail || "Unable to load repository analysis.";
};

const analysisApi = {
  start: repositoryId => apiClient.post(`/analysis/start/${repositoryId}`).then(readEnvelope),
  report: repositoryId => apiClient.get(`/analysis/${repositoryId}`).then(readEnvelope),
  status: repositoryId => apiClient.get("/analysis/status", { params: { repository_id: repositoryId } }).then(readEnvelope),
  metrics: repositoryId => apiClient.get("/analysis/metrics", { params: { repository_id: repositoryId } }).then(readEnvelope),
  files: (repositoryId, params = {}) => apiClient.get("/analysis/files", { params: { repository_id: repositoryId, ...params } }).then(readEnvelope),
  functions: (repositoryId, params = {}) => apiClient.get("/analysis/functions", { params: { repository_id: repositoryId, ...params } }).then(readEnvelope),
  classes: (repositoryId, params = {}) => apiClient.get("/analysis/classes", { params: { repository_id: repositoryId, ...params } }).then(readEnvelope),
  modules: (repositoryId, params = {}) => apiClient.get("/analysis/modules", { params: { repository_id: repositoryId, ...params } }).then(readEnvelope),
  imports: (repositoryId, params = {}) => apiClient.get("/analysis/imports", { params: { repository_id: repositoryId, ...params } }).then(readEnvelope),
};

const useCodeScopeUiStore = create(set => ({
  selectedRepositoryId: localStorage.getItem("codescope_selected_repository_id") || "r1",
  selectedRepositoryName: localStorage.getItem("codescope_selected_repository_name") || "main-api",
  setSelectedRepository: repository => {
    const id = repository?.id || "r1";
    const name = repository?.name || "main-api";
    localStorage.setItem("codescope_selected_repository_id", id);
    localStorage.setItem("codescope_selected_repository_name", name);
    set({ selectedRepositoryId: id, selectedRepositoryName: name });
  },
}));

const ANALYSIS_STEPS = [
  "Queued",
  "Scanning",
  "Reading Files",
  "Parsing AST",
  "Extracting Metadata",
  "Calculating Metrics",
  "Completed",
];

/* 
   AUTHENTICATION
 */

/*  Input  */
function AuthInput({ label, type = "text", value, onChange, placeholder, error, autoFocus, suffix }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword ? (show ? "text" : "password") : type;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: T.dim, letterSpacing: "0.01em" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={actualType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: "100%",
            background: T.bg,
            border: `1px solid ${error ? T.error : T.borderMid}`,
            borderRadius: 5,
            padding: isPassword ? "10px 40px 10px 12px" : "10px 12px",
            color: T.text,
            fontSize: 14,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => { if (!error) e.target.style.borderColor = T.accent; }}
          onBlur={e => { if (!error) e.target.style.borderColor = T.borderMid; }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: T.faint, display: "flex" }}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <Icons.eyeOff /> : <Icons.eye />}
          </button>
        )}
        {suffix && !isPassword && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>{suffix}</div>}
      </div>
      {error && <span style={{ fontSize: 12, color: T.error }}>{error}</span>}
    </div>
  );
}

/*  AuthBtn  */
function AuthBtn({ children, onClick, loading, disabled, variant = "primary", type = "button" }) {
  const base = {
    width: "100%", padding: "10px 16px", borderRadius: 5,
    fontSize: 14, fontWeight: 500, cursor: loading || disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, transition: "opacity 0.15s, transform 0.1s", opacity: loading || disabled ? 0.6 : 1,
    letterSpacing: "-0.01em",
  };
  const variants = {
    primary: { background: T.accent, color: "#fff", borderColor: T.accent },
    ghost:   { background: T.surfaceEl, color: T.dim, borderColor: T.borderMid },
  };
  return (
    <button
      onClick={onClick} type={type}
      disabled={loading || disabled}
      style={{ ...base, ...variants[variant] }}
      onMouseEnter={e => { if (!loading && !disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseLeave={e => { if (!loading && !disabled) e.currentTarget.style.opacity = "1"; }}
    >
      {loading && (
        <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
      )}
      {children}
    </button>
  );
}

/*  AuthShell  */
function AuthShell({ children, title, subtitle }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: "40px 20px", position: "relative", overflow: "hidden" }}>
      {/* Subtle grid backdrop */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(${T.faint} 1px, transparent 1px), linear-gradient(90deg, ${T.faint} 1px, transparent 1px)`,
        backgroundSize: "32px 32px", pointerEvents: "none"
      }} />
      {/* Glow */}
      <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: `radial-gradient(ellipse, ${T.accentSoft} 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div className="auth-card" style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, justifyContent: "center" }}>
          <Icons.logo />
          <span style={{ fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: "-0.01em", fontFamily: T.sans }}>CodeScope</span>
          <span style={{ fontSize: 11, color: T.faint, fontFamily: T.mono }}>AI</span>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r12, padding: "32px 32px 28px", boxShadow: T.shadowLg }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", marginBottom: 6 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: T.faint }}>{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/*  AuthDivider  */
function AuthDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      <span style={{ fontSize: 12, color: T.faint }}>or</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

/*  LOGIN  */
function LoginPage({ nav }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!email.includes("@")) e.email = "Enter a valid email address.";
    if (password.length < 6) e.password = "Password must be at least 6 characters.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = readEnvelope(await apiClient.post("/auth/login", { email, password }));
      if (data?.access_token) {
        localStorage.setItem("codescope_access_token", data.access_token);
        localStorage.setItem("codescope_refresh_token", data.refresh_token || "");
      }
    } catch (error) {
      console.warn("Backend login unavailable, continuing with demo auth.", error?.message);
    }
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => nav("app"), 800);
    }, 500);
  };

  if (success) {
    return (
      <AuthShell title="Welcome back" subtitle="Signing you in">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(63,185,80,0.12)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGreen 1.5s ease infinite" }}>
            <Icons.check />
          </div>
          <p style={{ fontSize: 14, color: T.dim }}>Redirecting to dashboard</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in" subtitle="Continue to your workspace">
      {/* Social */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <AuthBtn variant="ghost" onClick={() => {}}>
          <Icons.github /> Continue with GitHub
        </AuthBtn>
        <AuthBtn variant="ghost" onClick={() => {}}>
          <Icons.google /> Continue with Google
        </AuthBtn>
      </div>

      <AuthDivider />

      {/* Fields */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" error={errors.email} autoFocus />
        <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="" error={errors.password} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: T.dim }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: T.accent, width: 13, height: 13 }} />
            Remember me
          </label>
          <button onClick={() => nav("forgot")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Forgot password?</button>
        </div>

        <AuthBtn type="submit" loading={loading}>Sign in</AuthBtn>
      </form>

      <p style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 20 }}>
        No account?{" "}
        <button onClick={() => nav("register")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Create one</button>
      </p>
    </AuthShell>
  );
}

/*  REGISTER  */
function RegisterPage({ nav }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.email.includes("@")) e.email = "Enter a valid email address.";
    if (form.password.length < 8) e.password = "Use at least 8 characters.";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = readEnvelope(await apiClient.post("/auth/register", { email, name, password }));
      if (data?.access_token) {
        localStorage.setItem("codescope_access_token", data.access_token);
        localStorage.setItem("codescope_refresh_token", data.refresh_token || "");
        setLoading(false);
        nav("app");
        return;
      }
    } catch (error) {
      console.warn("Backend registration unavailable, returning to sign in.", error?.message);
    }
    setTimeout(() => { setLoading(false); nav("login"); }, 500);
  };

  return (
    <AuthShell title="Create account" subtitle="Start understanding your codebase">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="Full name" value={form.name} onChange={set("name")} placeholder="Arjun Mehta" error={errors.name} autoFocus />
        <AuthInput label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" error={errors.email} />
        <AuthInput label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" error={errors.password} />
        <AuthInput label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter password" error={errors.confirm} />
        <AuthBtn type="submit" loading={loading}>Create account</AuthBtn>
      </form>
      <p style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 20 }}>
        Already have an account?{" "}
        <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Sign in</button>
      </p>
    </AuthShell>
  );
}

/*  FORGOT PASSWORD  */
function ForgotPage({ nav }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setError(""); setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 1200);
  };

  return (
    <AuthShell title="Reset password" subtitle="We'll send a link to your email">
      {sent ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: T.accentBright, fontSize: 12, fontWeight: 700 }}>Sent</span>
          </div>
          <p style={{ fontSize: 14, color: T.dim, textAlign: "center" }}>Check your inbox - a reset link is on its way.</p>
          <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.accent }}>Back to sign in</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" error={error} autoFocus />
          <AuthBtn onClick={handleSubmit} loading={loading}>Send reset link</AuthBtn>
          <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.faint, textAlign: "center" }}>Back to sign in</button>
        </form>
      )}
    </AuthShell>
  );
}

/*  RESET PASSWORD  */
function ResetPage({ nav }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = () => {
    const e = {};
    if (password.length < 8) e.password = "Use at least 8 characters.";
    if (password !== confirm) e.confirm = "Passwords don't match.";
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setLoading(true);
    setTimeout(() => { setLoading(false); nav("login"); }, 1200);
  };

  return (
    <AuthShell title="New password" subtitle="Choose a strong password">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="New password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" error={errors.password} autoFocus />
        <AuthInput label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" error={errors.confirm} />
        <AuthBtn type="submit" loading={loading}>Reset password</AuthBtn>
      </form>
    </AuthShell>
  );
}

/* 
   APP SHELL
 */

function SidebarItem({ item, collapsed, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isActive = active === item.id;
  return (
    <button
      className={`sidebar-item${isActive ? " active" : ""}`}
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? item.label : ""}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: collapsed ? "8px" : "7px 10px",
        borderRadius: T.r6, border: "none", width: "100%",
        cursor: "pointer", color: isActive ? T.accentBright : T.faint,
        background: "transparent", textAlign: "left",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      <item.Icon />
      {!collapsed && <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{item.label}</span>}
    </button>
  );
}

/*  Sidebar  */
function Sidebar({ collapsed, setCollapsed, activePage, setActivePage }) {
  const [wsOpen, setWsOpen] = useState(false);
  const width = collapsed ? 56 : 220;

  return (
    <aside
      className="sidebar-desktop"
      style={{
        width, minWidth: width, height: "100vh", position: "sticky", top: 0,
        background: T.surface, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden", zIndex: 20,
      }}
    >
      {/* Logo row */}
      <div style={{ height: 52, display: "flex", alignItems: "center", padding: collapsed ? "0 16px" : "0 14px", borderBottom: `1px solid ${T.border}`, gap: 8, flexShrink: 0 }}>
        <Icons.logoSm />
        {!collapsed && (
          <span style={{ fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: "-0.01em", fontFamily: T.sans, flex: 1 }}>CodeScope</span>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.faint, display: "flex", borderRadius: T.r4 }}
            aria-label="Collapse sidebar"
          >
            <Icons.menu />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.faint, display: "flex", width: "100%", justifyContent: "center" }}
            aria-label="Expand sidebar"
          >
            <Icons.menu />
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      {!collapsed && (
        <div style={{ padding: "10px 10px 6px" }}>
          <button
            onClick={() => setWsOpen(o => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${T.border}`, cursor: "pointer", color: T.dim }}
          >
            <div style={{ width: 20, height: 20, borderRadius: T.r4, background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.accentBright }}>CS</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, flex: 1, textAlign: "left" }}>codescope-ai</span>
            <Icons.chevronDown />
          </button>
          {wsOpen && (
            <div className="nav-dropdown" style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 6, marginTop: 4 }}>
              {["codescope-ai", "personal", "+ New workspace"].map(ws => (
                <button key={ws} onClick={() => setWsOpen(false)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 8px", borderRadius: T.r4, cursor: "pointer", fontSize: 12, color: T.faint }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >{ws}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto", overflowX: "hidden" }} aria-label="Main navigation">
        {NAV_ITEMS.map((item, i) =>
          item === null
            ? <div key={`div-${i}`} style={{ height: 1, background: T.border, margin: "6px 4px" }} />
            : <SidebarItem key={item.id} item={item} collapsed={collapsed} active={activePage} onClick={setActivePage} />
        )}
      </nav>

      {/* Bottom: profile + logout */}
      <div style={{ padding: "8px 8px 12px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: T.r6 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: T.accentBright }}>AM</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Arjun Mehta</div>
              <div style={{ fontSize: 11, color: T.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>arjun@company.com</div>
            </div>
          </div>
        )}
        <button
          onClick={() => {}}
          title="Sign out"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: collapsed ? "8px" : "7px 10px", borderRadius: T.r6, background: "none", border: "none", cursor: "pointer", color: T.faint, justifyContent: collapsed ? "center" : "flex-start", width: "100%" }}
          onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHov; e.currentTarget.style.color = T.error; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.faint; }}
          aria-label="Sign out"
        >
          <Icons.logout />
          {!collapsed && <span style={{ fontSize: 13 }}>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

/*  Breadcrumb  */
const BREADCRUMB_ROUTE_MAP = {
  "Dashboard": "dashboard",
  "Projects": "projects",
  "Repositories": "repos",
  "frontend-platform": "repo-overview",
  "Graph Explorer": "knowledge-graph",
  "Analysis": "repo-analysis",
  "Explorer": "repo-explorer"
};

function Breadcrumb({ trail, setActivePage }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        const targetRoute = BREADCRUMB_ROUTE_MAP[crumb];
        const isClickable = !isLast && targetRoute && setActivePage;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: T.faint, fontSize: 12, marginTop: 1 }}><Icons.chevronRight /></span>}
            <span 
              onClick={() => { if(isClickable) setActivePage(targetRoute); }}
              style={{
                fontSize: 13, color: isLast ? T.text : (isClickable ? T.dim : T.faint),
                fontWeight: isLast ? 500 : 400,
                cursor: isClickable ? "pointer" : "default",
                transition: "color 0.2s ease"
              }}
              onMouseEnter={e => { if(isClickable) e.target.style.color = T.text; }}
              onMouseLeave={e => { if(isClickable) e.target.style.color = T.dim; }}
            >{crumb}</span>
          </span>
        );
      })}
    </nav>
  );
}

/*  GlobalSearch  */
function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) { setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  return (
    <>
      {/* Search trigger */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: T.surfaceEl, border: `1px solid ${T.border}`,
          borderRadius: T.r6, padding: "6px 12px",
          cursor: "pointer", color: T.faint, width: 220,
        }}
        aria-label="Search (Ctrl+K)"
      >
        <Icons.search />
        <span style={{ fontSize: 13, flex: 1, textAlign: "left" }}>Search</span>
        <span style={{ fontSize: 11, fontFamily: T.mono, background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, padding: "1px 6px", color: T.faint }}>Ctrl K</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "18vh", animation: "fadeIn 0.12s ease" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="nav-dropdown"
            style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r12, width: "100%", maxWidth: 560, boxShadow: T.shadowLg, overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
              <Icons.search />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search files, functions, services"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: T.text }}
              />
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, display: "flex" }}>
                <Icons.x />
              </button>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: 12, color: T.faint, marginBottom: 10 }}>Recent</p>
              {["PaymentService", "BillingAdapter", "auth/login endpoint"].map(r => (
                <button key={r} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: T.r6, background: "none", border: "none", cursor: "pointer", color: T.dim, textAlign: "left", fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 11 }}>Open</span> {r}
                </button>
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12 }}>
              {[["","select"],["","navigate"],["esc","close"]].map(([k,v]) => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.faint }}>
                  <span style={{ fontFamily: T.mono, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "1px 6px" }}>{k}</span>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/*  TopNav  */
function TopNav({ breadcrumb, sidebarCollapsed, setActivePage }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [isDark] = useState(true);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header style={{
      height: 52, position: "sticky", top: 0, zIndex: 10,
      background: `${T.bg}cc`, backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
      flexShrink: 0,
    }}>
      {/* Breadcrumb */}
      <div style={{ flex: 1 }}>
        <Breadcrumb trail={breadcrumb} setActivePage={setActivePage} />
      </div>

      {/* Repo selector */}
      <div style={{ position: "relative" }} ref={notifRef}>
        <button
          onClick={() => setRepoOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${T.border}`, cursor: "pointer", color: T.dim, fontSize: 12 }}
        >
          <Icons.repo />
          <span style={{ fontFamily: T.mono, fontSize: 11 }}>main-api</span>
          <Icons.chevronDown />
        </button>
        {repoOpen && (
          <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 6, minWidth: 180, boxShadow: T.shadow, zIndex: 50 }}>
            {["main-api", "payments-service", "auth-gateway", "frontend"].map(r => (
              <button key={r} onClick={() => setRepoOpen(false)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: T.r4, background: "none", border: "none", cursor: "pointer", color: T.dim, fontSize: 12, textAlign: "left", fontFamily: T.mono }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >{r}</button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <GlobalSearch />

      {/* Notification */}
      <div style={{ position: "relative" }} ref={notifRef}>
        <button
          onClick={() => setNotifOpen(o => !o)}
          style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: T.faint, display: "flex", padding: 6, borderRadius: T.r6 }}
          aria-label="Notifications"
          onMouseEnter={e => { e.currentTarget.style.background = T.surfaceEl; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.faint; }}
        >
          <Icons.bell />
          <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: T.accent, border: `1.5px solid ${T.bg}` }} />
        </button>
        {notifOpen && (
          <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 8, width: 300, boxShadow: T.shadow, zIndex: 50 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: T.dim, padding: "4px 8px 10px" }}>Notifications</p>
            {[["Impact alert: PaymentService", "3 services at risk - 2m ago", T.warning],
              ["Analysis complete: auth-gateway", "0 breaking changes - 18m ago", T.success]].map(([t, s, c]) => (
              <div key={t} style={{ padding: "8px 10px", borderRadius: T.r6, marginBottom: 2 }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.text }}>{t}</span>
                </div>
                <p style={{ fontSize: 11, color: T.faint, marginTop: 3, marginLeft: 14 }}>{s}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      <div style={{ position: "relative" }} ref={profileRef}>
        <button
          onClick={() => setProfileOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: T.r6 }}
          aria-label="Profile menu"
          onMouseEnter={e => e.currentTarget.style.background = T.surfaceEl}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: T.accentBright }}>AM</span>
          </div>
          <Icons.chevronDown />
        </button>
        {profileOpen && (
          <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 6, width: 200, boxShadow: T.shadow, zIndex: 50 }}>
            <div style={{ padding: "8px 10px 10px", borderBottom: `1px solid ${T.border}`, marginBottom: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Arjun Mehta</p>
              <p style={{ fontSize: 11, color: T.faint }}>arjun@company.com</p>
            </div>
            {["Profile", "Account settings", "Keyboard shortcuts"].map(item => (
              <button key={item} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 10px", borderRadius: T.r4, cursor: "pointer", fontSize: 13, color: T.dim }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHov; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.dim; }}
              >{item}</button>
            ))}
            <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 6 }}>
              <button style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 10px", borderRadius: T.r4, cursor: "pointer", fontSize: 13, color: T.error }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(248,81,73,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >Sign out</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/*  PAGE CONTENT STUBS  */
function DashboardPage({ setActivePage }) {
  const [query, setQuery] = useState("");
  const [viewState, setViewState] = useState("loaded");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const go = (pageId) => setActivePage?.(pageId);
  const noProjects = viewState === "empty";
  const hasError = viewState === "error";
  const isLoading = viewState === "loading";
  const StatePreview = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ color: T.faint, fontSize: 11, fontFamily: T.mono }}>preview state</span>
      {["loaded", "loading", "empty", "error"].map(state => (
        <button key={state} onClick={() => setViewState(state)} style={{
          background: viewState === state ? T.accentSoft : T.surface,
          color: viewState === state ? T.accentBright : T.faint,
          border: `1px solid ${viewState === state ? T.accentBorder : T.border}`,
          borderRadius: T.r6,
          padding: "5px 9px",
          cursor: "pointer",
          fontSize: 11,
          textTransform: "capitalize",
        }}>{state}</button>
      ))}
    </div>
  );

  if (hasError) return <div className="dash-page page-in" style={{ padding: "32px 36px" }}><StatePreview /><WidgetShell title="Dashboard" error /></div>;
  if (isLoading) return <div className="dash-page page-in" style={{ padding: "32px 36px" }}><StatePreview /><WidgetShell title="Loading dashboard" loading /></div>;
  if (noProjects) return (
    <div className="dash-page page-in" style={{ padding: "32px 36px" }}>
      <StatePreview />
      <WidgetShell title="Welcome to CodeScope" empty action={<DashButton variant="primary" onClick={() => go("projects")}>Create Project</DashButton>} />
    </div>
  );

  return (
    <div className="dash-page page-in" style={{ padding: "28px 32px 40px", maxWidth: 1480, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 12, color: T.faint, marginBottom: 6 }}>Welcome back</p>
          <h1 style={{ fontSize: 28, fontWeight: 650, color: T.text, letterSpacing: "-0.035em", marginBottom: 8 }}>{dashboardData.user}</h1>
          <p style={{ color: T.dim, fontSize: 13 }}>{dashboardData.workspace} - {today} - Three repositories need attention before the next deploy.</p>
        </div>
        <div className="dash-header-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <DashButton variant="primary" onClick={() => go("projects")}><Icons.projects />Create Project</DashButton>
          <DashButton onClick={() => go("repos")}><Icons.repos />Upload Repository</DashButton>
          <DashButton onClick={() => go("impact")}><Icons.impact />Start Analysis</DashButton>
        </div>
      </div>

      <div className="dash-priority-grid" style={{ marginBottom: 16 }}>
        <button onClick={() => go("impact")} className="dash-card" style={{ textAlign: "left", background: "rgba(248,81,73,0.10)", border: `1px solid rgba(248,81,73,0.32)`, borderRadius: T.r8, padding: 16, cursor: "pointer" }}>
          <div style={{ color: T.error, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>Needs attention</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 650, marginBottom: 6 }}>auth-gateway health dropped to 61%</div>
          <div style={{ color: T.dim, fontSize: 12 }}>Run impact analysis before merging the release branch.</div>
        </button>
        {[
          ["Queue", "2 running", "frontend-platform parsing", T.info, "repos"],
          ["Risk", "3 critical", "1 high-risk dependency path", T.warning, "impact"],
          ["Next", "Resume main-api", "72% mapped and ready", T.accentBright, "arch"],
        ].map(([label, value, detail, color, page]) => (
          <button key={label} onClick={() => go(page)} className="dash-card" style={{ textAlign: "left", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16, cursor: "pointer" }}>
            <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ color: T.text, fontFamily: T.mono, fontSize: 20, marginBottom: 6 }}>{value}</div>
            <div style={{ color: T.faint, fontSize: 12 }}>{detail}</div>
          </button>
        ))}
      </div>

      <div className="dash-filter-row" style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) repeat(4, minmax(140px, 180px))", gap: 10, marginBottom: 18 }}>
        <label style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icons.search /></span>
          <input aria-label="Search projects" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects..." style={{ width: "100%", height: 38, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "0 82px 0 38px", outline: "none", fontSize: 13 }} />
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontFamily: T.mono, color: T.faint, fontSize: 11, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "2px 6px" }}>Ctrl K</span>
        </label>
        {["Workspace", "Repository", "Date", "Status"].map((label) => (
          <select key={label} aria-label={`${label} filter`} style={{ height: 38, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "0 10px", fontSize: 12, outline: "none" }}>
            <option>{label}</option>
          </select>
        ))}
      </div>

      <StatePreview />

      <div className="dash-grid-stats" style={{ marginBottom: 16 }}>
        {dashboardData.stats.map(([label, value, trend, color]) => <MetricCard key={label} label={label} value={value} trend={trend} color={color} />)}
      </div>

      <div className="dash-grid-main" style={{ marginBottom: 16 }}>
        <WidgetShell title="Repository Health" action={<DashButton title="Open repositories" onClick={() => go("repos")}><Icons.chevronRight />View all</DashButton>}>
          <div style={{ display: "grid", gap: 12 }}>
            {dashboardData.repos.map(repo => (
              <article key={repo.name} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: repo.color, animation: repo.risk === "Low" ? "pulseGreen 2s infinite" : "none" }} />
                      <h3 style={{ fontSize: 14, color: T.text, fontWeight: 600, fontFamily: T.mono }}>{repo.name}</h3>
                    </div>
                    <p style={{ fontSize: 12, color: T.faint }}>{repo.language} - {repo.branch} - last analysis {repo.last}</p>
                  </div>
                  <Pill color={repo.color}>{repo.risk}</Pill>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <ProgressBar value={repo.score} color={repo.color} />
                  <span style={{ fontFamily: T.mono, color: T.text, fontSize: 13 }}>{repo.score}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.dim }}>{repo.status}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <DashButton title="Open repository" onClick={() => go("repos")}><Icons.repo />Open</DashButton>
                    <DashButton title="Analyze repository" onClick={() => go("impact")}><Icons.impact />Analyze</DashButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </WidgetShell>

        <WidgetShell title="Recent Activity">
          <div style={{ display: "grid", gap: 0 }}>
            {dashboardData.activity.map(([title, repo, time, ActivityIcon], index) => (
              <div key={`${title}-${repo}`} style={{ display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10, padding: "10px 0", borderBottom: index === dashboardData.activity.length - 1 ? "none" : `1px solid ${T.border}` }}>
                <span style={{ width: 26, height: 26, borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${T.border}`, display: "grid", placeItems: "center" }}><ActivityIcon /></span>
                <div>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>{title}</div>
                  <div style={{ color: T.faint, fontSize: 12, fontFamily: T.mono }}>{repo}</div>
                </div>
                <span style={{ color: T.faint, fontSize: 11, whiteSpace: "nowrap" }}>{time}</span>
              </div>
            ))}
          </div>
        </WidgetShell>
      </div>

      <div className="dash-grid-three" style={{ marginBottom: 16 }}>
        <WidgetShell title="Continue Working">
          <div style={{ display: "grid", gap: 10 }}>
            {dashboardData.recent.map(([repo, opened, lang, progress]) => (
              <div key={repo} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 12 }}>
                <div>
                  <div style={{ color: T.text, fontFamily: T.mono, fontSize: 13, marginBottom: 4 }}>{repo}</div>
                  <div style={{ color: T.faint, fontSize: 12 }}>{lang} - {opened}</div>
                  <div style={{ marginTop: 10 }}><ProgressBar value={progress} /></div>
                </div>
                <DashButton title="Open repository" onClick={() => go("repos")}><Icons.chevronRight />Open</DashButton>
              </div>
            ))}
          </div>
        </WidgetShell>

        <WidgetShell title="Analysis Queue">
          <div style={{ display: "grid", gap: 12 }}>
            {dashboardData.queue.map(job => (
              <div key={job.repo} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: T.text, fontFamily: T.mono, fontSize: 13 }}>{job.repo}</span>
                  <span style={{ color: T.faint, fontSize: 12 }}>{job.eta}</span>
                </div>
                <ProgressBar value={job.progress} animated />
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", color: T.faint, fontSize: 11 }}>
                  {["Repository Cloned", "Scanning Files", "Parsing Code", "Building Graph", "Completed"].map(step => (
                    <span key={step} style={{ color: step === job.step ? T.accentBright : T.faint }}>{step}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </WidgetShell>

        <WidgetShell title="Repository Languages">
          <div style={{ display: "grid", gap: 11 }}>
            {dashboardData.languages.map(([lang, value, color]) => (
              <div key={lang}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: T.dim, fontSize: 12 }}>
                  <span>{lang}</span><span style={{ fontFamily: T.mono }}>{value}%</span>
                </div>
                <ProgressBar value={value} color={color} />
              </div>
            ))}
          </div>
        </WidgetShell>
      </div>

      <div className="dash-grid-three">
        <WidgetShell title="Quick Actions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {[
              ["Create Project", Icons.projects, "projects"],
              ["Upload Repository", Icons.repos, "repos"],
              ["Connect Git", Icons.git, "git"],
              ["Analyze Repository", Icons.impact, "impact"],
              ["Open Architecture Explorer", Icons.arch, "arch"],
              ["Open Dependency Explorer", Icons.deps, "deps"],
              ["Search Repository", Icons.search, "repos"],
            ].map(([label, ActionIcon, page]) => (
              <button key={label} onClick={() => go(page)} style={{ minHeight: 70, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r8, color: T.dim, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 12, textAlign: "left", fontSize: 12 }}>
                <ActionIcon />{label}
              </button>
            ))}
          </div>
        </WidgetShell>

        <WidgetShell title="Risk Overview">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            {dashboardData.risks.map(([label, value, color]) => (
              <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}40`, borderRadius: T.r8, padding: 12 }}>
                <div style={{ color, fontFamily: T.mono, fontSize: 22, marginBottom: 5 }}>{value}</div>
                <div style={{ color: T.dim, fontSize: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        </WidgetShell>

        <WidgetShell title="Favorite Projects">
          <div style={{ display: "grid", gap: 10 }}>
            {dashboardData.favorites.map(([repo, detail]) => (
              <div key={repo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span aria-hidden="true" style={{ color: T.warning, fontSize: 14 }}>*</span>
                  <div>
                    <div style={{ color: T.text, fontFamily: T.mono, fontSize: 13 }}>{repo}</div>
                    <div style={{ color: T.faint, fontSize: 12 }}>{detail}</div>
                  </div>
                </div>
                <DashButton title="Open favorite" onClick={() => go("repos")}><Icons.chevronRight />Open</DashButton>
              </div>
            ))}
          </div>
        </WidgetShell>
      </div>
    </div>
  );
}

function ProjectsPage({ setActivePage }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [menuProjectId, setMenuProjectId] = useState(null);
  const [draftProject, setDraftProject] = useState({ name: "", status: "Active" });
  const [projects, setProjects] = useState([
    { id: "p1", name: "Northstar Platform", envs: 4, repos: 12, health: 92, status: "Active" },
    { id: "p2", name: "Mobile API Gateway", envs: 2, repos: 3, health: 68, status: "Warning" },
    { id: "p3", name: "Data Warehouse", envs: 3, repos: 8, health: 98, status: "Active" },
    { id: "p4", name: "Legacy Monolith", envs: 1, repos: 1, health: 42, status: "Critical" },
    { id: "p5", name: "Customer Portal", envs: 4, repos: 5, health: 88, status: "Active" }
  ]);

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.status.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const projectTotals = {
    repos: filteredProjects.reduce((sum, project) => sum + project.repos, 0),
    envs: filteredProjects.reduce((sum, project) => sum + project.envs, 0),
    avgHealth: filteredProjects.length ? Math.round(filteredProjects.reduce((sum, project) => sum + project.health, 0) / filteredProjects.length) : 0,
  };
  const resetFilters = () => { setSearchTerm(""); setStatusFilter("All"); };
  const createProject = () => {
    const name = draftProject.name.trim();
    if (!name) return;
    const health = draftProject.status === "Critical" ? 42 : draftProject.status === "Warning" ? 68 : 90;
    setProjects(prev => [{ id: `p${Date.now()}`, name, envs: 1, repos: 0, health, status: draftProject.status }, ...prev]);
    setDraftProject({ name: "", status: "Active" });
    setShowCreate(false);
  };
  const markCritical = projectId => {
    setProjects(prev => prev.map(project => project.id === projectId ? { ...project, status: "Critical", health: Math.min(project.health, 45) } : project));
    setMenuProjectId(null);
  };
  const deleteProject = projectId => {
    setProjects(prev => prev.filter(project => project.id !== projectId));
    setMenuProjectId(null);
  };

  return (
    <div className="page-in" style={{ padding: "32px 36px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", marginBottom: 6 }}>Projects</h1>
          <p style={{ fontSize: 13, color: T.dim }}>Manage your workspaces and aggregate repository analytics.</p>
        </div>
        <DashButton icon={Icons.upload} label="New Project" variant="primary" onClick={() => setShowCreate(true)} />
      </div>

      <section aria-label="Project summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          ["Visible Projects", filteredProjects.length, T.text],
          ["Repositories", projectTotals.repos, T.info],
          ["Environments", projectTotals.envs, T.accentBright],
          ["Average Health", projectTotals.avgHealth || "-", projectTotals.avgHealth > 80 ? T.success : projectTotals.avgHealth > 50 ? T.warning : T.error],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
            <div style={{ color: T.faint, fontSize: 11, marginBottom: 6 }}>{label}</div>
            <div style={{ color, fontSize: 20, fontFamily: T.mono }}>{value}</div>
          </div>
        ))}
      </section>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 320, maxWidth: "100%" }}>
            <div style={{ position: "absolute", left: 12, top: 9, color: T.faint }}><Icons.search size={14} /></div>
            <input type="text" aria-label="Search projects" placeholder="Search projects..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setSearchTerm(""); }} style={{ width: "100%", padding: "7px 12px 7px 34px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }} />
          </div>
          <DashButton icon={Icons.gridView} label={showFilters ? "Hide Filters" : "Filter"} variant="secondary" onClick={() => setShowFilters(prev => !prev)} />
          {(searchTerm || statusFilter !== "All") && <DashButton label="Reset" variant="secondary" onClick={resetFilters} />}
          <div style={{ color: T.faint, fontSize: 12, marginLeft: "auto" }}>{filteredProjects.length} of {projects.length} projects</div>
        </div>
        {showFilters && (
          <div style={{ display: "flex", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 5, color: T.dim, fontSize: 11 }}>
              Status
              <select aria-label="Filter projects by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 180, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "7px 10px", outline: "none" }}>
                {["All", "Active", "Warning", "Critical"].map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {filteredProjects.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: T.faint, background: T.surface, borderRadius: T.r8, border: `1px solid ${T.border}` }}>
          <Icons.search size={24} />
          <div style={{ marginTop: 12, fontSize: 14 }}>No projects found matching "{searchTerm}".</div>
          <DashButton label="Clear Filters" variant="secondary" onClick={resetFilters} style={{ margin: "16px auto 0" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filteredProjects.map((p) => (
            <article key={p.id} tabIndex={0} role="button" aria-label={`Open ${p.name} repositories`} className="project-card" onClick={() => setActivePage("repos")} onKeyDown={e => { if (e.key === "Enter") setActivePage("repos"); }} style={{ position: "relative", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 20, display: "flex", flexDirection: "column", gap: 16, cursor: "pointer", transition: "all 0.2s ease", outline: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.dim, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: p.health > 80 ? T.success : p.health > 50 ? T.warning : T.error }}>? {p.status}</span>
                  </div>
                </div>
                <button aria-label={`Project actions for ${p.name}`} onClick={e => { e.stopPropagation(); setMenuProjectId(menuProjectId === p.id ? null : p.id); }} style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", padding: 4 }}><Icons.moreH size={16}/></button>
              </div>
              {menuProjectId === p.id && (
                <div role="menu" onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 44, right: 18, zIndex: 5, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, boxShadow: T.shadow, padding: 6, minWidth: 150 }}>
                  <button role="menuitem" onClick={() => setActivePage("repos")} style={projectMenuButton}>Open Repositories</button>
                  <button role="menuitem" onClick={() => markCritical(p.id)} style={projectMenuButton}>Mark Critical</button>
                  <button role="menuitem" onClick={() => deleteProject(p.id)} style={{ ...projectMenuButton, color: T.error }}>Delete</button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                <div style={{ background: T.surfaceEl, padding: "8px 12px", borderRadius: T.r6 }}>
                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>Repositories</div>
                  <div style={{ fontSize: 16, fontFamily: T.mono, color: T.text }}>{p.repos}</div>
                </div>
                <div style={{ background: T.surfaceEl, padding: "8px 12px", borderRadius: T.r6 }}>
                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>Health Score</div>
                  <div style={{ fontSize: 16, fontFamily: T.mono, color: p.health > 80 ? T.success : p.health > 50 ? T.warning : T.error }}>{p.health}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate && (
        <div role="dialog" aria-modal="true" aria-label="Create project" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 1200, display: "grid", placeItems: "center", padding: 20 }} onClick={() => setShowCreate(false)}>
          <div style={{ width: "min(460px, 100%)", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, boxShadow: T.shadowLg, padding: 20 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: T.text, fontSize: 18, marginBottom: 6 }}>New Project</h2>
            <p style={{ color: T.dim, fontSize: 13, marginBottom: 18 }}>Create a workspace container for repositories and analysis.</p>
            <label style={{ display: "grid", gap: 6, color: T.dim, fontSize: 12, marginBottom: 14 }}>
              Project Name
              <input autoFocus aria-label="Project name" value={draftProject.name} onChange={e => setDraftProject({ ...draftProject, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") createProject(); if (e.key === "Escape") setShowCreate(false); }} placeholder="payments-modernization" style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "9px 10px", outline: "none" }} />
            </label>
            <label style={{ display: "grid", gap: 6, color: T.dim, fontSize: 12, marginBottom: 20 }}>
              Initial Status
              <select aria-label="Initial project status" value={draftProject.status} onChange={e => setDraftProject({ ...draftProject, status: e.target.value })} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "9px 10px", outline: "none" }}>
                {["Active", "Warning", "Critical"].map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <DashButton label="Cancel" variant="secondary" onClick={() => setShowCreate(false)} />
              <DashButton label="Create Project" variant="primary" onClick={createProject} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const projectMenuButton = {
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  color: T.text,
  padding: "8px 10px",
  borderRadius: T.r4,
  cursor: "pointer",
  fontSize: 12,
};
/* 
   REPOSITORIES PAGE  PROMPT 5
 */

const LANG_COLORS = {
  TypeScript: "#4EADA0", Go: "#79C0FF", Java: "#F0883E",
  Python: "#58A6FF", React: "#61DAFB", JavaScript: "#D29922",
  Rust: "#F85149", Ruby: "#FF6B6B", "C#": "#9B59B6", PHP: "#8892BF",
};

const STATUS_META = {
  uploaded:  { label: "Uploaded",  color: "#4EADA0" },
  connected: { label: "Connected", color: "#58A6FF" },
  pending:   { label: "Pending",   color: "#D29922" },
  archived:  { label: "Archived",  color: "rgba(240,239,236,0.35)" },
  error:     { label: "Error",     color: "#F85149" },
};

const MOCK_REPOS = [
  { id: "r1", name: "main-api", description: "Core REST API gateway powering all client-facing services", language: "TypeScript", branch: "main", status: "uploaded", visibility: "Private", size: "14.2 MB", last: "12 min ago", analysisStatus: "Not analyzed" },
  { id: "r2", name: "payments-service", description: "Payment processing microservice with Stripe and PayPal integrations", language: "Go", branch: "release/2.4", status: "connected", visibility: "Private", size: "8.7 MB", last: "38 min ago", analysisStatus: "Not analyzed" },
  { id: "r3", name: "auth-gateway", description: "OAuth2 + JWT authentication and authorization gateway", language: "Java", branch: "main", status: "uploaded", visibility: "Internal", size: "22.1 MB", last: "1 hr ago", analysisStatus: "Not analyzed" },
  { id: "r4", name: "frontend-platform", description: "React + Vite frontend monorepo with shared design system", language: "React", branch: "develop", status: "pending", visibility: "Public", size: "", last: "2 hr ago", analysisStatus: "Not analyzed" },
  { id: "r5", name: "data-pipeline", description: "ETL pipeline for analytics ingestion and transformation", language: "Python", branch: "main", status: "archived", visibility: "Private", size: "45.3 MB", last: "3 days ago", analysisStatus: "Not analyzed" },
  { id: "r6", name: "search-indexer", description: "Full-text search indexing service built on Elasticsearch", language: "Go", branch: "feat/v3", status: "connected", visibility: "Internal", size: "", last: "5 hr ago", analysisStatus: "Not analyzed" },
];

/*  RepoBadge  */
function RepoBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20, background: `${m.color}18`, border: `1px solid ${m.color}44`, fontSize: 11, fontWeight: 500, color: m.color, whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

/*  LangDot  */
function LangDot({ lang }) {
  const color = LANG_COLORS[lang] || T.faint;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: T.dim }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {lang || "Unknown"}
    </span>
  );
}

/*  VisibilityBadge  */
function VisibilityBadge({ vis }) {
  const colors = { Private: T.faint, Internal: T.warning, Public: T.success };
  const color = colors[vis] || T.faint;
  return (
    <span style={{ fontSize: 11, color, background: `${color}16`, border: `1px solid ${color}33`, borderRadius: 4, padding: "2px 7px" }}>{vis}</span>
  );
}

/*  RepoActionsMenu  */
function RepoActionsMenu({ repo, onArchive, onDelete, onClose }) {
  return (
    <div
      style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: T.r8, padding: 6, minWidth: 160, boxShadow: T.shadowLg, zIndex: 100 }}
      onClick={e => e.stopPropagation()}
    >
      {[
        { label: "Open", icon: "", action: onClose },
        { label: "Edit details", icon: "", action: onClose },
        { label: "Settings", icon: "", action: onClose },
      ].map(({ label, icon, action }) => (
        <button key={label} onClick={action} className="repo-action-btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "none", border: "none", color: T.dim, fontSize: 12, cursor: "pointer", borderRadius: T.r6, textAlign: "left" }}>
          <span style={{ fontSize: 13, width: 16, color: T.faint }}>{icon}</span>{label}
        </button>
      ))}
      <div style={{ height: 1, background: T.border, margin: "4px 0" }} />
      <button onClick={() => { onArchive(repo.id); onClose(); }} className="repo-action-btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "none", border: "none", color: T.dim, fontSize: 12, cursor: "pointer", borderRadius: T.r6, textAlign: "left" }}>
        <span style={{ fontSize: 11, width: 42, color: T.faint }}>Archive</span>
      </button>
      <button onClick={() => { onDelete(repo.id); onClose(); }} className="repo-action-btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "none", border: "none", color: T.error, fontSize: 12, cursor: "pointer", borderRadius: T.r6, textAlign: "left" }}>
        <span style={{ fontSize: 11, width: 42 }}>Delete</span>
      </button>
    </div>
  );
}

/*  RepoCard (Grid View)  */
function RepoCard({ repo, isFav, onFav, onArchive, onDelete, isNew, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isArchived = repo.status === "archived";
  return (
    <article className={`repo-card ${isNew ? "repo-card-new" : ""}`} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 18, display: "flex", flexDirection: "column", gap: 14, position: "relative", opacity: isArchived ? 0.65 : 1 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div onClick={onSelect} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: "pointer" }}>
          <div style={{ width: 34, height: 34, borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: LANG_COLORS[repo.language] || T.faint, fontSize: 10, fontFamily: T.mono, fontWeight: 700 }}>{(repo.language || "?").slice(0,2).toUpperCase()}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: T.text, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repo.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.faint }}>Branch: {repo.branch}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onFav(repo.id)} aria-label={isFav ? "Remove favorite" : "Add favorite"} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: isFav ? "#D29922" : T.faint, fontSize: 15, display: "flex", alignItems: "center", borderRadius: T.r4 }}>
            {isFav ? "Starred" : "Star"}
          </button>
          <div style={{ position: "relative" }} ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Actions" style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", color: T.faint, display: "flex", alignItems: "center", borderRadius: T.r4, fontSize: 12, lineHeight: 1 }}>Actions</button>
            {menuOpen && <RepoActionsMenu repo={repo} onArchive={onArchive} onDelete={onDelete} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 12, color: T.dim, lineHeight: "1.5", minHeight: 36 }}>{repo.description}</p>

      {/* Meta chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <LangDot lang={repo.language} />
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.faint }} />
        <RepoBadge status={repo.status} />
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.faint }} />
        <VisibilityBadge vis={repo.visibility} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{ fontSize: 11, color: T.faint }}>Size: {repo.size}</span>
          <span style={{ fontSize: 11, color: T.faint }}>Updated: {repo.last}</span>
        </div>
        <span style={{ fontSize: 11, color: T.faint, fontFamily: T.mono }}>{repo.analysisStatus}</span>
      </div>
    </article>
  );
}

/*  RepoListRow (List View)  */
function RepoListRow({ repo, isFav, onFav, onArchive, onDelete, isNew, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div onClick={onSelect} className={`repo-list-row ${isNew ? "repo-card-new" : ""}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, opacity: repo.status === "archived" ? 0.6 : 1, cursor: "pointer" }}>
      <div style={{ width: 28, height: 28, borderRadius: T.r6, background: T.surfaceEl, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontFamily: T.mono, color: LANG_COLORS[repo.language] || T.faint, fontWeight: 700 }}>{(repo.language || "?").slice(0,2).toUpperCase()}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{repo.name}</div>
        <div style={{ fontSize: 11, color: T.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repo.description}</div>
      </div>
      <LangDot lang={repo.language} />
      <span style={{ fontSize: 11, fontFamily: T.mono, color: T.faint, minWidth: 80, textAlign: "center" }}>Branch: {repo.branch}</span>
      <RepoBadge status={repo.status} />
      <VisibilityBadge vis={repo.visibility} />
      <span style={{ fontSize: 11, color: T.faint, minWidth: 60, textAlign: "right" }}>{repo.last}</span>
      <button onClick={() => onFav(repo.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: isFav ? "#D29922" : T.faint, padding: 4, flexShrink: 0 }}>{isFav ? "Starred" : "Star"}</button>
      <div style={{ position: "relative" }} ref={menuRef}>
        <button onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, fontSize: 12, padding: 4, lineHeight: 1, flexShrink: 0 }}>Actions</button>
        {menuOpen && <RepoActionsMenu repo={repo} onArchive={onArchive} onDelete={onDelete} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
  );
}

/*  Skeleton Cards  */
function RepoSkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="dash-skeleton" style={{ height: 210, borderRadius: T.r8 }} />
      ))}
    </div>
  );
}

function RepoSkeletonList() {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, overflow: "hidden" }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="dash-skeleton" style={{ height: 56, borderRadius: 0, marginBottom: 1 }} />
      ))}
    </div>
  );
}

/*  Empty State  */
function RepoEmptyState({ onUpload, onGit }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r12, animation: "fadeIn 0.3s ease" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.accentBright} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 650, color: T.text, marginBottom: 8, letterSpacing: "-0.02em" }}>No repositories yet</h3>
      <p style={{ fontSize: 13, color: T.dim, maxWidth: 440, margin: "0 auto 28px", lineHeight: "1.6" }}>
        Repositories are the source code units that CodeScope AI will index and analyze. Add a ZIP archive or connect a remote Git URL to get started.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onUpload} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: T.accent, border: "none", borderRadius: T.r6, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}> Upload ZIP</button>
        <button onClick={onGit} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, fontSize: 13, cursor: "pointer" }}>Connect Git</button>
      </div>
    </div>
  );
}

/*  Error State  */
function RepoErrorState({ onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", background: `${T.error}08`, border: `1px solid ${T.error}30`, borderRadius: T.r12 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}></div>
      <h3 style={{ fontSize: 16, fontWeight: 650, color: T.text, marginBottom: 6 }}>Unable to load repositories</h3>
      <p style={{ fontSize: 13, color: T.dim, marginBottom: 24 }}>Check your project connection and try again.</p>
      <button onClick={onRetry} style={{ padding: "8px 20px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, fontSize: 12, cursor: "pointer" }}>Retry</button>
    </div>
  );
}

/*  DropZone  */
function DropZone({ onFile, selectedFile }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = e => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={drag ? "drop-active" : ""}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !selectedFile && inputRef.current?.click()}
      style={{ border: `2px dashed ${drag ? T.accentBright : T.borderMid}`, borderRadius: T.r8, padding: "36px 24px", textAlign: "center", cursor: selectedFile ? "default" : "pointer", background: drag ? T.accentSoft : T.bg, transition: "all 0.2s" }}
    >
      <input ref={inputRef} type="file" accept=".zip" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      {selectedFile ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.accentBright }}>ZIP</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{selectedFile.name}</div>
            <div style={{ fontSize: 11, color: T.faint }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB  ZIP archive</div>
          </div>
          <button onClick={e => { e.stopPropagation(); onFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, fontSize: 12, marginLeft: 8 }}>Clear</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 32, marginBottom: 10 }}></div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.dim, marginBottom: 4 }}>Drop your ZIP archive here</div>
          <div style={{ fontSize: 12, color: T.faint, marginBottom: 14 }}>or click to browse files</div>
          <span style={{ fontSize: 11, color: T.faint, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "3px 10px" }}>.zip only  any size</span>
        </>
      )}
    </div>
  );
}

/*  Upload Modal  */
function UploadModal({ onClose, onRepoAdded, initialTab = "zip" }) {
  const [tab, setTab] = useState(initialTab);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null); // null | 0-100
  const [done, setDone] = useState(false);
  // ZIP form fields
  const [repoName, setRepoName] = useState("");
  const [repoDesc, setRepoDesc] = useState("");
  const [repoVis, setRepoVis] = useState("Private");
  // Git form fields
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [gitName, setGitName] = useState("");
  const [gitDesc, setGitDesc] = useState("");
  const [gitVis, setGitVis] = useState("Private");
  const [errors, setErrors] = useState({});

  const handleUpload = () => {
    const errs = {};
    if (!repoName.trim()) errs.name = "Repository name is required";
    if (!file) errs.file = "Please select a ZIP file";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 5;
      if (p >= 100) { p = 100; clearInterval(iv); setDone(true);
        setTimeout(() => {
          onRepoAdded({ id: `r${Date.now()}`, name: repoName, description: repoDesc || "Uploaded repository", language: "Unknown", branch: "main", status: "uploaded", visibility: repoVis, size: `${(file.size/1024/1024).toFixed(1)} MB`, last: "Just now", analysisStatus: "Not analyzed" });
          onClose();
        }, 800);
      }
      setProgress(Math.min(Math.round(p), 100));
    }, 160);
  };

  const handleGitConnect = () => {
    const errs = {};
    if (!gitName.trim()) errs.gitName = "Repository name is required";
    if (!gitUrl.trim()) errs.gitUrl = "Git URL is required";
    if (gitUrl && !gitUrl.startsWith("http")) errs.gitUrl = "URL must start with http:// or https://";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    onRepoAdded({ id: `r${Date.now()}`, name: gitName, description: gitDesc || "Git connected repository", language: "Unknown", branch: gitBranch || "main", status: "connected", visibility: gitVis, size: "", last: "Just now", analysisStatus: "Not analyzed" });
    onClose();
  };

  const tabStyle = active => ({
    flex: 1, padding: "9px 0", background: "none", border: "none", borderBottom: `2px solid ${active ? T.accentBright : "transparent"}`, color: active ? T.accentBright : T.faint, fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s"
  });

  const fieldStyle = err => ({ width: "100%", background: T.bg, border: `1px solid ${err ? T.error : T.borderMid}`, borderRadius: T.r6, color: T.text, padding: "9px 12px", fontSize: 13, outline: "none" });
  const labelStyle = { fontSize: 11, fontWeight: 500, color: T.dim, marginBottom: 5, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, animation: "fadeIn 0.15s ease" }} onClick={onClose}>
      <div style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r12, width: "100%", maxWidth: 500, boxShadow: T.shadowLg, animation: "slideUp 0.22s ease", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "18px 22px 0", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: T.text, letterSpacing: "-0.02em" }}>Add Repository</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, fontSize: 12, lineHeight: 1 }}>Close</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            <button className="upload-tab" style={tabStyle(tab === "zip")} onClick={() => setTab("zip")}> Upload ZIP</button>
            <button className="upload-tab" style={tabStyle(tab === "git")} onClick={() => setTab("git")}>Connect Git</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "zip" && (
            <>
              <div>
                <label style={labelStyle}>Repository Name *</label>
                <input value={repoName} onChange={e => setRepoName(e.target.value)} placeholder="e.g. auth-service" style={fieldStyle(errors.name)} />
                {errors.name && <span style={{ fontSize: 11, color: T.error }}>{errors.name}</span>}
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={repoDesc} onChange={e => setRepoDesc(e.target.value)} placeholder="Brief description..." style={fieldStyle(false)} />
              </div>
              <div>
                <label style={labelStyle}>Visibility</label>
                <select value={repoVis} onChange={e => setRepoVis(e.target.value)} style={{ ...fieldStyle(false), cursor: "pointer" }}>
                  <option>Private</option><option>Internal</option><option>Public</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>ZIP File *</label>
                <DropZone onFile={setFile} selectedFile={file} />
                {errors.file && <span style={{ fontSize: 11, color: T.error }}>{errors.file}</span>}
              </div>
              {progress !== null && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: T.dim }}>{done ? "Upload complete!" : "Uploading"}</span>
                    <span style={{ fontSize: 12, fontFamily: T.mono, color: done ? T.success : T.accentBright }}>{progress}%</span>
                  </div>
                  <div style={{ height: 6, background: T.surfaceEl, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: done ? T.success : T.accentBright, borderRadius: 99, transition: "width 0.15s ease" }} />
                  </div>
                </div>
              )}
              {progress === null && (
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={onClose} style={{ padding: "8px 16px", background: "none", border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleUpload} style={{ padding: "8px 18px", background: T.accent, border: "none", borderRadius: T.r6, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Upload Repository</button>
                </div>
              )}
            </>
          )}

          {tab === "git" && (
            <>
              <div>
                <label style={labelStyle}>Repository Name *</label>
                <input value={gitName} onChange={e => setGitName(e.target.value)} placeholder="e.g. payments-service" style={fieldStyle(errors.gitName)} />
                {errors.gitName && <span style={{ fontSize: 11, color: T.error }}>{errors.gitName}</span>}
              </div>
              <div>
                <label style={labelStyle}>Git URL *</label>
                <input value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/org/repo" style={fieldStyle(errors.gitUrl)} />
                {errors.gitUrl && <span style={{ fontSize: 11, color: T.error }}>{errors.gitUrl}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Branch</label>
                  <input value={gitBranch} onChange={e => setGitBranch(e.target.value)} placeholder="main" style={fieldStyle(false)} />
                </div>
                <div>
                  <label style={labelStyle}>Visibility</label>
                  <select value={gitVis} onChange={e => setGitVis(e.target.value)} style={{ ...fieldStyle(false), cursor: "pointer" }}>
                    <option>Private</option><option>Internal</option><option>Public</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={gitDesc} onChange={e => setGitDesc(e.target.value)} placeholder="Brief description..." style={fieldStyle(false)} />
              </div>
              <div style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "10px 14px" }}>
                <p style={{ fontSize: 12, color: T.faint }}> The repository URL will be stored but <strong style={{ color: T.dim }}>not cloned yet</strong>. Analysis and cloning happen in Phase 3.</p>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ padding: "8px 16px", background: "none", border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleGitConnect} style={{ padding: "8px 18px", background: T.accent, border: "none", borderRadius: T.r6, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Connect Repository</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/*  REPOSITORIES PAGE  */
function RepositoriesPage({ setActivePage }) {
  const setSelectedRepository = useCodeScopeUiStore(state => state.setSelectedRepository);
  const [viewState, setViewState] = useState("loaded"); // loading|loaded|empty|error
  const [viewMode, setViewMode] = useState("grid");     // grid|list
  const [repos, setRepos] = useState(MOCK_REPOS);
  const [newIds, setNewIds] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set(["r2"]));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all");
  const [visFilter, setVisFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [favOnly, setFavOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitTab, setModalInitTab] = useState("zip");

  const openUpload = (tab = "zip") => { setModalInitTab(tab); setModalOpen(true); };

  const handleRepoAdded = repo => {
    setRepos(prev => [repo, ...prev]);
    setNewIds(prev => new Set([...prev, repo.id]));
    setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(repo.id); return n; }), 1200);
  };

  const handleFav = id => setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleArchive = id => setRepos(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "archived" ? "uploaded" : "archived" } : r));
  const handleDelete = id => setRepos(prev => prev.filter(r => r.id !== id));

  // Filter + sort
  let filtered = repos.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (langFilter !== "all" && r.language !== langFilter) return false;
    if (visFilter !== "all" && r.visibility !== visFilter) return false;
    if (favOnly && !favorites.has(r.id)) return false;
    return true;
  });
  if (sortBy === "az") filtered = [...filtered].sort((a,b) => a.name.localeCompare(b.name));
  if (sortBy === "za") filtered = [...filtered].sort((a,b) => b.name.localeCompare(a.name));
  // newest = default order (already newest first)

  const allLangs = [...new Set(repos.map(r => r.language).filter(Boolean))];

  const isEmpty = viewState === "loaded" && filtered.length === 0 && !search && statusFilter === "all" && langFilter === "all" && visFilter === "all" && !favOnly;
  const noResults = viewState === "loaded" && filtered.length === 0 && !isEmpty;

  const StatePreview = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
      <span style={{ color: T.faint, fontSize: 11, fontFamily: T.mono }}>preview state:</span>
      {["loaded","loading","empty","error"].map(s => (
        <button key={s} onClick={() => setViewState(s)} style={{ background: viewState===s?T.accentSoft:T.surfaceEl, color: viewState===s?T.accentBright:T.faint, border: `1px solid ${viewState===s?T.accentBorder:T.border}`, borderRadius: T.r6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>{s}</button>
      ))}
    </div>
  );

  return (
    <div className="page-in" style={{ padding: "28px 32px 48px", maxWidth: 1480, margin: "0 auto" }}>
      <StatePreview />

      {/*  Page Header  */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 650, color: T.text, letterSpacing: "-0.03em", marginBottom: 4 }}>Repositories</h1>
          <p style={{ fontSize: 13, color: T.faint }}>Manage source code repositories attached to this project. Upload a ZIP or connect a remote Git URL.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button onClick={() => openUpload("git")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, fontSize: 12, cursor: "pointer" }}>Connect Git</button>
          <button onClick={() => openUpload("zip")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: T.accent, border: "none", borderRadius: T.r6, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Upload Repository</button>
        </div>
      </div>

      {/*  Stats Strip  */}
      {viewState === "loaded" && repos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total", value: repos.length, color: T.accentBright },
            { label: "Uploaded", value: repos.filter(r=>r.status==="uploaded").length, color: T.accentBright },
            { label: "Connected", value: repos.filter(r=>r.status==="connected").length, color: T.info },
            { label: "Archived", value: repos.filter(r=>r.status==="archived").length, color: T.faint },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T.faint, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, fontFamily: T.mono, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/*  Search + Filter Bar  */}
      {viewState === "loaded" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.faint }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repositories" aria-label="Search repositories" style={{ width: "100%", height: 36, background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: T.r6, color: T.text, padding: "0 12px 0 34px", fontSize: 13, outline: "none" }} />
            </div>

            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" style={{ height: 36, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "0 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
              <option value="all">All Status</option>
              <option value="uploaded">Uploaded</option>
              <option value="connected">Connected</option>
              <option value="pending">Pending</option>
              <option value="archived">Archived</option>
            </select>

            {/* Language filter */}
            <select value={langFilter} onChange={e => setLangFilter(e.target.value)} aria-label="Filter by language" style={{ height: 36, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "0 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
              <option value="all">All Languages</option>
              {allLangs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* Visibility filter */}
            <select value={visFilter} onChange={e => setVisFilter(e.target.value)} aria-label="Filter by visibility" style={{ height: 36, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "0 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
              <option value="all">All Visibility</option>
              <option value="Private">Private</option>
              <option value="Internal">Internal</option>
              <option value="Public">Public</option>
            </select>

            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort by" style={{ height: 36, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "0 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
              <option value="newest">Newest</option>
              <option value="az">A  Z</option>
              <option value="za">Z  A</option>
            </select>

            {/* Favorites toggle */}
            <button onClick={() => setFavOnly(f => !f)} aria-label="Show favorites only" style={{ height: 36, padding: "0 14px", background: favOnly ? T.accentSoft : T.surfaceEl, border: `1px solid ${favOnly ? T.accentBorder : T.border}`, borderRadius: T.r6, color: favOnly ? T.accentBright : T.faint, fontSize: 12, cursor: "pointer", fontWeight: favOnly ? 500 : 400 }}>Starred Favorites</button>

            {/* View toggle */}
            <div style={{ display: "flex", border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: "hidden", flexShrink: 0 }}>
              {[["grid","Grid"],["list","List"]].map(([mode, icon]) => (
                <button key={mode} onClick={() => setViewMode(mode)} aria-label={`${mode} view`} style={{ padding: "6px 12px", background: viewMode===mode ? T.accentSoft : T.surfaceEl, border: "none", color: viewMode===mode ? T.accentBright : T.faint, cursor: "pointer", fontSize: 14 }}>{icon}</button>
              ))}
            </div>
          </div>

          {/* Active filter count */}
          {(search || statusFilter !== "all" || langFilter !== "all" || visFilter !== "all" || favOnly) && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: T.faint }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
              <button onClick={() => { setSearch(""); setStatusFilter("all"); setLangFilter("all"); setVisFilter("all"); setFavOnly(false); }} style={{ fontSize: 11, color: T.accentBright, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>Clear all filters</button>
            </div>
          )}
        </div>
      )}

      {/*  Content Area  */}
      {viewState === "loading" && (viewMode === "grid" ? <RepoSkeletonGrid /> : <RepoSkeletonList />)}

      {viewState === "error" && <RepoErrorState onRetry={() => setViewState("loaded")} />}

      {viewState === "loaded" && isEmpty && (
        <RepoEmptyState onUpload={() => openUpload("zip")} onGit={() => openUpload("git")} />
      )}

      {viewState === "loaded" && noResults && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: T.faint }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.dim, marginBottom: 6 }}>No repositories match your filters</div>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setLangFilter("all"); setVisFilter("all"); setFavOnly(false); }} style={{ marginTop: 12, fontSize: 12, color: T.accentBright, background: "none", border: "none", cursor: "pointer" }}>Clear filters</button>
        </div>
      )}

      {viewState === "loaded" && filtered.length > 0 && (
        viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filtered.map(r => (
              <RepoCard key={r.id} repo={r} isFav={favorites.has(r.id)} onFav={handleFav} onArchive={handleArchive} onDelete={handleDelete} isNew={newIds.has(r.id)} onSelect={() => { setSelectedRepository(r); setActivePage('repo-overview'); }} />
            ))}
          </div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: `1px solid ${T.border}`, background: T.surfaceEl }}>
              {["NAME","LANGUAGE","BRANCH","STATUS","VISIBILITY","UPDATED","",""].map((h,i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: T.faint, letterSpacing: "0.06em", flex: i===0?1:"none", minWidth: [0,80,80,80,70,60,20,20][i]||"auto" }}>{h}</span>
              ))}
            </div>
            {filtered.map(r => (
              <RepoListRow key={r.id} repo={r} isFav={favorites.has(r.id)} onFav={handleFav} onArchive={handleArchive} onDelete={handleDelete} isNew={newIds.has(r.id)} onSelect={() => { setSelectedRepository(r); setActivePage('repo-overview'); }} />
            ))}
          </div>
        )
      )}

      {/*  Upload Modal  */}
      {modalOpen && <UploadModal onClose={() => setModalOpen(false)} onRepoAdded={handleRepoAdded} initialTab={modalInitTab} />}
    </div>
  );
}



/* 
   REPOSITORY OVERVIEW PAGE
 */

function RepoOverviewHeader({ repo, setActivePage, onAnalyze, analyzing }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: T.r8, background: T.surfaceEl, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, fontFamily: T.mono, color: LANG_COLORS[repo.language] || T.faint }}>
          {repo.language.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", margin: 0 }}>{repo.name}</h1>
            <RepoBadge status={repo.status} />
            <VisibilityBadge vis={repo.visibility} />
            <button aria-label="Favorite" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#D29922", fontSize: 12 }}>Starred</button>
          </div>
          <p style={{ color: T.dim, fontSize: 14, marginBottom: 8, margin: "4px 0 8px 0" }}>{repo.description}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: T.faint }}>
            <span>Project: {repo.project || "Default Project"}</span>
            <span> {repo.branch}</span>
            <span>Updated {repo.last}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <DashButton variant="ghost" title="Refresh"><span style={{fontSize:12}}>Refresh</span></DashButton>
        <DashButton variant="secondary" title="Open Settings"><Icons.settings /></DashButton>
        <DashButton variant="secondary" title="Archive"><Icons.archive /></DashButton>
        <DashButton variant="secondary" title="Open Explorer"><Icons.file /></DashButton>
        <DashButton variant="primary" onClick={onAnalyze} loading={analyzing}>{analyzing ? "Analyzing..." : "Analyze Repository"}</DashButton>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = T.text }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, color: T.faint }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, color }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: T.dim }}>{sub}</span>}
      </div>
    </div>
  );
}

function AnalysisTimeline() {
  const steps = ["Repository Uploaded", "Waiting For Analysis", "Scanning", "Parsing", "Graph Generation", "Completed"];
  const currentStep = 5; // Completed for this demo
  return (
    <WidgetShell title="Analysis Status">
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginTop: 10, paddingBottom: 10 }}>
        <div style={{ position: "absolute", top: 12, left: 20, right: 20, height: 2, background: T.borderMid, zIndex: 0 }} />
        <div style={{ position: "absolute", top: 12, left: 20, width: "100%", height: 2, background: T.accent, zIndex: 1 }} />
        {steps.map((step, i) => {
          const isActive = i <= currentStep;
          return (
            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 2, width: 80 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: isActive ? T.accent : T.surfaceEl, border: `2px solid ${isActive ? T.accent : T.borderMid}`, display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "#fff" : T.faint }}>
                {isActive ? <Icons.check size={14} stroke="#fff" strokeWidth={3}/> : <span style={{ fontSize: 10 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: 11, color: isActive ? T.text : T.faint, textAlign: "center", lineHeight: 1.2 }}>{step}</span>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

function QuickNavCard({ title, icon, desc, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 20, cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", gap: 12 }} className="repo-card">
      <div style={{ color: T.accentBright }}>{icon}</div>
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4, marginTop: 0 }}>{title}</h4>
        <p style={{ fontSize: 12, color: T.faint, lineHeight: 1.4, margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}

function TechBadge({ name }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, padding: "4px 10px", fontSize: 12, color: T.text, fontFamily: T.mono }}>
      {name}
    </span>
  );
}


function RepoOverviewSkeleton() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: T.r8, background: T.surfaceEl }} className="skeleton-pulse" />
        <div style={{ flex: 1 }}>
          <div style={{ width: 200, height: 24, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 12 }} className="skeleton-pulse" />
          <div style={{ width: "60%", height: 14, background: T.surfaceEl, borderRadius: T.r4 }} className="skeleton-pulse" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ height: 100, background: T.surface, borderRadius: T.r8 }} className="skeleton-pulse" />)}
      </div>
    </div>
  );
}

function RepoOverviewPage({ setActivePage }) {
  const [status, setStatus] = useState("success"); // "loading" | "error" | "empty" | "success"
  const queryClient = useQueryClient();
  const selectedRepositoryId = useCodeScopeUiStore(state => state.selectedRepositoryId);
  const selectedRepositoryName = useCodeScopeUiStore(state => state.selectedRepositoryName);
  const startAnalysis = useMutation({
    mutationFn: () => analysisApi.start(selectedRepositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", selectedRepositoryId] });
      setActivePage("repo-analysis");
    },
    onError: () => setActivePage("repo-analysis"),
  });

  const repo = { 
    id: selectedRepositoryId, name: selectedRepositoryName || "main-api", project: "Core UI", language: "TypeScript", branch: "main", status: "Healthy", 
    last: "12 min ago", size: "24.5 MB", visibility: "Private", description: "Core frontend platform monorepo containing shared UI components, state management, and the main application shell.",
    tags: ["frontend", "monorepo", "design-system"]
  };

  if (status === "loading") return <RepoOverviewSkeleton />;
  if (status === "error") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 120px)", color: T.faint }}>
      <Icons.error size={48} stroke={T.error} />
      <h2 style={{ color: T.text, marginTop: 16 }}>Unable to load repository overview</h2>
      <p style={{ color: T.dim, marginTop: 8 }}>The overview metrics could not be loaded at this time.</p>
      <DashButton variant="primary" style={{ marginTop: 16 }} onClick={() => setStatus("success")}>Retry</DashButton>
    </div>
  );
  if (status === "empty") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 120px)", color: T.faint }}>
      <Icons.file size={48} />
      <h2 style={{ color: T.text, marginTop: 16 }}>Repository is Empty</h2>
      <p style={{ color: T.dim, marginTop: 8 }}>This repository does not contain any branches or code files yet.</p>
      <DashButton variant="primary" style={{ marginTop: 16 }} onClick={() => setStatus("success")}>Reload</DashButton>
    </div>
  );

  return (
    <div className="page-in" style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      
      {/* Dev Switch State controls */}
      <div style={{ display: "flex", gap: 10, background: T.surface, border: `1px solid ${T.border}`, padding: 8, borderRadius: T.r6, marginBottom: 24, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 12, color: T.faint, alignSelf: "center", marginRight: 10 }}>Dev controls:</span>
        <button onClick={() => setStatus("loading")} style={{ fontSize: 11, background: T.surfaceEl, border: `1px solid ${T.border}`, color: T.text, padding: "4px 8px", cursor: "pointer", borderRadius: T.r4 }}>Simulate Loading</button>
        <button onClick={() => setStatus("error")} style={{ fontSize: 11, background: T.surfaceEl, border: `1px solid ${T.border}`, color: T.text, padding: "4px 8px", cursor: "pointer", borderRadius: T.r4 }}>Simulate Error</button>
        <button onClick={() => setStatus("empty")} style={{ fontSize: 11, background: T.surfaceEl, border: `1px solid ${T.border}`, color: T.text, padding: "4px 8px", cursor: "pointer", borderRadius: T.r4 }}>Simulate Empty</button>
        <button onClick={() => setStatus("success")} style={{ fontSize: 11, background: T.surfaceEl, border: `1px solid ${T.border}`, color: T.text, padding: "4px 8px", cursor: "pointer", borderRadius: T.r4 }}>Simulate Success</button>
      </div>

      {startAnalysis.isError && (
        <div style={{ background: `${T.error}12`, border: `1px solid ${T.error}44`, color: T.text, borderRadius: T.r6, padding: 12, marginBottom: 16, fontSize: 13 }}>
          {friendlyApiError(startAnalysis.error)}
        </div>
      )}
      <RepoOverviewHeader repo={repo} setActivePage={setActivePage} onAnalyze={() => startAnalysis.mutate()} analyzing={startAnalysis.isPending} />

      {/* Page-level Search & Filters (Placeholders) */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: T.faint }}><Icons.search size={16} /></span>
          <input type="text" placeholder="Search within repository..." style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "8px 12px 8px 36px", color: T.text, outline: "none" }} />
        </div>
        <select style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, padding: "0 12px", borderRadius: T.r6, outline: "none" }}>
          <option>Analysis Status: All</option>
        </select>
        <select style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, padding: "0 12px", borderRadius: T.r6, outline: "none" }}>
          <option>Language: All</option>
        </select>
        <select style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, padding: "0 12px", borderRadius: T.r6, outline: "none" }}>
          <option>Folder: Root</option>
        </select>
        <select style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, padding: "0 12px", borderRadius: T.r6, outline: "none" }}>
          <option>Date: Any</option>
        </select>
      </div>

      {/* Repo Health & Summary Grid */}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 16, marginTop: 0 }}>Repository Health</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Health Score" value="94" sub="/ 100" color={T.success} />
        <StatCard label="Analysis Status" value="Healthy" color={T.success} />
        <StatCard label="Total Files" value="1,248" />
        <StatCard label="Total Folders" value="142" />
        <StatCard label="Programming Languages" value="TS, React" />
        <StatCard label="Last Analysis" value="2 hours ago" />
        <StatCard label="Repository Size" value="24.5 MB" />
        <StatCard label="Total Commits" value="482" sub="placeholder" />
        <StatCard label="Risk Score" value="Low" sub="placeholder" color={T.success} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 16, marginTop: 0 }}>Repository Summary</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Main Language" value="TS" />
        <StatCard label="Framework" value="React" sub="Placeholder" />
        <StatCard label="Total Modules" value="12" />
        <StatCard label="Total Functions" value="4.2k" sub="Placeholder" />
        <StatCard label="Total Classes" value="156" sub="Placeholder" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <AnalysisTimeline />
      </div>

      {/* Quick Nav Grid */}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 16, marginTop: 0 }}>Quick Navigation</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        <QuickNavCard title="File Explorer" desc="Browse the source tree and view individual files." icon={<Icons.file size={20} />} onClick={() => setActivePage('repo-explorer')} />
        <QuickNavCard title="Repository Analysis" desc="Deep dive into codebase metrics and health." icon={<Icons.impact size={20} />} onClick={() => setActivePage('repo-analysis')} />
        <QuickNavCard title="Architecture Explorer" desc="View the high-level module graph and system design." icon={<Icons.arch size={20} />} onClick={() => setActivePage('arch')} />
        <QuickNavCard title="Dependency Explorer" desc="Trace imports, exports, and circular dependencies." icon={<Icons.deps size={20} />} onClick={() => setActivePage('deps')} />
        <QuickNavCard title="Git Intelligence" desc="View commits, contributors, and branching strategy." icon={<Icons.git size={20} />} onClick={() => setActivePage('git')} />
        <QuickNavCard title="Settings" desc="Configure rules, environments, and access." icon={<Icons.settings size={20} />} onClick={() => setActivePage('settings')} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <WidgetShell title="Technologies Used">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <TechBadge name="TypeScript" />
              <TechBadge name="React" />
              <TechBadge name="Node.js" />
              <TechBadge name="Tailwind CSS" />
              <TechBadge name="Vite" />
              <TechBadge name="Jest" />
              <TechBadge name="Docker" />
            </div>
          </WidgetShell>

          <WidgetShell title="Repository Insights (Available after analysis)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 16 }}>
                <span style={{ fontSize: 12, color: T.faint }}>Largest Module</span>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginTop: 4 }}>/packages/ui-components</div>
              </div>
              <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 16 }}>
                <span style={{ fontSize: 12, color: T.faint }}>Most Active Folder</span>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginTop: 4 }}>/src/api</div>
              </div>
              <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 16 }}>
                <span style={{ fontSize: 12, color: T.faint }}>Most Imported File</span>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginTop: 4 }}>utils.ts</div>
              </div>
              <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 16 }}>
                <span style={{ fontSize: 12, color: T.faint }}>Largest Service</span>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginTop: 4 }}>AuthService.ts</div>
              </div>
              <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 16 }}>
                <span style={{ fontSize: 12, color: T.faint }}>Most Complex File</span>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginTop: 4 }}>DataGrid.tsx</div>
              </div>
            </div>
          </WidgetShell>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <WidgetShell title="Information Panel">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Owner</span><span style={{ color: T.text }}>Frontend Team</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Workspace</span><span style={{ color: T.text }}>Northstar Platform</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Project</span><span style={{ color: T.text }}>{repo.project}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Repository ID</span><span style={{ color: T.text, fontFamily: T.mono }}>{repo.id}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Created</span><span style={{ color: T.text }}>Oct 12, 2025</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Last Updated</span><span style={{ color: T.text }}>{repo.last}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Default Branch</span><span style={{ color: T.text }}>{repo.branch}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Visibility</span><span style={{ color: T.text }}>{repo.visibility}</span></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {repo.tags.map(tag => <span key={tag} style={{background: T.surfaceEl, padding: "2px 6px", borderRadius: T.r4, fontSize: 11, color: T.faint}}>#{tag}</span>)}
              </div>
            </div>
          </WidgetShell>

          <WidgetShell title="Recent Activity">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { title: "Repository Renamed", time: "10 min ago", icon: <Icons.settings size={14} /> },
                { title: "Analysis Completed", time: "12 min ago", icon: <Icons.check size={14} stroke={T.success} /> },
                { title: "Analysis Started", time: "15 min ago", icon: <Icons.ai size={14} /> },
                { title: "Settings Updated", time: "2 hours ago", icon: <Icons.settings size={14} /> },
                { title: "Repository Uploaded", time: "1 day ago", icon: <Icons.upload size={14} /> },
              ].map((act, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.surfaceEl, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {act.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.2 }}>{act.title}</div>
                    <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </WidgetShell>
        </div>
      </div>
    </div>
  );
}





/* 
   REPOSITORY EXPLORER PAGE
 */

const MOCK_FILE_TREE = [
  { id: "root", name: "frontend-platform", type: "folder", fileCount: 1248, children: [
    { id: "f1", name: "src", type: "folder", fileCount: 245, children: [
      { id: "f11", name: "api", type: "folder", fileCount: 12, children: [
        { id: "f111", name: "auth.ts", type: "file", lang: "TypeScript", size: "2.4 KB", date: "2 days ago", created: "Oct 12, 2025", status: "Analyzed" },
        { id: "f112", name: "users.ts", type: "file", lang: "TypeScript", size: "4.1 KB", date: "5 hours ago", created: "Oct 15, 2025", status: "Pending" }
      ]},
      { id: "f12", name: "components", type: "folder", fileCount: 84, children: [
        { id: "f121", name: "Button.tsx", type: "file", lang: "React", size: "1.2 KB", date: "1 week ago", created: "Nov 1, 2025", status: "Analyzed" },
        { id: "f122", name: "DataGrid.tsx", type: "file", lang: "React", size: "8.5 KB", date: "3 days ago", created: "Nov 5, 2025", status: "Analyzed" }
      ]},
      { id: "f13", name: "utils.ts", type: "file", lang: "TypeScript", size: "1.8 KB", date: "1 month ago", created: "Oct 12, 2025", status: "Analyzed" },
      { id: "f14", name: "index.tsx", type: "file", lang: "React", size: "500 B", date: "2 weeks ago", created: "Oct 12, 2025", status: "Analyzed" }
    ]},
    { id: "f2", name: "public", type: "folder", fileCount: 8, children: [
      { id: "f21", name: "favicon.ico", type: "file", lang: "Image", size: "15 KB", date: "1 year ago", created: "Jan 1, 2025", status: "Skipped" },
      { id: "f22", name: "index.html", type: "file", lang: "HTML", size: "1.1 KB", date: "2 months ago", created: "Jan 1, 2025", status: "Analyzed" }
    ]},
    { id: "empty", name: "empty-dir", type: "folder", fileCount: 0, children: [] },
    { id: "f3", name: "package.json", type: "file", lang: "JSON", size: "1.5 KB", date: "1 week ago", created: "Oct 12, 2025", status: "Analyzed" },
    { id: "f4", name: "README.md", type: "file", lang: "Markdown", size: "3.2 KB", date: "3 days ago", created: "Oct 12, 2025", status: "Skipped" }
  ]}
];

function RepoBreadcrumb({ path, onNavigate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.faint, marginBottom: 16 }}>
      {path.map((segment, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span onClick={() => onNavigate(segment.id)} style={{ color: i === path.length - 1 ? T.text : T.faint, cursor: "pointer", transition: "color 0.2s" }} className="hover-text">{segment.name}</span>
          {i < path.length - 1 && <span>/</span>}
        </span>
      ))}
    </div>
  );
}

function FolderNode({ node, level, expanded, toggleExpand, onSelect, selectedPath }) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedPath === node.id;
  const isFolder = node.type === "folder";

  return (
    <div>
      <div 
        onClick={() => {
          if (isFolder) toggleExpand(node.id);
          onSelect(node);
        }}
        style={{ 
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", paddingLeft: 12 + level * 16, 
          cursor: "pointer", borderRadius: T.r4, 
          background: isSelected ? T.accentSoft : "transparent",
          color: isSelected ? T.accentBright : T.text,
          transition: "background 0.2s"
        }}
        className="tree-node-hover"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 14, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            {isFolder && <span style={{ fontSize: 10, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}>{isExpanded ? "v" : ">"}</span>}
          </div>
          {isFolder ? <span style={{ color: T.warning, flexShrink: 0 }}>Folder</span> : <span style={{ color: T.info, flexShrink: 0 }}>File</span>}
          <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</span>
        </div>
        {isFolder && <span style={{ fontSize: 11, color: T.faint }}>{node.fileCount}</span>}
      </div>
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FolderNode key={child.id} node={child} level={level + 1} expanded={expanded} toggleExpand={toggleExpand} onSelect={onSelect} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderTree({ data, onSelectFile, onSelectFolder }) {
  const [expanded, setExpanded] = useState(new Set(["root", "f1"]));
  const [selectedPath, setSelectedPath] = useState(null);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelect = (node) => {
    setSelectedPath(node.id);
    if (node.type === "file") onSelectFile(node);
    else onSelectFolder(node);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {data.map(node => (
        <FolderNode key={node.id} node={node} level={0} expanded={expanded} toggleExpand={toggleExpand} onSelect={handleSelect} selectedPath={selectedPath} />
      ))}
    </div>
  );
}

function ExplorerFileRow({ file, onClick, isSelected }) {
  return (
    <div 
      onClick={() => onClick(file)}
      style={{ 
        display: "grid", gridTemplateColumns: "minmax(0, 3fr) 1fr 1fr 1fr 1fr 1fr", gap: 16, 
        padding: "10px 16px", cursor: "pointer", 
        borderBottom: `1px solid ${T.border}`,
        background: isSelected ? T.surfaceHov : "transparent"
      }}
      className="list-row-hover"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {file.type === "folder" ? <span style={{ color: T.warning }}>Folder</span> : <span style={{ color: T.info }}>File</span>}
        <span style={{ fontSize: 13, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
      </div>
      <div style={{ fontSize: 13, color: T.dim, display: "flex", alignItems: "center" }}>{file.type === "file" ? `.${file.name.split('.').pop()}` : "--"}</div>
      <div style={{ display: "flex", alignItems: "center" }}>
        {file.lang && <span style={{ fontSize: 11, color: T.text, background: T.surfaceEl, border: `1px solid ${T.borderMid}`, padding: "2px 8px", borderRadius: T.r4 }}>{file.lang}</span>}
      </div>
      <div style={{ fontSize: 13, color: T.dim, display: "flex", alignItems: "center" }}>{file.size || "--"}</div>
      <div style={{ fontSize: 13, color: T.faint, display: "flex", alignItems: "center" }}>{file.date || "--"}</div>
      <div style={{ fontSize: 13, color: file.status === "Analyzed" ? T.success : T.faint, display: "flex", alignItems: "center" }}>{file.status || "--"}</div>
    </div>
  );
}

function RepositoryBreadcrumb(props) {
  return <RepoBreadcrumb {...props} />;
}

function FileRow(props) {
  return <ExplorerFileRow {...props} />;
}

function RepositorySearch({ value, onChange, inputRef }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></span>
      <input
        ref={inputRef}
        aria-label="Search repository files and folders"
        type="text"
        placeholder="Search repository..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "6px 12px 6px 30px", color: T.text, fontSize: 13, outline: "none" }}
      />
    </div>
  );
}

function RepositoryFilters({ langFilter, setLangFilter, extFilter, setExtFilter, folderFilter, setFolderFilter, modifiedFilter, setModifiedFilter, sizeFilter, setSizeFilter }) {
  const selectStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.text, padding: "6px 12px", borderRadius: T.r6, outline: "none", fontSize: 12 };
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} aria-label="Repository filters">
      <select aria-label="Filter by language" value={langFilter} onChange={(e) => setLangFilter(e.target.value)} style={selectStyle}>
        <option value="All">Language: All</option>
        <option value="TypeScript">TypeScript</option>
        <option value="React">React</option>
        <option value="HTML">HTML</option>
        <option value="JSON">JSON</option>
        <option value="Markdown">Markdown</option>
      </select>
      <select aria-label="Filter by extension" value={extFilter} onChange={(e) => setExtFilter(e.target.value)} style={selectStyle}>
        <option value="All">Extension: All</option>
        <option value=".ts">.ts</option>
        <option value=".tsx">.tsx</option>
        <option value=".html">.html</option>
        <option value=".json">.json</option>
        <option value=".md">.md</option>
      </select>
      <select aria-label="Filter by folder" value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} style={selectStyle}>
        <option value="Current">Folder: Current</option>
        <option value="All">All Subfolders</option>
      </select>
      <select aria-label="Filter by modified date" value={modifiedFilter} onChange={(e) => setModifiedFilter(e.target.value)} style={selectStyle}>
        <option value="Any">Modified: Any Date</option>
        <option value="Week">Last Week</option>
        <option value="Month">Last Month</option>
      </select>
      <select aria-label="Filter by file size" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} style={selectStyle}>
        <option value="Any">Size: Any</option>
        <option value="Small">Small</option>
        <option value="Medium">Medium</option>
        <option value="Large">Large</option>
      </select>
    </div>
  );
}

function StatisticsCards() {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: 16, fontSize: 12, color: T.dim }}>
      <div style={{ fontWeight: 600, color: T.text, marginBottom: 8 }}>Repository Statistics</div>
      {[
        ["Total Files", "1,248"],
        ["Total Folders", "142"],
        ["Repository Size", "24.5 MB"],
        ["Largest Folder", "/packages/ui"],
        ["Largest File", "DataGrid.tsx"],
        ["Languages", "TypeScript, React"],
      ].map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
          <span>{label}</span>
          <span style={{ color: T.text, textAlign: "right" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function FileList({ files, selectedFile, onFileClick, onHeaderClick, sortField, sortAsc }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) 1fr 1fr 1fr 1fr 1fr", gap: 16, padding: "12px 16px", borderBottom: `1px solid ${T.borderMid}`, fontSize: 12, fontWeight: 600, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <button style={fileHeaderButtonStyle} onClick={() => onHeaderClick("name")}>Name {sortField === "name" ? (sortAsc ? "" : "") : ""}</button>
        <button style={fileHeaderButtonStyle} onClick={() => onHeaderClick("name")}>Ext </button>
        <button style={fileHeaderButtonStyle} onClick={() => onHeaderClick("lang")}>Language {sortField === "lang" ? (sortAsc ? "" : "") : ""}</button>
        <button style={fileHeaderButtonStyle} onClick={() => onHeaderClick("size")}>Size {sortField === "size" ? (sortAsc ? "Asc" : "Desc") : "Sort"}</button>
        <button style={fileHeaderButtonStyle} onClick={() => onHeaderClick("date")}>Modified </button>
        <button style={fileHeaderButtonStyle} onClick={() => onHeaderClick("status")}>Status </button>
      </div>
      {files.map(item => (
        <FileRow key={item.id} file={item} isSelected={selectedFile?.id === item.id} onClick={onFileClick} />
      ))}
    </div>
  );
}

const fileHeaderButtonStyle = { background: "none", border: "none", color: T.dim, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", cursor: "pointer", padding: 0 };

function ExplorerEmptyState({ onRefresh, onUpload }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: T.faint, textAlign: "center" }}>
      <Icons.file size={48} strokeWidth={1} />
      <p style={{ marginTop: 16 }}>No files found</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <DashButton variant="secondary" onClick={onRefresh}>Refresh</DashButton>
        <DashButton variant="primary" onClick={onUpload}>Upload Repository</DashButton>
      </div>
    </div>
  );
}

function ExplorerErrorState({ onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 60px)" }}>
      <Icons.error size={48} stroke={T.error} />
      <h2 style={{ color: T.text, marginTop: 16 }}>Unable to load repository</h2>
      <p style={{ color: T.dim, marginTop: 8 }}>The repository explorer service is currently unreachable. Check the repository upload and try again.</p>
      <DashButton variant="primary" style={{ marginTop: 24 }} onClick={onRetry}>Retry</DashButton>
    </div>
  );
}

function ExplorerLoadingSkeleton() {
  return <ExplorerSkeleton />;
}

function ExplorerErrorBoundaryState(props) {
  return <ExplorerErrorState {...props} />;
}

function FilePreview({ file }) {
  if (!file || file.type === "folder") return (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${T.border}`, borderRadius: T.r6, background: T.surfaceEl, color: T.faint, fontSize: 13 }}>
      Select a file to preview
    </div>
  );

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: "hidden" }}>
      <div style={{ background: T.surfaceEl, padding: "8px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 12, color: T.dim, fontFamily: T.mono, display: "flex", justifyContent: "space-between" }}>
        <span>{file.name}</span>
        <span>{file.size}</span>
      </div>
      <div style={{ background: "#0a0a0b", padding: 16, fontSize: 13, fontFamily: T.mono, color: "#a9b1d6", overflowX: "auto" }}>
        <pre style={{ margin: 0 }}>
          <span style={{ color: "#bb9af7" }}>import</span> {"{"} useState {"}"} <span style={{ color: "#bb9af7" }}>from</span> <span style={{ color: "#9ece6a" }}>'react'</span>;<br/><br/>
          <span style={{ color: "#bb9af7" }}>export function</span> <span style={{ color: "#7aa2f7" }}>{file.name.split('.')[0]}</span>() {"{"}<br/>
          {"  "}<span style={{ color: "#bb9af7" }}>return</span> (<br/>
          {"    "}&lt;<span style={{ color: "#f7768e" }}>div</span>&gt;Preview for {file.name}&lt;/<span style={{ color: "#f7768e" }}>div</span>&gt;<br/>
          {"  "});<br/>
          {"}"}
        </pre>
      </div>
    </div>
  );
}

function FileDetailsPanel({ selectedFile, folderPath, setActivePage }) {
  if (!selectedFile) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: T.faint, textAlign: "center" }}>
        <Icons.file size={48} strokeWidth={1} />
        <p style={{ marginTop: 16, fontSize: 14 }}>Select a file to view details and preview.</p>
      </div>
    );
  }

  const fullPath = `${folderPath.map(f => f.name).join(" / ")} / ${selectedFile.name}`;
  const copyPath = () => navigator?.clipboard?.writeText?.(fullPath);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ color: T.info, fontSize: 14, fontFamily: T.mono }}>FILE</span>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: 0, wordBreak: "break-all" }}>{selectedFile.name}</h2>
        </div>
        <div style={{ fontSize: 12, color: T.faint, fontFamily: T.mono }}>{fullPath}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <DashButton variant="primary">Open File</DashButton>
        <DashButton variant="secondary" onClick={copyPath}><Icons.link /> Copy Path</DashButton>
        <DashButton variant="secondary">Download</DashButton>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Repository</span><span style={{ color: T.text }}>frontend-platform</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Language</span><span style={{ color: T.text }}>{selectedFile.lang}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Extension</span><span style={{ color: T.text }}>.{selectedFile.name.split('.').pop()}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Size</span><span style={{ color: T.text }}>{selectedFile.size}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Created Date</span><span style={{ color: T.text }}>{selectedFile.created}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Modified Date</span><span style={{ color: T.text }}>{selectedFile.date}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Future Analysis Status</span><span style={{ color: selectedFile.status === "Analyzed" ? T.success : T.warning }}>{selectedFile.status}</span></div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>File Preview</h4>
        <FilePreview file={selectedFile} />
      </div>
      
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Quick Actions</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={() => setActivePage('repo-analysis')}>View Analysis</DashButton>
          <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={() => setActivePage('deps')}>View Dependencies</DashButton>
          <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={() => setActivePage('arch')}>View Architecture</DashButton>
          <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }}>Download</DashButton>
          <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={copyPath}>Copy Path</DashButton>
        </div>
      </div>
    </div>
  );
}

function ExplorerSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 320px", height: "calc(100vh - 60px)", borderTop: `1px solid ${T.border}` }}>
      <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, padding: 16 }}>
        <div style={{ height: 32, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} className="skeleton-pulse" />
        {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 20, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 12, width: `${100 - i*10}%` }} className="skeleton-pulse" />)}
      </div>
      <div style={{ background: T.bg, padding: 24 }}>
        <div style={{ height: 16, width: 200, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} className="skeleton-pulse" />
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 32, width: 100, background: T.surfaceEl, borderRadius: T.r6 }} className="skeleton-pulse" />)}
        </div>
        {[1,2,3,4,5].map(i => <div key={i} style={{ height: 48, background: T.surface, borderBottom: `1px solid ${T.border}`, marginBottom: 8 }} className="skeleton-pulse" />)}
      </div>
      <div style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, padding: 24 }}>
        <div style={{ height: 24, width: 150, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 32 }} className="skeleton-pulse" />
        <div style={{ height: 120, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} className="skeleton-pulse" />
        <div style={{ height: 200, background: T.surfaceEl, borderRadius: T.r4 }} className="skeleton-pulse" />
      </div>
    </div>
  );
}


function RepoExplorerPage({ setActivePage }) {
  const [status, setStatus] = useState("success");
  const [searchTerm, setSearchTerm] = useState("");
  const [langFilter, setLangFilter] = useState("All");
  const [extFilter, setExtFilter] = useState("All");
  const [folderFilter, setFolderFilter] = useState("Current");
  const [modifiedFilter, setModifiedFilter] = useState("Any");
  const [sizeFilter, setSizeFilter] = useState("Any");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const explorerSearchRef = useRef(null);

  // Flatten tree to find path for breadcrumbs easily (hack for mock)
  const findNode = (nodes, id, path = []) => {
    for (const node of nodes) {
      if (node.id === id) return [...path, node];
      if (node.children) {
        const found = findNode(node.children, id, [...path, node]);
        if (found) return found;
      }
    }
    return null;
  };

  const [currentFolderId, setCurrentFolderId] = useState("root");
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        explorerSearchRef.current?.focus();
      }
      if (e.key === "Escape") explorerSearchRef.current?.blur();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const folderPath = findNode(MOCK_FILE_TREE, currentFolderId) || [MOCK_FILE_TREE[0]];
  const currentFolder = folderPath[folderPath.length - 1];

  // In-memory searching, filtering, and sorting
  let listData = currentFolder.children || [];

  if (searchTerm) {
    listData = listData.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }

  if (langFilter !== "All") {
    listData = listData.filter(item => item.lang === langFilter);
  }

  if (extFilter !== "All") {
    listData = listData.filter(item => item.type === "file" && item.name.endsWith(extFilter));
  }

  listData = [...listData].sort((a, b) => {
    let fieldA = a[sortField] || "";
    let fieldB = b[sortField] || "";
    
    if (typeof fieldA === "string") {
      return sortAsc ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
    }
    return sortAsc ? fieldA - fieldB : fieldB - fieldA;
  });

  const handleHeaderClick = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (status === "loading") return <ExplorerLoadingSkeleton />;
  if (status === "error") return <ExplorerErrorBoundaryState onRetry={() => setStatus("success")} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 320px", height: "calc(100vh - 60px)", borderTop: `1px solid ${T.border}` }}>
      
      {/* LEFT PANEL: Folder Tree & Stats */}
      <div style={{ background: T.surface, borderRight: `1px solid ${T.border}`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
          <RepositorySearch value={searchTerm} onChange={setSearchTerm} inputRef={explorerSearchRef} />
          <div style={{ marginTop: 8, fontSize: 10, color: T.faint, fontFamily: T.mono }}>Ctrl+F to search - Enter to open - Esc to clear focus</div>
        </div>
        <div style={{ padding: "12px 0", flex: 1 }}>
          <FolderTree 
            data={MOCK_FILE_TREE} 
            onSelectFolder={(folder) => { setCurrentFolderId(folder.id); setSelectedFile(null); }}
            onSelectFile={(file) => { setSelectedFile(file); }}
          />
        </div>
        <StatisticsCards />
      </div>

      {/* CENTER PANEL: File List */}
      <div style={{ background: T.bg, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <RepositoryBreadcrumb 
            path={[{name: "Northstar Platform", id: "root"}, {name: "frontend-platform", id: "root"}, ...folderPath]} 
            onNavigate={(id) => setCurrentFolderId(id)}
          />
          
          <RepositoryFilters
            langFilter={langFilter}
            setLangFilter={setLangFilter}
            extFilter={extFilter}
            setExtFilter={setExtFilter}
            folderFilter={folderFilter}
            setFolderFilter={setFolderFilter}
            modifiedFilter={modifiedFilter}
            setModifiedFilter={setModifiedFilter}
            sizeFilter={sizeFilter}
            setSizeFilter={setSizeFilter}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {listData.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: T.faint }}>
              <Icons.file size={48} strokeWidth={1} />
              <p style={{ marginTop: 16 }}>No files found in this directory</p>
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <DashButton variant="secondary" onClick={() => { setSearchTerm(""); setLangFilter("All"); setExtFilter("All"); }}><span style={{fontSize:12}}>Reset</span> Reset Filters</DashButton>
                <DashButton variant="primary">Upload Files</DashButton>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) 1fr 1fr 1fr 1fr 1fr", gap: 16, padding: "12px 16px", borderBottom: `1px solid ${T.borderMid}`, fontSize: 12, fontWeight: 600, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <div style={{cursor:"pointer"}} onClick={() => handleHeaderClick("name")}>Name {sortField === "name" ? (sortAsc ? "" : "") : ""}</div>
                <div style={{cursor:"pointer"}} onClick={() => handleHeaderClick("name")}>Ext </div>
                <div style={{cursor:"pointer"}} onClick={() => handleHeaderClick("lang")}>Language {sortField === "lang" ? (sortAsc ? "" : "") : ""}</div>
                <div style={{cursor:"pointer"}} onClick={() => handleHeaderClick("size")}>Size {sortField === "size" ? (sortAsc ? "" : "") : ""}</div>
                <div style={{cursor:"pointer"}} onClick={() => handleHeaderClick("date")}>Modified </div>
                <div style={{cursor:"pointer"}} onClick={() => handleHeaderClick("status")}>Status </div>
              </div>
              {listData.map(item => (
                <ExplorerFileRow 
                  key={item.id} 
                  file={item} 
                  isSelected={selectedFile?.id === item.id}
                  onClick={(file) => {
                    if (file.type === "folder") {
                      setCurrentFolderId(file.id);
                      setSelectedFile(null);
                    } else {
                      setSelectedFile(file);
                    }
                  }} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Details & Preview */}
      <div style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {selectedFile ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: T.info, fontSize: 12, fontWeight: 700 }}>File</span>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: 0, wordBreak: "break-all" }}>{selectedFile.name}</h2>
              </div>
              <div style={{ fontSize: 12, color: T.faint, fontFamily: T.mono }}>{folderPath.map(f=>f.name).join(' / ')} / {selectedFile.name}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <DashButton variant="primary">Open File</DashButton>
              <DashButton variant="secondary"><Icons.link /> Copy Path</DashButton>
              <DashButton variant="secondary">Download</DashButton>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Repository</span><span style={{ color: T.text }}>frontend-platform</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Language</span><span style={{ color: T.text }}>{selectedFile.lang}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Extension</span><span style={{ color: T.text }}>.{selectedFile.name.split('.').pop()}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Size</span><span style={{ color: T.text }}>{selectedFile.size}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Created Date</span><span style={{ color: T.text }}>{selectedFile.created}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Modified Date</span><span style={{ color: T.text }}>{selectedFile.date}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Analysis Status</span><span style={{ color: selectedFile.status === "Analyzed" ? T.success : T.warning }}>{selectedFile.status}</span></div>
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>File Preview</h4>
              <FilePreview file={selectedFile} />
            </div>
            
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Quick Actions</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={() => setActivePage('repo-analysis')}>Analyze This File</DashButton>
                <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={() => setActivePage('deps')}>View Dependencies</DashButton>
                <DashButton variant="secondary" style={{ justifyContent: "flex-start", fontSize: 13 }} onClick={() => setActivePage('arch')}>View Architecture</DashButton>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: T.faint, textAlign: "center" }}>
            <Icons.file size={48} strokeWidth={1} />
            <p style={{ marginTop: 16, fontSize: 14 }}>Select a file to view details and preview.</p>
          </div>
        )}
      </div>

    </div>
  );
}





/* 
   REPOSITORY ANALYSIS PAGE
 */

function LanguageChart({ languages }) {
  return (
    <WidgetShell title="Language Distribution">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", height: 10, borderRadius: T.r4, overflow: "hidden" }}>
          {languages.map((lang) => (
            <div 
              key={lang.name} 
              style={{ 
                width: `${lang.percent}%`, 
                background: LANG_COLORS[lang.name] || T.faint,
                height: "100%" 
              }} 
            />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {languages.map((lang) => (
            <div key={lang.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: LANG_COLORS[lang.name] || T.faint }} />
              <span style={{ color: T.text, fontWeight: 500 }}>{lang.name}</span>
              <span style={{ color: T.faint }}>{lang.percent}% ({lang.files} files, {lang.loc} LOC)</span>
            </div>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}

function FolderMetrics() {
  return (
    <WidgetShell title="Folder Metrics">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Largest Folder</span><span style={{ color: T.text, fontFamily: T.mono }}>/packages/ui-components (14.2 MB)</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Most Files</span><span style={{ color: T.text, fontFamily: T.mono }}>/src/components (84 files)</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Deepest Folder</span><span style={{ color: T.text, fontFamily: T.mono }}>/src/api/v2/auth/providers/oauth (6 levels)</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Folder Size</span><span style={{ color: T.text }}>24.5 MB</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>File Distribution</span><span style={{ color: T.text }}>80% Code, 15% Configuration, 5% Assets</span></div>
      </div>
    </WidgetShell>
  );
}

function FileMetrics() {
  return (
    <WidgetShell title="File Metrics">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
        {[
          ["Average File Size", "18.5 KB"],
          ["Largest File", "DataGrid.tsx"],
          ["Smallest File", "index.ts"],
          ["Generated Files", "14"],
          ["Test Files", "216"],
          ["Config Files", "38"],
        ].map(([label, value]) => (
          <div key={label} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}>
            <div style={{ color: T.faint, fontSize: 11, marginBottom: 4 }}>{label}</div>
            <div style={{ color: T.text, fontFamily: T.mono, fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

function ModuleTable({ modules }) {
  return (
    <WidgetShell title="Module Analysis">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.borderMid}`, color: T.faint, textAlign: "left" }}>
              <th style={{ padding: "8px 4px" }}>Module Name</th>
              <th style={{ padding: "8px 4px" }}>Files</th>
              <th style={{ padding: "8px 4px" }}>Functions</th>
              <th style={{ padding: "8px 4px" }}>Classes</th>
              <th style={{ padding: "8px 4px" }}>Exports</th>
              <th style={{ padding: "8px 4px" }}>Imports</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "8px 4px", color: T.text, fontFamily: T.mono }}>{m.name}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{m.files}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{m.functions}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{m.classes}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{m.exports}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{m.imports}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

function ImportTable({ imports }) {
  return (
    <WidgetShell title="Import Analysis">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.faint, marginBottom: 8, textTransform: "uppercase" }}>Most Imported Files</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {imports.mostImported.map(item => (
              <div key={item.file} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.text, fontFamily: T.mono }}>{item.file}</span>
                <span style={{ color: T.accentBright }}>{item.count} imports</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
          <span style={{ color: T.faint }}>Total Imports Count</span>
          <span style={{ color: T.text, fontWeight: 600 }}>{imports.totalImportCount}</span>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.faint, marginBottom: 8, textTransform: "uppercase" }}>Internal Modules</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {imports.internal.map(mod => (
              <span key={mod} style={{ background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, padding: "2px 8px", fontSize: 11, color: T.dim, fontFamily: T.mono }}>
                {mod}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.faint, marginBottom: 8, textTransform: "uppercase" }}>External Libraries</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {imports.external.map(lib => (
              <span key={lib} style={{ background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, padding: "2px 8px", fontSize: 11, color: T.text, fontFamily: T.mono }}>
                {lib}
              </span>
            ))}
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

function AnalysisHeader({ repo, onReanalyze, onDownload, status }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", margin: 0 }}>{repo.name}</h1>
          <span style={{ fontSize: 11, background: status === "completed" ? T.success : status === "running" ? T.info : T.warning, color: "#fff", padding: "2px 8px", borderRadius: T.r4 }}>
            {status.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.faint, marginTop: 6 }}>
          <span>Started: {repo.startedAt}</span>
          <span>Completed: {repo.completedAt}</span>
          <span>Duration: {repo.duration}</span>
          <span>Current Version: {repo.version}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <DashButton variant="secondary" onClick={onDownload}>Download Report</DashButton>
        <DashButton variant="primary" onClick={onReanalyze}>Analyze Again</DashButton>
      </div>
    </div>
  );
}

function ScanProgressTimeline({ currentStep, steps, status }) {
  const stepStatusColors = {
    completed: T.success,
    running: T.info,
    failed: T.error,
    paused: T.warning
  };

  return (
    <WidgetShell title="Analysis Scan Progress">
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginTop: 10, paddingBottom: 10 }}>
        <div style={{ position: "absolute", top: 12, left: 20, right: 20, height: 2, background: T.borderMid, zIndex: 0 }} />
        <div 
          style={{ 
            position: "absolute", 
            top: 12, 
            left: 20, 
            width: `${(currentStep / (steps.length - 1)) * 90}%`, 
            height: 2, 
            background: stepStatusColors[status] || T.accent, 
            zIndex: 1,
            transition: "width 0.3s ease"
          }} 
        />
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          const isActive = isDone || isCurrent;
          const color = isCurrent ? (stepStatusColors[status] || T.accent) : isDone ? T.success : T.borderMid;
          
          return (
            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 2, width: 75 }}>
              <div 
                style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: "50%", 
                  background: isActive ? T.surfaceEl : T.surfaceEl, 
                  border: `2px solid ${color}`, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: isActive ? T.text : T.faint 
                }}
              >
                {isDone ? <Icons.check size={14} stroke={T.success} strokeWidth={3}/> : <span style={{ fontSize: 10 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: 10, color: isActive ? T.text : T.faint, textAlign: "center", lineHeight: 1.2 }}>{step}</span>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

function RepoAnalysisPageLegacy({ setActivePage }) {
  const [status, setStatus] = useState("completed"); // "loading" | "running" | "completed" | "failed" | "empty" | "error"
  const [searchTerm, setSearchTerm] = useState("");
  const [analysisFilters, setAnalysisFilters] = useState({ search: "", analysisType: "All", folder: "All", fileType: "All" });
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [sortFuncField, setSortFuncField] = useState("lines");
  const [sortClassField, setSortClassField] = useState("methods");

  const repoMeta = {
    name: "frontend-platform",
    version: "v2.1.4 (commit: 5aac192)",
    duration: "18.4 seconds",
    completedAt: "2 hours ago",
    startedAt: "2 hours ago"
  };

  const scanSteps = [
    "Repository Uploaded",
    "Scanning Files",
    "Reading Directories",
    "Parsing Source Code",
    "Extracting Metadata",
    "Generating Results",
    "Completed"
  ];

  const languages = [
    { name: "TypeScript", percent: 45, files: 842, loc: 92400 },
    { name: "React", percent: 22, files: 254, loc: 31200 },
    { name: "JavaScript", percent: 12, files: 110, loc: 16800 },
    { name: "Python", percent: 8, files: 42, loc: 12400 },
    { name: "Go", percent: 5, files: 18, loc: 8400 },
    { name: "Rust", percent: 3, files: 8, loc: 4200 },
    { name: "Markdown", percent: 2, files: 34, loc: 4200 },
    { name: "JSON", percent: 2, files: 82, loc: 11400 },
    { name: "YAML", percent: 1, files: 12, loc: 2800 }
  ];

  const modules = [
    { name: "auth-context", files: 4, functions: 14, classes: 1, exports: 6, imports: 22 },
    { name: "ui-components", files: 48, functions: 128, classes: 0, exports: 42, imports: 94 },
    { name: "api-client", files: 8, functions: 36, classes: 2, exports: 12, imports: 48 },
    { name: "utils-library", files: 12, functions: 54, classes: 0, exports: 18, imports: 12 }
  ];

  const importsData = {
    totalImportCount: 9642,
    mostImported: [
      { file: "useAuth.ts", count: 84 },
      { file: "Button.tsx", count: 62 },
      { file: "api.ts", count: 48 },
      { file: "theme.ts", count: 36 }
    ],
    internal: ["/src/api/auth", "/src/components/common", "/src/hooks/useFetch"],
    external: ["react", "react-dom", "vite", "typescript", "tailwindcss", "jest"]
  };

  const rawFunctions = [
    { name: "login", file: "auth.ts", visibility: "public", lines: 24, complexity: "Medium", params: 2, returnType: "Promise<User>" },
    { name: "fetchUsers", file: "users.ts", visibility: "public", lines: 18, complexity: "Low", params: 1, returnType: "Promise<User[]>" },
    { name: "formatDate", file: "utils.ts", visibility: "private", lines: 8, complexity: "Low", params: 1, returnType: "string" },
    { name: "renderGrid", file: "DataGrid.tsx", visibility: "public", lines: 112, complexity: "High", params: 3, returnType: "JSX.Element" },
    { name: "useToggle", file: "hooks.ts", visibility: "public", lines: 12, complexity: "Low", params: 1, returnType: "[boolean, () => void]" }
  ];

  const rawClasses = [
    { name: "AuthService", file: "AuthService.ts", methods: 8, properties: 3, inheritance: "BaseService" },
    { name: "ApiClient", file: "api.ts", methods: 12, properties: 4, inheritance: "None" },
    { name: "DataGrid", file: "DataGrid.tsx", methods: 14, properties: 6, inheritance: "Component" }
  ];

  const warnings = [
    { type: "Large File", message: "DataGrid.tsx exceeds 100 lines of code (112 LOC). Consider modularizing.", level: "warning" },
    { type: "Deep Nesting", message: "Folder depth at oauth-provider exceeds 5 levels. Best practice is < 4.", level: "info" },
    { type: "Too Many Imports", message: "useAuth.ts imports 18 external modules. May indicate tight coupling.", level: "info" },
    { type: "Very Large Classes", message: "DataGrid class contains 14 methods and 6 properties. Refactoring recommended.", level: "warning" },
    { type: "Large Functions", message: "renderGrid() is 112 lines long with high cyclomatic complexity.", level: "warning" }
  ];

  // Filtering lists
  const filteredFunctions = rawFunctions.filter(f => {
    const effectiveSearch = analysisFilters.search || searchTerm;
    const matchesSearch = f.name.toLowerCase().includes(effectiveSearch.toLowerCase()) || f.file.toLowerCase().includes(effectiveSearch.toLowerCase());
    const matchesLang = selectedLanguage === "All" || (selectedLanguage === "TypeScript" && f.file.endsWith('.ts')) || (selectedLanguage === "React" && f.file.endsWith('.tsx'));
    const matchesType = analysisFilters.analysisType === "All" || analysisFilters.analysisType === "Functions";
    const matchesFileType = analysisFilters.fileType === "All" || f.file.endsWith(analysisFilters.fileType);
    return matchesSearch && matchesLang && matchesType && matchesFileType;
  }).sort((a, b) => b[sortFuncField] - a[sortFuncField]);

  const filteredClasses = rawClasses.filter(c => {
    const effectiveSearch = analysisFilters.search || searchTerm;
    const matchesSearch = c.name.toLowerCase().includes(effectiveSearch.toLowerCase()) || c.file.toLowerCase().includes(effectiveSearch.toLowerCase());
    const matchesLang = selectedLanguage === "All" || (selectedLanguage === "TypeScript" && c.file.endsWith('.ts')) || (selectedLanguage === "React" && c.file.endsWith('.tsx'));
    const matchesType = analysisFilters.analysisType === "All" || analysisFilters.analysisType === "Classes";
    const matchesFileType = analysisFilters.fileType === "All" || c.file.endsWith(analysisFilters.fileType);
    return matchesSearch && matchesLang && matchesType && matchesFileType;
  }).sort((a, b) => b[sortClassField] - a[sortClassField]);

  if (status === "loading") {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ height: 40, width: 250, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} className="skeleton-pulse" />
        <div style={{ height: 120, background: T.surfaceEl, borderRadius: T.r6, marginBottom: 24 }} className="skeleton-pulse" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 90, background: T.surfaceEl, borderRadius: T.r6 }} className="skeleton-pulse" />)}
        </div>
      </div>
    );
  }

  if (status === "running") {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
        <AnalysisHeader repo={repoMeta} onReanalyze={() => setStatus("running")} onDownload={() => {}} status="running" />
        <ScanProgressTimeline currentStep={3} steps={scanSteps} status="running" />
        <div style={{ marginTop: 24, textAlign: "center", padding: 48, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8 }}>
          <div style={{ fontSize: 16, color: T.text, marginBottom: 8 }}>Parsing Codebase AST...</div>
          <div style={{ fontSize: 13, color: T.faint }}>Extracted 12 modules, analyzing functions and dependency relationships.</div>
          <button onClick={() => setStatus("completed")} style={{ marginTop: 24, background: T.accent, color: "#fff", border: "none", padding: "8px 16px", borderRadius: T.r6, cursor: "pointer" }}>View Completed Results</button>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
        <AnalysisHeader repo={repoMeta} onReanalyze={() => setStatus("running")} onDownload={() => {}} status="failed" />
        <div style={{ textAlign: "center", padding: 48, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8 }}>
          <Icons.error size={48} stroke={T.error} />
          <h3 style={{ color: T.text, marginTop: 16 }}>Analysis Engine Failure</h3>
          <p style={{ color: T.dim, marginTop: 8 }}>Vite configuration syntax error detected in config file. Run validation checks locally.</p>
          <DashButton variant="primary" style={{ marginTop: 16, margin: "0 auto" }} onClick={() => setStatus("running")}>Retry Scan</DashButton>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <Icons.error size={48} stroke={T.error} />
        <h2 style={{ color: T.text, marginTop: 16 }}>Internal System Error</h2>
        <p style={{ color: T.dim, marginTop: 8 }}>Failed to connect to static analyzer microservice. Try again later.</p>
        <DashButton variant="primary" style={{ marginTop: 24, margin: "0 auto" }} onClick={() => setStatus("completed")}>Reload Analysis</DashButton>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <Icons.file size={48} />
        <h2 style={{ color: T.text, marginTop: 16 }}>No Analysis Data Found</h2>
        <p style={{ color: T.dim, marginTop: 8 }}>This repository has not been scanned yet. Please kick off a scan to view metrics.</p>
        <DashButton variant="primary" style={{ marginTop: 24, margin: "0 auto" }} onClick={() => setStatus("running")}>Run First Scan</DashButton>
      </div>
    );
  }

  return (
    <div className="page-in" style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>

      <AnalysisHeader repo={repoMeta} onReanalyze={() => setStatus("running")} onDownload={() => {}} status="completed" />
      <ProgressTimeline currentStep={6} steps={scanSteps} status="completed" />

      {/* Summary Cards Grid */}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 16, marginTop: 0 }}>Codebase Aggregates</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Total Files" value="1,248" sub="TS & TSX" />
        <SummaryCard label="Total Folders" value="142" />
        <SummaryCard label="Total LOC" value="142,400" sub="Lines of code" />
        <SummaryCard label="Languages Detected" value="9" sub="TS, React, Go, Py..." />
        <SummaryCard label="Modules" value="12" />
        <SummaryCard label="Packages" value="3" sub="Monorepo Packages" />
        <SummaryCard label="Functions" value="4,217" />
        <SummaryCard label="Classes" value="156" />
        <SummaryCard label="Imports" value="9,642" />
        <SummaryCard label="Average File Size" value="18.5 KB" />
        <SummaryCard label="Largest File" value="DataGrid.tsx" sub="112 lines" />
        <SummaryCard label="Largest Folder" value="/packages/ui" sub="14.2 MB" />
      </div>

      <AnalysisFilters filters={analysisFilters} setFilters={setAnalysisFilters} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} />

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <LanguageChart languages={languages} />
          <FolderMetricsWidget />
          <FileMetrics />
          <ModuleTableWidget modules={modules} />

          <WidgetShell title="Analysis Warnings">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {warnings.map((w, idx) => (
                <WarningCard key={idx} warning={w} />
              ))}
            </div>
          </WidgetShell>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <FunctionTable functions={filteredFunctions} sortFuncField={sortFuncField} setSortFuncField={setSortFuncField} />
          <ClassTable classes={filteredClasses} sortClassField={sortClassField} setSortClassField={setSortClassField} />

          <ImportTableWidget imports={importsData} />

          <WidgetShell title="AI Recommendations">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <RecommendationCard title="Explore Architecture" desc="Inspect system diagrams." onClick={() => setActivePage('arch')} />
              <RecommendationCard title="View Dependencies" desc="Track circular imports." onClick={() => setActivePage('deps')} />
              <RecommendationCard title="Open Largest Module" desc="Inspect /packages/ui." onClick={() => setActivePage('repo-overview')} />
              <RecommendationCard title="Analyze Complex Files" desc="Open DataGrid.tsx." onClick={() => setActivePage('repo-explorer')} />
            </div>
          </WidgetShell>
        </div>
      </div>
    </div>
  );
}



const formatCount = value => Number(value || 0).toLocaleString();
const formatBytes = value => {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};
const formatDateTime = value => value ? new Date(value).toLocaleString() : "Not available";
const analysisStepForStatus = status => {
  if (status === "pending") return 0;
  if (status === "running") return 4;
  if (status === "completed" || status === "completed_with_warnings") return 6;
  if (status === "failed" || status === "cancelled") return 2;
  return 0;
};
const isAnalysisComplete = status => status === "completed" || status === "completed_with_warnings";

function RepoAnalysisPage({ setActivePage }) {
  const queryClient = useQueryClient();
  const repositoryId = useCodeScopeUiStore(state => state.selectedRepositoryId);
  const repositoryName = useCodeScopeUiStore(state => state.selectedRepositoryName);
  const [analysisFilters, setAnalysisFilters] = useState({ search: "", analysisType: "Functions", folder: "All", fileType: "All" });
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [sortFuncField, setSortFuncField] = useState("lines");
  const [sortClassField, setSortClassField] = useState("methods");

  const startAnalysis = useMutation({
    mutationFn: () => analysisApi.start(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", repositoryId] });
      setAnalysisFilters(prev => ({ ...prev, analysisType: "Functions" }));
    },
  });

  const statusQuery = useQuery({
    queryKey: ["analysis", repositoryId, "status"],
    queryFn: () => analysisApi.status(repositoryId),
    enabled: Boolean(repositoryId) && !startAnalysis.isPending,
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 1000 : false;
    },
    retry: 1,
  });

  const runStatus = startAnalysis.isPending ? "running" : statusQuery.data?.status;
  const reportQuery = useQuery({
    queryKey: ["analysis", repositoryId, "report"],
    queryFn: () => analysisApi.report(repositoryId),
    enabled: Boolean(repositoryId) && isAnalysisComplete(runStatus),
  });
  const metricsQuery = useQuery({
    queryKey: ["analysis", repositoryId, "metrics"],
    queryFn: () => analysisApi.metrics(repositoryId),
    enabled: Boolean(repositoryId) && isAnalysisComplete(runStatus),
  });

  const search = analysisFilters.search || undefined;
  const loadFunctions = isAnalysisComplete(runStatus) && analysisFilters.analysisType === "Functions";
  const loadClasses = isAnalysisComplete(runStatus) && analysisFilters.analysisType === "Classes";
  const loadModules = isAnalysisComplete(runStatus) && analysisFilters.analysisType === "Modules";
  const loadImports = isAnalysisComplete(runStatus) && analysisFilters.analysisType === "Imports";

  const functionsQuery = useQuery({
    queryKey: ["analysis", repositoryId, "functions", search],
    queryFn: () => analysisApi.functions(repositoryId, { search, limit: 100 }),
    enabled: loadFunctions,
  });
  const classesQuery = useQuery({
    queryKey: ["analysis", repositoryId, "classes", search],
    queryFn: () => analysisApi.classes(repositoryId, { search, limit: 100 }),
    enabled: loadClasses,
  });
  const modulesQuery = useQuery({
    queryKey: ["analysis", repositoryId, "modules", search],
    queryFn: () => analysisApi.modules(repositoryId, { search, limit: 100 }),
    enabled: loadModules,
  });
  const importsQuery = useQuery({
    queryKey: ["analysis", repositoryId, "imports", search],
    queryFn: () => analysisApi.imports(repositoryId, { search, limit: 100 }),
    enabled: loadImports,
  });

  const primaryError = startAnalysis.error || statusQuery.error || reportQuery.error || metricsQuery.error;
  const metrics = metricsQuery.data || reportQuery.data?.metrics;
  const run = statusQuery.data || reportQuery.data?.run || startAnalysis.data;
  const languages = (reportQuery.data?.languages || []).map(lang => ({
    name: lang.language,
    percent: Math.round(lang.percentage || 0),
    files: lang.file_count,
    loc: lang.lines_of_code,
  }));
  const repoMeta = {
    name: repositoryName || repositoryId || "Repository",
    version: `run ${run?.id?.slice?.(0, 8) || "pending"}`,
    duration: run?.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)} seconds` : "In progress",
    completedAt: formatDateTime(run?.completed_at),
    startedAt: formatDateTime(run?.started_at),
  };

  const mappedFunctions = (functionsQuery.data?.items || []).map(item => ({
    name: item.name,
    file: item.file_path,
    visibility: item.visibility,
    lines: Math.max(1, (item.end_line || item.start_line || 0) - (item.start_line || 0) + 1),
    complexity: item.is_async ? "Medium" : "Low",
    params: item.parameters?.length || 0,
    returnType: item.return_type || "Unknown",
  })).sort((a, b) => (b[sortFuncField] || 0) - (a[sortFuncField] || 0));
  const mappedClasses = (classesQuery.data?.items || []).map(item => ({
    name: item.name,
    file: item.file_path,
    methods: 0,
    properties: 0,
    inheritance: item.bases?.join(", ") || "None",
  })).sort((a, b) => (b[sortClassField] || 0) - (a[sortClassField] || 0));
  const mappedModules = (modulesQuery.data?.items || []).map(item => ({
    name: item.name,
    files: 1,
    functions: 0,
    classes: 0,
    exports: item.is_package ? 1 : 0,
    imports: 0,
  }));
  const importRows = importsQuery.data?.items || [];
  const importSummary = {
    totalImportCount: importsQuery.data?.total || metrics?.imports || 0,
    mostImported: importRows.slice(0, 8).map(item => ({ file: item.imported_name ? `${item.module}.${item.imported_name}` : item.module, count: 1 })),
    internal: importRows.filter(item => item.level > 0).map(item => item.module).slice(0, 12),
    external: importRows.filter(item => item.level === 0).map(item => item.module).slice(0, 12),
  };
  const warnings = run?.warnings || [];
  const running = startAnalysis.isPending || runStatus === "pending" || runStatus === "running";

  if (!repositoryId) {
    return <AnalysisEmptyState title="No repository selected" detail="Choose a repository before opening analysis." action="Open Repositories" onAction={() => setActivePage("repos")} />;
  }

  if (statusQuery.isLoading && !startAnalysis.isPending) {
    return <AnalysisLoadingSkeleton />;
  }

  if (primaryError && !isAnalysisComplete(runStatus)) {
    return (
      <AnalysisErrorState
        title="Unable to load repository analysis"
        detail={friendlyApiError(primaryError)}
        onRetry={() => {
          statusQuery.refetch();
          reportQuery.refetch();
          metricsQuery.refetch();
        }}
        onRun={() => startAnalysis.mutate()}
        running={startAnalysis.isPending}
      />
    );
  }

  if (!running && !isAnalysisComplete(runStatus)) {
    return <AnalysisEmptyState title="No analysis data available" detail="Run analysis to scan the uploaded repository and populate metrics." action="Run Analysis" onAction={() => startAnalysis.mutate()} running={startAnalysis.isPending} />;
  }

  if (running) {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
        <AnalysisHeader repo={repoMeta} onReanalyze={() => startAnalysis.mutate()} onDownload={() => {}} status="running" />
        <ScanProgressTimeline currentStep={analysisStepForStatus(runStatus)} steps={ANALYSIS_STEPS} status="running" />
        <div style={{ marginTop: 24, textAlign: "center", padding: 48, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8 }}>
          <div style={{ fontSize: 16, color: T.text, marginBottom: 8 }}>Repository analysis is running</div>
          <div style={{ fontSize: 13, color: T.faint }}>Scanning files, parsing Python AST metadata, and calculating repository metrics.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-in" style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      <AnalysisHeader repo={repoMeta} onReanalyze={() => startAnalysis.mutate()} onDownload={() => {}} status={runStatus === "completed_with_warnings" ? "paused" : "completed"} />
      <ProgressTimeline currentStep={analysisStepForStatus(runStatus)} steps={ANALYSIS_STEPS} status="completed" />

      <h3 style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 16, marginTop: 0 }}>Codebase Aggregates</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Total Files" value={formatCount(metrics?.total_files)} />
        <SummaryCard label="Total Folders" value={formatCount(metrics?.total_folders)} />
        <SummaryCard label="Total LOC" value={formatCount(metrics?.lines_of_code)} sub="Lines of code" />
        <SummaryCard label="Languages Detected" value={formatCount(metrics?.languages)} />
        <SummaryCard label="Modules" value={formatCount(metrics?.modules)} />
        <SummaryCard label="Packages" value={formatCount(metrics?.packages)} />
        <SummaryCard label="Functions" value={formatCount(metrics?.functions)} />
        <SummaryCard label="Classes" value={formatCount(metrics?.classes)} />
        <SummaryCard label="Imports" value={formatCount(metrics?.imports)} />
        <SummaryCard label="Largest File" value={metrics?.largest_file_path || "None"} sub={formatBytes(metrics?.largest_file_size)} />
        <SummaryCard label="Largest Folder" value={metrics?.largest_folder_path || "Root"} sub={formatBytes(metrics?.largest_folder_size)} />
        <SummaryCard label="Warnings" value={formatCount(run?.warnings?.length || run?.errors_count)} />
      </div>

      <AnalysisFilters filters={analysisFilters} setFilters={setAnalysisFilters} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} />

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <LanguageChart languages={languages} />
          <LiveFolderMetrics metrics={metrics} />
          <LiveFileMetrics metrics={metrics} />
          {analysisFilters.analysisType === "Modules" && <ModuleTableWidget modules={mappedModules} />}
          <WidgetShell title="Analysis Warnings">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {warnings.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>No warnings reported by the backend analysis run.</div>}
              {warnings.map((warning, idx) => <WarningCard key={idx} warning={{ type: warning.type || "Analysis Warning", message: warning.message || JSON.stringify(warning), level: warning.level || "warning" }} />)}
            </div>
          </WidgetShell>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <AnalysisEntityTabs active={analysisFilters.analysisType} onChange={value => setAnalysisFilters(prev => ({ ...prev, analysisType: value }))} />
          {analysisFilters.analysisType === "Functions" && (functionsQuery.isLoading ? <AnalysisPanelSkeleton title="Function Analysis" /> : <FunctionTable functions={mappedFunctions} sortFuncField={sortFuncField} setSortFuncField={setSortFuncField} />)}
          {analysisFilters.analysisType === "Classes" && (classesQuery.isLoading ? <AnalysisPanelSkeleton title="Class Analysis" /> : <ClassTable classes={mappedClasses} sortClassField={sortClassField} setSortClassField={setSortClassField} />)}
          {analysisFilters.analysisType === "Modules" && (modulesQuery.isLoading ? <AnalysisPanelSkeleton title="Module Analysis" /> : <ModuleTableWidget modules={mappedModules} />)}
          {analysisFilters.analysisType === "Imports" && (importsQuery.isLoading ? <AnalysisPanelSkeleton title="Import Analysis" /> : <ImportTableWidget imports={importSummary} />)}
          <WidgetShell title="AI Recommendations">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <RecommendationCard title="Explore Architecture" desc="Inspect system diagrams." onClick={() => setActivePage('arch')} />
              <RecommendationCard title="View Dependencies" desc="Trace imports and downstream dependencies." onClick={() => setActivePage('deps')} />
              <RecommendationCard title="Open Repository" desc="Return to repository overview." onClick={() => setActivePage('repo-overview')} />
              <RecommendationCard title="Browse Files" desc="Inspect analyzed source files." onClick={() => setActivePage('repo-explorer')} />
            </div>
          </WidgetShell>
        </div>
      </div>
    </div>
  );
}

function AnalysisEntityTabs({ active, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {["Functions", "Classes", "Modules", "Imports"].map(label => (
        <button key={label} onClick={() => onChange(label)} style={{ padding: "8px 10px", background: active === label ? T.accentSoft : T.surfaceEl, border: `1px solid ${active === label ? T.accentBorder : T.border}`, borderRadius: T.r6, color: active === label ? T.accentBright : T.dim, cursor: "pointer", fontSize: 12 }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function LiveFolderMetrics({ metrics }) {
  return (
    <WidgetShell title="Folder Metrics">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Largest Folder</span><span style={{ color: T.text, fontFamily: T.mono }}>{metrics?.largest_folder_path || "Root"}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Largest Folder Size</span><span style={{ color: T.text }}>{formatBytes(metrics?.largest_folder_size)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.faint }}>Total Folders</span><span style={{ color: T.text }}>{formatCount(metrics?.total_folders)}</span></div>
      </div>
    </WidgetShell>
  );
}

function LiveFileMetrics({ metrics }) {
  return (
    <WidgetShell title="File Metrics">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
        {[
          ["Largest File", metrics?.largest_file_path || "None"],
          ["Largest File Size", formatBytes(metrics?.largest_file_size)],
          ["Total Files", formatCount(metrics?.total_files)],
          ["Lines of Code", formatCount(metrics?.lines_of_code)],
          ["Parsed Modules", formatCount(metrics?.modules)],
          ["Imports", formatCount(metrics?.imports)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}>
            <div style={{ color: T.faint, fontSize: 11, marginBottom: 4 }}>{label}</div>
            <div style={{ color: T.text, fontFamily: T.mono, fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

function AnalysisLoadingSkeleton() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ height: 40, width: 260, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} className="skeleton-pulse" />
      <div style={{ height: 120, background: T.surfaceEl, borderRadius: T.r6, marginBottom: 24 }} className="skeleton-pulse" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[1,2,3,4,5,6,7,8].map(i => <div key={i} style={{ height: 90, background: T.surfaceEl, borderRadius: T.r6 }} className="skeleton-pulse" />)}
      </div>
    </div>
  );
}

function AnalysisPanelSkeleton({ title }) {
  return (
    <WidgetShell title={title}>
      <div style={{ display: "grid", gap: 8 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton-pulse" style={{ height: 34, background: T.surfaceEl, borderRadius: T.r4 }} />)}
      </div>
    </WidgetShell>
  );
}

function AnalysisErrorState({ title, detail, onRetry, onRun, running }) {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
      <Icons.error size={48} stroke={T.error} />
      <h2 style={{ color: T.text, marginTop: 16 }}>{title}</h2>
      <p style={{ color: T.dim, marginTop: 8, lineHeight: 1.5 }}>{detail}</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
        <DashButton variant="secondary" onClick={onRetry}>Retry</DashButton>
        <DashButton variant="primary" onClick={onRun}>{running ? "Running..." : "Run Analysis"}</DashButton>
      </div>
    </div>
  );
}

function AnalysisEmptyState({ title, detail, action, onAction, running }) {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
      <Icons.file size={48} />
      <h2 style={{ color: T.text, marginTop: 16 }}>{title}</h2>
      <p style={{ color: T.dim, marginTop: 8, lineHeight: 1.5 }}>{detail}</p>
      <DashButton variant="primary" style={{ marginTop: 24, margin: "24px auto 0" }} onClick={onAction}>{running ? "Running..." : action}</DashButton>
    </div>
  );
}

/* 
   PROMPT 9: KNOWLEDGE GRAPH EXPLORER (FULL COMPLIANCE)
 */

const graphMockData = {
  nodes: [
    { id: "root", type: "custom", position: { x: 400, y: 50 }, data: { label: "frontend-platform", type: "Repository", lang: "Mixed", visibility: "Public", path: "/" } },
    { id: "src", type: "custom", position: { x: 400, y: 150 }, data: { label: "src", type: "Folder", lang: "Mixed", visibility: "Public", path: "/src", parent: "root" } },
    { id: "components", type: "custom", position: { x: 200, y: 250 }, data: { label: "components", type: "Folder", lang: "Mixed", visibility: "Public", path: "/src/components", parent: "src" } },
    { id: "utils", type: "custom", position: { x: 600, y: 250 }, data: { label: "utils", type: "Folder", lang: "Mixed", visibility: "Public", path: "/src/utils", parent: "src" } },
    { id: "Button", type: "custom", position: { x: 100, y: 350 }, data: { label: "Button.tsx", type: "File", lang: "React", visibility: "Public", path: "/src/components/Button.tsx", parent: "components" } },
    { id: "DataGrid", type: "custom", position: { x: 300, y: 350 }, data: { label: "DataGrid.tsx", type: "File", lang: "React", visibility: "Public", path: "/src/components/DataGrid.tsx", parent: "components" } },
    { id: "formatters", type: "custom", position: { x: 600, y: 350 }, data: { label: "formatters.ts", type: "File", lang: "TypeScript", visibility: "Public", path: "/src/utils/formatters.ts", parent: "utils" } },
    { id: "authModule", type: "custom", position: { x: 800, y: 250 }, data: { label: "auth-module", type: "Module", lang: "TypeScript", visibility: "Public", path: "/src/auth", parent: "src" } },
    { id: "useAuth", type: "custom", position: { x: 800, y: 350 }, data: { label: "useAuth", type: "Function", lang: "TypeScript", visibility: "Public", path: "/src/auth/useAuth.ts", parent: "authModule" } },
    { id: "AuthService", type: "custom", position: { x: 800, y: 450 }, data: { label: "AuthService", type: "Class", lang: "TypeScript", visibility: "Public", path: "/src/auth/AuthService.ts", parent: "authModule" } },
    { id: "IUser", type: "custom", position: { x: 950, y: 450 }, data: { label: "IUser", type: "Interface", lang: "TypeScript", visibility: "Public", path: "/src/auth/IUser.ts", parent: "authModule" } },
    { id: "formatDate", type: "custom", position: { x: 600, y: 450 }, data: { label: "formatDate", type: "Function", lang: "TypeScript", visibility: "Private", path: "/src/utils/formatters.ts", parent: "formatters" } },
    { id: "GridClass", type: "custom", position: { x: 300, y: 450 }, data: { label: "DataGrid", type: "Class", lang: "React", visibility: "Public", path: "/src/components/DataGrid.tsx", parent: "DataGrid" } },
    { id: "UsersTable", type: "custom", position: { x: 100, y: 550 }, data: { label: "UsersTable", type: "Database Table", lang: "SQL", visibility: "Private", path: "db:users", parent: "none" } },
    { id: "AuthAPI", type: "custom", position: { x: 800, y: 550 }, data: { label: "/api/v1/auth", type: "API Endpoint", lang: "HTTP", visibility: "Public", path: "api:auth", parent: "none" } },
    { id: "PaymentPkg", type: "custom", position: { x: 1000, y: 150 }, data: { label: "@org/payments", type: "Package", lang: "TypeScript", visibility: "Public", path: "node_modules/@org/payments", parent: "none" } },
    { id: "BillingSvc", type: "custom", position: { x: 1000, y: 250 }, data: { label: "BillingService", type: "Service", lang: "Go", visibility: "Public", path: "cluster:billing", parent: "none" } },
  ],
  edges: [
    { id: "e1", source: "root", target: "src", label: "contains" },
    { id: "e2", source: "src", target: "components", label: "contains" },
    { id: "e3", source: "src", target: "utils", label: "contains" },
    { id: "e4", source: "src", target: "authModule", label: "contains" },
    { id: "e5", source: "components", target: "Button", label: "contains" },
    { id: "e6", source: "components", target: "DataGrid", label: "contains" },
    { id: "e7", source: "utils", target: "formatters", label: "contains" },
    { id: "e8", source: "authModule", target: "useAuth", label: "defines" },
    { id: "e9", source: "useAuth", target: "AuthService", label: "uses" },
    { id: "e10", source: "formatters", target: "formatDate", label: "defines" },
    { id: "e11", source: "DataGrid", target: "GridClass", label: "defines" },
    { id: "e12", source: "GridClass", target: "formatDate", label: "imports" },
    { id: "e13", source: "AuthService", target: "UsersTable", label: "depends on" },
    { id: "e14", source: "AuthService", target: "AuthAPI", label: "calls" },
    { id: "e15", source: "AuthService", target: "IUser", label: "implements" },
    { id: "e16", source: "BillingSvc", target: "PaymentPkg", label: "exports" },
    { id: "e17", source: "useAuth", target: "PaymentPkg", label: "references" },
    { id: "e18", source: "AuthAPI", target: "BillingSvc", label: "extends" },
  ]
};

// Edge styling helper
const getEdgeStyle = (label, selectedNodeId, source, target) => {
  let color = T.dim;
  let strokeDasharray = "0";
  let animated = false;

  if (label === "contains") { color = T.faint; strokeDasharray = "0"; }
  if (label === "defines") { color = T.accentBright; strokeDasharray = "1 5"; }
  if (label === "imports") { color = T.warning; strokeDasharray = "5 5"; }
  if (label === "calls") { color = T.info; animated = true; }
  if (label === "depends on") { color = T.error; strokeDasharray = "2 4"; }
  if (label === "implements") { color = T.success; strokeDasharray = "4 2"; }
  if (label === "uses") { color = T.accentBright; animated = true; }
  if (label === "exports") { color = "#a371f7"; }
  if (label === "references") { color = "#f771a3"; strokeDasharray = "2 2"; }
  if (label === "extends") { color = "#71f7a3"; strokeDasharray = "6 2"; }

  // Edge highlighting logic
  let opacity = 1;
  if (selectedNodeId) {
    if (source !== selectedNodeId && target !== selectedNodeId) {
      opacity = 0.15; // Dim edges not connected to selected node
    } else {
      color = T.text; // Highlight connected edges brightly
    }
  }

  return {
    style: { stroke: color, strokeDasharray, opacity, strokeWidth: source === selectedNodeId || target === selectedNodeId ? 2 : 1.25 },
    animated,
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
};

const CustomGraphNode = ({ data, selected }) => {
  let bgColor = T.surfaceEl;
  let borderColor = T.border;
  let icon = Icons.file;
  
  if (data.type === "Repository") { borderColor = T.accent; icon = Icons.repos; }
  if (data.type === "Folder") { icon = Icons.archive; }
  if (data.type === "Module") { borderColor = T.info; icon = Icons.gridView; }
  if (data.type === "Class") { bgColor = "#1e1e24"; borderColor = T.warning; }
  if (data.type === "Function") { bgColor = "#1a221d"; borderColor = T.success; }
  if (data.type === "Database Table") { bgColor = "#2d1b1b"; borderColor = T.error; }
  if (data.type === "API Endpoint") { bgColor = "#1b2533"; borderColor = T.info; }
  if (data.type === "Package") { bgColor = "#261a29"; borderColor = "#a371f7"; icon = Icons.archive; }
  if (data.type === "Interface") { bgColor = "#1a2624"; borderColor = "#71f7a3"; icon = Icons.file; }
  if (data.type === "Service") { bgColor = "#2a1a1a"; borderColor = "#f771a3"; icon = Icons.arch; }

  return (
    <div 
      aria-label={`${data.type} node: ${data.label}`}
      style={{
      padding: "8px 12px",
      background: bgColor,
      border: `1px solid ${selected ? T.text : borderColor}`,
      borderRadius: T.r6,
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 120,
      boxShadow: selected ? `0 0 0 2px ${T.accentSoft}` : T.shadow,
      transition: "all 0.2s ease",
      opacity: data.hidden ? 0.2 : 1
    }}>
      <Handle type="target" position={Position.Top} style={{ background: T.faint, border: "none", width: 8, height: 8 }} />
      <div style={{ color: selected ? T.text : T.faint }}>
        <icon.type {...icon.props} size={14} />
      </div>
      <div>
        {!data.hideLabel && <div style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: T.mono }}>{data.label}</div>}
        <div style={{ fontSize: 10, color: T.faint }}>{data.type}</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: T.faint, border: "none", width: 8, height: 8 }} />
    </div>
  );
};

function GraphNode(props) {
  return <CustomGraphNode {...props} />;
}

function GraphEdge(label, selectedNodeId, source, target) {
  return getEdgeStyle(label, selectedNodeId, source, target);
}

const nodeTypes = { custom: GraphNode };

function KnowledgeGraphPage({ setActivePage }) {
  const [status, setStatus] = useState("success");
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner status={status} setStatus={setStatus} />
    </ReactFlowProvider>
  );
}

function ProgressTimeline(props) {
  return <ScanProgressTimeline {...props} />;
}

function SummaryCard(props) {
  return <StatCard {...props} />;
}

function AnalysisSearch({ value, onChange }) {
  return (
    <div style={{ flex: 1, position: "relative", minWidth: 220 }}>
      <span style={{ position: "absolute", left: 12, top: 10, color: T.faint }}><Icons.search size={16} /></span>
      <input
        aria-label="Search repository analysis"
        type="text"
        placeholder="Search functions, classes, modules, files..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "8px 12px 8px 36px", color: T.text, outline: "none" }}
      />
    </div>
  );
}

function AnalysisFilters({ filters, setFilters, selectedLanguage, setSelectedLanguage }) {
  const selectStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.text, padding: "0 12px", borderRadius: T.r6, outline: "none", minHeight: 38 };
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }} aria-label="Analysis filters">
      <AnalysisSearch value={filters.search} onChange={search => setFilters({ ...filters, search })} />
      <select aria-label="Filter by analysis type" value={filters.analysisType} onChange={e => setFilters({ ...filters, analysisType: e.target.value })} style={selectStyle}>
        <option value="All">Analysis Type: All</option>
        <option value="Functions">Functions</option>
        <option value="Classes">Classes</option>
        <option value="Modules">Modules</option>
        <option value="Files">Files</option>
      </select>
      <select aria-label="Filter by language" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} style={selectStyle}>
        <option value="All">Language: All</option>
        <option value="TypeScript">TypeScript</option>
        <option value="React">React</option>
        <option value="JavaScript">JavaScript</option>
        <option value="Python">Python</option>
        <option value="Go">Go</option>
      </select>
      <select aria-label="Filter by folder" value={filters.folder} onChange={e => setFilters({ ...filters, folder: e.target.value })} style={selectStyle}>
        <option value="All">Folder: All</option>
        <option value="/src/auth">/src/auth</option>
        <option value="/src/components">/src/components</option>
        <option value="/src/utils">/src/utils</option>
        <option value="/packages/ui">/packages/ui</option>
      </select>
      <select aria-label="Filter by file type" value={filters.fileType} onChange={e => setFilters({ ...filters, fileType: e.target.value })} style={selectStyle}>
        <option value="All">File Type: All</option>
        <option value=".ts">.ts</option>
        <option value=".tsx">.tsx</option>
        <option value=".js">.js</option>
        <option value=".json">.json</option>
      </select>
    </div>
  );
}

function FunctionTable({ functions, sortFuncField, setSortFuncField }) {
  return (
    <WidgetShell title="Function Analysis">
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: T.faint, alignSelf: "center" }}>Sort by:</span>
        <button onClick={() => setSortFuncField("lines")} style={{ padding: "4px 8px", background: sortFuncField === "lines" ? T.accentSoft : T.surfaceEl, border: `1px solid ${sortFuncField === "lines" ? T.accentBorder : T.border}`, borderRadius: T.r4, color: T.text, fontSize: 11, cursor: "pointer" }}>Lines</button>
        <button onClick={() => setSortFuncField("params")} style={{ padding: "4px 8px", background: sortFuncField === "params" ? T.accentSoft : T.surfaceEl, border: `1px solid ${sortFuncField === "params" ? T.accentBorder : T.border}`, borderRadius: T.r4, color: T.text, fontSize: 11, cursor: "pointer" }}>Params</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.borderMid}`, color: T.faint, textAlign: "left" }}>
              {["Function", "File", "Visibility", "Lines", "Params", "Return Type", "Complexity"].map(h => <th key={h} style={{ padding: "8px 4px" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {functions.map(f => (
              <tr key={f.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "8px 4px", color: T.text, fontWeight: 500 }}>{f.name}()</td>
                <td style={{ padding: "8px 4px", color: T.dim, fontFamily: T.mono }}>{f.file}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{f.visibility}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{f.lines}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{f.params}</td>
                <td style={{ padding: "8px 4px", color: T.dim, fontFamily: T.mono }}>{f.returnType}</td>
                <td style={{ padding: "8px 4px", color: f.complexity === "High" ? T.error : f.complexity === "Medium" ? T.warning : T.success }}>{f.complexity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

function ClassTable({ classes, sortClassField, setSortClassField }) {
  return (
    <WidgetShell title="Class Analysis">
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: T.faint, alignSelf: "center" }}>Sort by:</span>
        <button onClick={() => setSortClassField("methods")} style={{ padding: "4px 8px", background: sortClassField === "methods" ? T.accentSoft : T.surfaceEl, border: `1px solid ${sortClassField === "methods" ? T.accentBorder : T.border}`, borderRadius: T.r4, color: T.text, fontSize: 11, cursor: "pointer" }}>Methods</button>
        <button onClick={() => setSortClassField("properties")} style={{ padding: "4px 8px", background: sortClassField === "properties" ? T.accentSoft : T.surfaceEl, border: `1px solid ${sortClassField === "properties" ? T.accentBorder : T.border}`, borderRadius: T.r4, color: T.text, fontSize: 11, cursor: "pointer" }}>Properties</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.borderMid}`, color: T.faint, textAlign: "left" }}>
              {["Class", "File", "Methods", "Props", "Inheritance"].map(h => <th key={h} style={{ padding: "8px 4px" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {classes.map(c => (
              <tr key={c.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "8px 4px", color: T.text, fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: "8px 4px", color: T.dim, fontFamily: T.mono }}>{c.file}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{c.methods}</td>
                <td style={{ padding: "8px 4px", color: T.dim }}>{c.properties}</td>
                <td style={{ padding: "8px 4px", color: T.dim, fontFamily: T.mono }}>{c.inheritance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

function WarningCard({ warning }) {
  return (
    <div style={{ background: T.surfaceEl, borderLeft: `4px solid ${warning.level === "warning" ? T.warning : T.info}`, padding: 12, borderRadius: T.r6, display: "flex", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 650, color: T.text }}>{warning.type}</div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>{warning.message}</div>
      </div>
      <span style={{ fontSize: 11, color: T.faint }}>Info</span>
    </div>
  );
}

function RecommendationCard({ title, desc, onClick }) {
  return (
    <button onClick={onClick} className="repo-card" style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: T.faint }}>{desc}</div>
    </button>
  );
}

function FolderMetricsWidget() {
  return <FolderMetrics />;
}

function ModuleTableWidget({ modules }) {
  return <ModuleTable modules={modules} />;
}

function ImportTableWidget({ imports }) {
  return <ImportTable imports={imports} />;
}

function GraphSearch({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></div>
      <input
        aria-label="Search by file, class, function, module, or package"
        type="text"
        placeholder="Search files, classes, functions..."
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "6px 12px 6px 30px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }}
      />
    </div>
  );
}

function GraphFilters({ searchTerm, setSearchTerm, filterType, setFilterType, filterLang, setFilterLang, filterFolder, setFilterFolder, filterRel, setFilterRel, filterVis, setFilterVis, folderOptions }) {
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 12 }} aria-label="Graph filters">
      <h3 style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Graph Filters</h3>
      <GraphSearch value={searchTerm} onChange={setSearchTerm} />
      <GraphSelect label="Node Type" ariaLabel="Filter by Node Type" value={filterType} onChange={setFilterType} options={["All", "Repository", "Folder", "File", "Module", "Package", "Class", "Function", "Interface", "Database Table", "API Endpoint", "Service"]} />
      <GraphSelect label="Language" ariaLabel="Filter by Language" value={filterLang} onChange={setFilterLang} options={["All", "TypeScript", "React", "SQL", "HTTP", "Go", "Mixed"]} />
      <GraphSelect label="Folder" ariaLabel="Filter by Folder" value={filterFolder} onChange={setFilterFolder} options={folderOptions} />
      <GraphSelect label="Relationship Type" ariaLabel="Filter by Relationship Type" value={filterRel} onChange={setFilterRel} options={[
        ["All", "All Relationships"],
        ["contains", "Contains"],
        ["imports", "Imports"],
        ["calls", "Calls"],
        ["defines", "Defines"],
        ["extends", "Extends"],
        ["implements", "Implements"],
        ["uses", "Uses"],
        ["depends on", "Depends On"],
        ["exports", "Exports"],
        ["references", "References"],
      ]} />
      <GraphSelect label="Visibility" ariaLabel="Filter by Visibility" value={filterVis} onChange={setFilterVis} options={["All", "Public", "Private"]} />
    </section>
  );
}

function GraphSelect({ label, ariaLabel, value, onChange, options }) {
  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>{label}</div>
      <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
        {options.map(option => {
          const valueLabel = Array.isArray(option) ? option : [option, option === "All" ? `All ${label === "Folder" ? "Folders" : ""}`.trim() || "All" : option];
          return <option key={valueLabel[0]} value={valueLabel[0]}>{valueLabel[1]}</option>;
        })}
      </select>
    </div>
  );
}

function GraphLegend() {
  return (
    <section style={{ padding: 16, flex: 1, overflowY: "auto" }} aria-label="Graph legend">
      <h3 style={{ fontSize: 12, fontWeight: 500, color: T.dim, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Legend</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <LegendItem label="Repository" color={T.accent} />
        <LegendItem label="Folder / File" color={T.border} />
        <LegendItem label="Module / API" color={T.info} />
        <LegendItem label="Class" color={T.warning} />
        <LegendItem label="Function" color={T.success} />
        <LegendItem label="Database" color={T.error} />
        <LegendItem label="Package" color="#a371f7" />
        <LegendItem label="Interface" color="#71f7a3" />
        <LegendItem label="Service" color="#f771a3" />
      </div>
      <h3 style={{ fontSize: 12, fontWeight: 500, color: T.dim, marginTop: 24, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Edges</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <LegendEdge label="contains" color={T.faint} type="solid" />
        <LegendEdge label="defines" color={T.accentBright} type="dotted" />
        <LegendEdge label="imports" color={T.warning} type="dashed" />
        <LegendEdge label="calls" color={T.info} type="solid" />
        <LegendEdge label="depends on" color={T.error} type="dashed" />
        <LegendEdge label="uses" color={T.accentBright} type="solid" />
        <LegendEdge label="exports" color="#a371f7" type="solid" />
        <LegendEdge label="implements" color={T.success} type="dashed" />
        <LegendEdge label="extends" color="#71f7a3" type="dashed" />
        <LegendEdge label="references" color="#f771a3" type="dashed" />
      </div>
    </section>
  );
}

function GraphToolbar({ showLabels, setShowLabels, resetGraph, centerGraph }) {
  return (
    <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "6px 8px", boxShadow: T.shadow, whiteSpace: "nowrap" }}>
      <button aria-label="Toggle Labels" onClick={() => setShowLabels(!showLabels)} style={{ padding: "4px 8px", background: "none", color: showLabels ? T.text : T.dim, border: "none", cursor: "pointer", fontSize: 12 }}>{showLabels ? "Hide Labels" : "Show Labels"}</button>
      <div style={{ width: 1, background: T.border }} />
      <button aria-label="Reset Graph" onClick={resetGraph} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>Reset Graph</button>
      <div style={{ width: 1, background: T.border }} />
      <button aria-label="Center Graph" onClick={centerGraph} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }} title="Refocus the graph">Center Graph</button>
      <div style={{ width: 1, background: T.border }} />
      <button aria-label="Export Image" onClick={() => alert("Export image placeholder")} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>Export Image</button>
    </div>
  );
}

function GraphCanvas({ nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onPaneClick }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      attributionPosition="bottom-right"
      theme="dark"
    >
      <Background color={T.border} gap={20} size={1} />
      <Controls style={{ display: 'flex', flexDirection: 'column', backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: 'hidden' }} />
      <MiniMap
        nodeColor={n => {
          if(n.data.type === 'Class') return T.warning;
          if(n.data.type === 'Function') return T.success;
          if(n.data.type === 'Package') return "#a371f7";
          if(n.data.type === 'Service') return "#f771a3";
          if(n.data.type === 'Repository') return T.accent;
          return T.surfaceEl;
        }}
        style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6 }}
        maskColor="rgba(0,0,0,0.5)"
      />
    </ReactFlow>
  );
}

function KnowledgeNodeInspector({ selectedNode, nodes, edges, setActivePage }) {
  if (!selectedNode) return null;
  const children = graphMockData.nodes.filter(n => n.data.parent === selectedNode.id);
  const incoming = edges.filter(e => e.target === selectedNode.id);
  const outgoing = edges.filter(e => e.source === selectedNode.id);
  return (
    <section style={{ padding: 20 }} aria-label="Selected node details">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: T.r6, background: T.surfaceEl, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}><Icons.file size={16} /></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: T.mono }}>{selectedNode.data.label}</div>
          <div style={{ fontSize: 11, color: T.dim }}>{selectedNode.data.type} &middot; {selectedNode.data.lang}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        <DashButton icon={Icons.search} label="Open File" variant="secondary" onClick={() => {}} />
        <DashButton icon={Icons.arch} label="View Analysis" variant="secondary" onClick={() => setActivePage?.("repo-analysis")} />
        <DashButton icon={Icons.deps} label="View Dependencies" variant="secondary" onClick={() => setActivePage?.("deps")} style={{ gridColumn: "1 / -1" }} />
      </div>
      <GraphMetadata selectedNode={selectedNode} />
      <RelatedNodeList title={`Children (${children.length})`} nodes={children} />
      <RelationshipList title={`Incoming Relationships (${incoming.length})`} edges={incoming} nodes={nodes} direction="incoming" />
      <RelationshipList title={`Outgoing Relationships (${outgoing.length})`} edges={outgoing} nodes={nodes} direction="outgoing" />
    </section>
  );
}

function GraphMetadata({ selectedNode }) {
  return (
    <>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase" }}>Metadata</div>
      <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 12, marginBottom: 24, fontSize: 12, color: T.text }}>
        {[
          ["Name", selectedNode.data.label],
          ["Type", selectedNode.data.type],
          ["Path", selectedNode.data.path],
          ["Language", selectedNode.data.lang],
          ["Parent", selectedNode.data.parent || "none"],
          ["Visibility", selectedNode.data.visibility],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: label === "Visibility" ? 0 : 8 }}>
            <span style={{ color: T.faint }}>{label}</span>
            <span style={{ fontFamily: label === "Path" || label === "Parent" ? T.mono : T.sans, color: label === "Visibility" && value === "Public" ? T.success : T.dim, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function RelatedNodeList({ title, nodes }) {
  if (!nodes.length) return null;
  return (
    <>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 24 }}>
        {nodes.map(node => (
          <div key={node.id} style={{ fontSize: 12, fontFamily: T.mono, color: T.text, padding: "4px 8px", background: T.surfaceEl, borderRadius: T.r4 }}>
            {node.data.label} <span style={{ color: T.faint, fontSize: 10 }}>({node.data.type})</span>
          </div>
        ))}
      </div>
    </>
  );
}

function RelationshipList({ title, edges, nodes, direction }) {
  return (
    <>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {edges.length === 0 && <div style={{ fontSize: 12, color: T.faint, background: T.surfaceEl, borderRadius: T.r4, padding: "8px 10px" }}>No relationships</div>}
        {edges.map(edge => {
          const otherNode = nodes.find(n => n.id === (direction === "incoming" ? edge.source : edge.target));
          if (!otherNode) return null;
          return (
            <div key={edge.id} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "8px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: direction === "incoming" ? T.warning : T.info }}>{edge.label}</div>
              <div style={{ fontSize: 12, fontFamily: T.mono, color: T.text, textAlign: "right" }}>{otherNode.data.label}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function KnowledgeStatisticsPanel() {
  return (
    <section style={{ padding: 20 }} aria-label="Graph statistics">
      <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 16 }}>Graph Statistics</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 12 }}>
          <div style={{ fontSize: 20, color: T.text, fontFamily: T.mono }}>{graphMockData.nodes.length}</div>
          <div style={{ fontSize: 11, color: T.dim }}>Total Nodes</div>
        </div>
        <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 12 }}>
          <div style={{ fontSize: 20, color: T.text, fontFamily: T.mono }}>{graphMockData.edges.length}</div>
          <div style={{ fontSize: 11, color: T.dim }}>Total Edges</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <StatRow label="Functions" val={graphMockData.nodes.filter(n => n.data.type === 'Function').length} />
        <StatRow label="Classes" val={graphMockData.nodes.filter(n => n.data.type === 'Class').length} />
        <StatRow label="Modules" val={graphMockData.nodes.filter(n => n.data.type === 'Module').length} />
        <StatRow label="Files" val={graphMockData.nodes.filter(n => n.data.type === 'File').length} />
        <StatRow label="Packages" val={graphMockData.nodes.filter(n => n.data.type === 'Package').length} />
        <StatRow label="Avg Connections" val={(graphMockData.edges.length / graphMockData.nodes.length).toFixed(1)} />
        <StatRow label="Graph Density" val="0.14" />
      </div>
      <div style={{ marginTop: 40, textAlign: "center", color: T.faint, fontSize: 13, padding: 20 }}>
        Select a node in the graph to view its details and relationships.
      </div>
    </section>
  );
}

function KnowledgeGraphInner({ status, setStatus }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterLang, setFilterLang] = useState("All");
  const [filterFolder, setFilterFolder] = useState("All");
  const [filterRel, setFilterRel] = useState("All");
  const [filterVis, setFilterVis] = useState("All");
  const [showLabels, setShowLabels] = useState(true);
  
  const { fitView } = useReactFlow();
  const folderOptions = ["All", ...graphMockData.nodes.filter(n => n.data.type === "Folder").map(n => [n.id, n.data.path])];

  // Initialize and apply filters dynamically
  useEffect(() => {
    const filteredNodes = graphMockData.nodes.map(node => {
      const matchSearch = node.data.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === "All" || node.data.type === filterType;
      const matchLang = filterLang === "All" || node.data.lang === filterLang;
      const folderNode = graphMockData.nodes.find(n => n.id === filterFolder);
      const matchFolder = filterFolder === "All" || node.id === filterFolder || node.data.parent === filterFolder || (folderNode && node.data.path?.startsWith(folderNode.data.path));
      const matchVis = filterVis === "All" || node.data.visibility === filterVis;
      const isVisible = matchSearch && matchType && matchLang && matchFolder && matchVis;
      
      return {
        ...node,
        data: { ...node.data, hidden: !isVisible, hideLabel: !showLabels }
      };
    });

    const filteredEdges = graphMockData.edges.map(edge => {
      const matchRel = filterRel === "All" || edge.label === filterRel;
      
      const sourceVisible = filteredNodes.find(n => n.id === edge.source && !n.data.hidden);
      const targetVisible = filteredNodes.find(n => n.id === edge.target && !n.data.hidden);
      const isVisible = matchRel && sourceVisible && targetVisible;

      const edgeStyleProps = GraphEdge(edge.label, selectedNodeId, edge.source, edge.target);

      return {
        ...edge,
        type: "smoothstep",
        hidden: !isVisible,
        ...edgeStyleProps
      };
    });

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [searchTerm, filterType, filterLang, filterFolder, filterRel, filterVis, showLabels, selectedNodeId, setNodes, setEdges]);

  // Hook to refit view when filters change heavily (optional, but good UX)
  useEffect(() => {
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 50);
  }, [searchTerm, filterType, filterLang, filterFolder, showLabels, fitView]);

  const onNodeClick = (_, node) => setSelectedNodeId(node.id);
  const onPaneClick = () => setSelectedNodeId(null);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  if (status === "loading") return <GraphLoadingState />;
  if (status === "empty") return <GraphEmptyState onRun={() => setStatus("running")} />;
  if (status === "error") return <GraphErrorState onRetry={() => setStatus("success")} />;
  if (status === "failed") return <GraphFailedState />;
  if (status === "running") return <GraphRunningState />;

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <div className="knowledge-layout" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 320px", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar */}
        <div style={{ width: 260, borderRight: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column" }}>
          <GraphFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterType={filterType}
            setFilterType={setFilterType}
            filterLang={filterLang}
            setFilterLang={setFilterLang}
            filterFolder={filterFolder}
            setFilterFolder={setFilterFolder}
            filterRel={filterRel}
            setFilterRel={setFilterRel}
            filterVis={filterVis}
            setFilterVis={setFilterVis}
            folderOptions={folderOptions}
          />
          <GraphLegend />
        </div>

        {/* Center Canvas */}
        <div style={{ minWidth: 0, position: "relative", background: T.bg }}>
          <GraphToolbar
            showLabels={showLabels}
            setShowLabels={setShowLabels}
            resetGraph={() => { setSearchTerm(""); setFilterType("All"); setFilterLang("All"); setFilterFolder("All"); setFilterRel("All"); setFilterVis("All"); setSelectedNodeId(null); }}
            centerGraph={() => fitView({ duration: 800, padding: 0.2 })}
          />
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
          />
        </div>

        {/* Right Sidebar */}
        <div style={{ width: 320, borderLeft: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {selectedNode
            ? <KnowledgeNodeInspector selectedNode={selectedNode} edges={edges} nodes={nodes} setActivePage={setActivePage} />
            : <KnowledgeStatisticsPanel />}
        </div>
      </div>
    </div>
  );
}

const LegendItem = ({ label, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.dim }}>
    <div style={{ width: 12, height: 12, borderRadius: 2, background: T.surfaceEl, border: `1px solid ${color}` }}></div>
    {label}
  </div>
);

const LegendEdge = ({ label, color, type }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.dim }}>
    <div style={{ width: 24, height: 2, background: type === 'solid' ? color : 'transparent', borderBottom: type === 'dashed' ? `2px dashed ${color}` : type === 'dotted' ? `2px dotted ${color}` : 'none' }}></div>
    {label}
  </div>
);

const StatRow = ({ label, val }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: `1px solid ${T.borderMid}` }}>
    <span style={{ fontSize: 12, color: T.dim }}>{label}</span>
    <span style={{ fontSize: 12, color: T.text, fontFamily: T.mono }}>{val}</span>
  </div>
);

/*  KNOWLEDGE GRAPH STATES  */
function GraphLoadingState() {
  return (
    <div className="knowledge-layout" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 320px", height: "100%", overflow: "hidden" }}>
      <aside style={{ borderRight: `1px solid ${T.border}`, background: T.surface, padding: 16 }}>
        <div className="dash-skeleton" style={{ height: 18, width: "48%", marginBottom: 18 }} />
        {[80, 100, 92, 76, 88].map((w, i) => <div key={i} className="dash-skeleton" style={{ height: 30, width: `${w}%`, marginBottom: 10 }} />)}
        <div className="dash-skeleton" style={{ height: 18, width: "36%", margin: "28px 0 14px" }} />
        {[65, 72, 58, 80, 66].map((w, i) => <div key={i} className="dash-skeleton" style={{ height: 14, width: `${w}%`, marginBottom: 12 }} />)}
      </aside>
      <main style={{ position: "relative", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${T.border} 1px, transparent 1px)`, backgroundSize: "22px 22px", opacity: 0.8 }} />
        {[["28%","22%"],["50%","36%"],["68%","24%"],["40%","58%"],["62%","64%"]].map(([left, top], i) => (
          <div key={i} className="dash-skeleton" style={{ position: "absolute", left, top, width: 118 + i * 8, height: 42, border: `1px solid ${T.border}`, borderRadius: T.r6 }} />
        ))}
        <div style={{ position: "relative", width: 360, textAlign: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 24, boxShadow: T.shadow }}>
          <div style={{ width: 48, height: 48, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", margin: "0 auto 18px", animation: "spin 1s linear infinite" }} />
          <h2 style={{ fontSize: 18, color: T.text, marginBottom: 8 }}>Generating Knowledge Graph...</h2>
          <p style={{ color: T.dim, fontSize: 13, marginBottom: 18 }}>Extracting entities, resolving relationships, and preparing graph controls.</p>
          <ProgressBar value={68} animated />
        </div>
      </main>
      <aside style={{ borderLeft: `1px solid ${T.border}`, background: T.surface, padding: 20 }}>
        <div className="dash-skeleton" style={{ height: 34, width: "72%", marginBottom: 24 }} />
        <div className="dash-skeleton" style={{ height: 96, width: "100%", marginBottom: 18 }} />
        {[100, 88, 94, 76].map((w, i) => <div key={i} className="dash-skeleton" style={{ height: 18, width: `${w}%`, marginBottom: 12 }} />)}
      </aside>
    </div>
  );
}
function GraphEmptyState({ onRun }) {
  return (
    <div style={{ padding: "40px", maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, background: T.surfaceEl, borderRadius: T.r8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: T.faint }}>
        <Icons.arch size={24} />
      </div>
      <h2 style={{ fontSize: 18, color: T.text, marginBottom: 12 }}>No graph has been generated yet.</h2>
      <p style={{ color: T.dim, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>The Knowledge Graph visualizes dependencies, imports, and calls across your repository. Run an analysis to build it.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <DashButton icon={Icons.arch} label="Run Analysis" variant="primary" onClick={onRun} />
        <DashButton icon={Icons.upload} label="Refresh" variant="secondary" onClick={() => {}} />
      </div>
    </div>
  );
}
function GraphErrorState({ onRetry }) {
  return (
    <div style={{ padding: "40px", maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, background: "rgba(248,81,73,0.1)", borderRadius: T.r8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: T.error }}>
        <Icons.error size={24} />
      </div>
      <h2 style={{ fontSize: 18, color: T.text, marginBottom: 12 }}>Unable to load graph</h2>
      <p style={{ color: T.dim, fontSize: 14, marginBottom: 24 }}>The graph generation process crashed due to an out-of-memory error while parsing deep dependencies.</p>
      <DashButton icon={Icons.upload} label="Retry Generation" variant="primary" onClick={onRetry} />
    </div>
  );
}
function GraphFailedState() {
  return <GraphErrorState onRetry={() => {}} />;
}
function GraphRunningState() {
  return <GraphLoadingState />;
}

/* 
   PROMPT 11: ARCHITECTURE EXPLORER
 */

const archLayerColors = {
  "Presentation Layer": T.info,
  "Business Layer": T.warning,
  "Data Layer": T.success,
  "Infrastructure Layer": T.accentBright,
  "External Services": "#a371f7",
};

function architectureEdgeStyle(label, isActive, isDimmed) {
  const palette = {
    calls: [T.info, "0", true],
    reads: [T.success, "4 2", false],
    writes: [T.warning, "0", true],
    publishes: ["#a371f7", "3 3", true],
    consumes: ["#f771a3", "3 3", true],
    authenticates: [T.accentBright, "6 2", true],
    stores: [T.success, "1 4", false],
    caches: [T.accent, "2 3", true],
    triggers: [T.warning, "6 2", true],
    "depends on": [T.error, "2 4", false],
    imports: [T.faint, "5 5", false],
  };
  const [color, dash, animated] = palette[label] || [T.dim, "0", false];
  return {
    animated: isActive || animated,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeDasharray: dash, strokeWidth: isActive ? 3 : 1.4, opacity: isDimmed ? 0.13 : 1 },
  };
}

function ArchitectureNode({ data, selected }) {
  const color = archLayerColors[data.layer] || T.dim;
  return (
    <div aria-label={`${data.type}: ${data.label}`} style={{ minWidth: 168, background: T.surface, border: `1px solid ${selected ? T.text : color}`, borderRadius: T.r8, boxShadow: selected ? `0 0 0 3px ${T.accentSoft}` : T.shadow, opacity: data.hidden ? 0.2 : 1, overflow: "hidden" }}>
      <Handle type="target" position={Position.Left} style={{ background: color, border: "none" }} />
      <div style={{ height: 4, background: color }} />
      <div style={{ padding: 12, display: "grid", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 650, fontFamily: T.mono }}>{data.label}</span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color, marginTop: 4 }} />
        </div>
        <div style={{ color: T.dim, fontSize: 11 }}>{data.type}</div>
        {!data.hideLayer && <div style={{ color: T.faint, fontSize: 10 }}>{data.layer}</div>}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, border: "none" }} />
    </div>
  );
}

const architectureNodeTypes = { architecture: ArchitectureNode };

function ArchitectureEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 18 });
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "none", background: T.surface, border: `1px solid ${T.border}`, color: data?.active ? T.text : T.dim, borderRadius: 999, padding: "2px 7px", fontSize: 10, fontFamily: T.mono, boxShadow: data?.active ? T.shadow : "none" }}>
          {data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const architectureEdgeTypes = { architecture: ArchitectureEdge };

function ArchitectureSearch({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></span>
      <input aria-label="Search architecture" value={value} onChange={e => onChange(e.target.value)} placeholder="Search services, routes, databases..." style={{ width: "100%", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "7px 10px 7px 32px", outline: "none", fontSize: 13 }} />
    </div>
  );
}

function ArchitectureFilters({ filters, setFilters }) {
  const selectStyle = { width: "100%", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, padding: 7, fontSize: 12, outline: "none" };
  const set = (key, value) => setFilters({ ...filters, [key]: value });
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}`, display: "grid", gap: 10 }}>
      <h3 style={{ fontSize: 13, color: T.text, margin: 0 }}>Architecture Filters</h3>
      <ArchitectureSearch value={filters.search} onChange={value => set("search", value)} />
      {[
        ["layer", "Layer", ["All", "Presentation Layer", "Business Layer", "Data Layer", "Infrastructure Layer", "External Services"]],
        ["language", "Language", ["All", "TypeScript", "Go", "SQL", "Redis", "Python", "HTTPS", "YAML", "ENV"]],
        ["framework", "Framework", ["All", "React", "Express", "NestJS", "Node", "JWT", "Prisma", "PostgreSQL", "Redis", "RabbitMQ", "Docker", "Runtime"]],
        ["nodeType", "Node Type", ["All", "Frontend", "Backend", "API Gateway", "Module", "Route", "Controller", "Service", "Repository", "Database", "Redis Cache", "Message Queue", "External APIs", "Auth", "Worker", "Scheduler", "Storage", "Configuration", "Environment"]],
        ["relationship", "Relationship", ["All", "calls", "reads", "writes", "publishes", "consumes", "authenticates", "stores", "caches", "triggers", "depends on", "imports"]],
        ["visibility", "Visibility", ["All", "Public", "Internal", "Private", "External"]],
      ].map(([key, label, options]) => (
        <label key={key} style={{ display: "grid", gap: 4, color: T.dim, fontSize: 11 }}>
          {label}
          <select aria-label={`Filter by ${label}`} value={filters[key]} onChange={e => set(key, e.target.value)} style={selectStyle}>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ))}
    </section>
  );
}

function LayerSwitcher({ level, setLevel, collapsedLayers, toggleLayer }) {
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Architecture Levels</h3>
      <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
        {architectureMockData.levels.map(item => (
          <button key={item} onClick={() => setLevel(item)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: T.r4, border: `1px solid ${level === item ? T.accentBorder : T.border}`, background: level === item ? T.accentSoft : T.surfaceEl, color: level === item ? T.accentBright : T.dim, cursor: "pointer", fontSize: 12 }}>{item}</button>
        ))}
      </div>
      <h3 style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Layers</h3>
      <div style={{ display: "grid", gap: 6 }}>
        {Object.entries(archLayerColors).map(([layerName, color]) => (
          <button key={layerName} onClick={() => toggleLayer(layerName)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 9px", borderRadius: T.r4, border: `1px solid ${T.border}`, background: collapsedLayers.has(layerName) ? T.bg : T.surfaceEl, color: collapsedLayers.has(layerName) ? T.faint : T.text, cursor: "pointer", fontSize: 12 }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color, marginRight: 7 }} />{layerName}</span>
            <span>{collapsedLayers.has(layerName) ? "Collapsed" : "Visible"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FlowSimulator({ activeFlow, setActiveFlow }) {
  const labels = { login: "Login API", checkout: "Checkout", session: "Session Check" };
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Request Flow Simulation</h3>
      <div style={{ display: "grid", gap: 7 }}>
        {Object.keys(architectureMockData.flows).map(flow => (
          <button key={flow} onClick={() => setActiveFlow(activeFlow === flow ? null : flow)} style={{ padding: "8px 10px", borderRadius: T.r6, border: `1px solid ${activeFlow === flow ? T.accentBorder : T.border}`, background: activeFlow === flow ? T.accentSoft : T.surfaceEl, color: activeFlow === flow ? T.accentBright : T.text, textAlign: "left", cursor: "pointer", fontSize: 12 }}>{labels[flow]}</button>
        ))}
      </div>
    </section>
  );
}

function ArchitectureToolbar({ fitView, reset, focusMode, setFocusMode, fullscreen, setFullscreen, autoLayout }) {
  return (
    <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "6px 8px", boxShadow: T.shadow, whiteSpace: "nowrap" }}>
      <button aria-label="Auto layout" onClick={autoLayout} style={archToolButton}>Auto Layout</button>
      <button aria-label="Fit view" onClick={fitView} style={archToolButton}>Fit View</button>
      <button aria-label="Toggle focus mode" onClick={() => setFocusMode(!focusMode)} style={{ ...archToolButton, color: focusMode ? T.accentBright : T.text }}>Focus Mode</button>
      <button aria-label="Toggle fullscreen" onClick={() => setFullscreen(!fullscreen)} style={{ ...archToolButton, color: fullscreen ? T.accentBright : T.text }}>Fullscreen</button>
      <button aria-label="Reset graph" onClick={reset} style={archToolButton}>Reset</button>
    </div>
  );
}
const archToolButton = { padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 };

function MiniMapControls() {
  return (
    <>
      <Controls style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: "hidden" }} />
      <MiniMap nodeColor={node => archLayerColors[node.data.layer] || T.dim} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6 }} maskColor="rgba(0,0,0,0.55)" />
    </>
  );
}

function ArchitectureCanvas({ nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onPaneClick }) {
  return (
    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onPaneClick={onPaneClick} nodeTypes={architectureNodeTypes} edgeTypes={architectureEdgeTypes} fitView theme="dark" attributionPosition="bottom-right">
      <Background color={T.border} gap={24} size={1} />
      <MiniMapControls />
    </ReactFlow>
  );
}

function ArchitectureNodeInspector({ node, nodes, edges, setActivePage, expandedNodeIds, toggleExpand }) {
  if (!node) return <ArchitectureStatisticsPanel />;
  const incoming = edges.filter(edge => edge.target === node.id);
  const outgoing = edges.filter(edge => edge.source === node.id);
  const related = id => nodes.find(nodeItem => nodeItem.id === id)?.data.label || id;
  return (
    <aside style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 36, height: 36, borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${archLayerColors[node.data.layer]}`, display: "grid", placeItems: "center" }}><Icons.arch /></span>
        <div>
          <div style={{ color: T.text, fontSize: 15, fontWeight: 650, fontFamily: T.mono }}>{node.data.label}</div>
          <div style={{ color: T.dim, fontSize: 12 }}>{node.data.type}  {node.data.layer}</div>
        </div>
      </div>
      <p style={{ color: T.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>{node.data.description}</p>
      <InfoBlock rows={[["Repository Path", node.data.path], ["Language", node.data.lang], ["Framework", node.data.framework], ["Visibility", node.data.visibility]]} />
      <InspectorList title={`Incoming Connections (${incoming.length})`} items={incoming.map(edge => `${related(edge.source)}  ${edge.label}`)} />
      <InspectorList title={`Outgoing Connections (${outgoing.length})`} items={outgoing.map(edge => `${edge.label}  ${related(edge.target)}`)} />
      <InspectorList title="Related Files" items={node.data.files || []} />
      <InspectorList title="Related APIs" items={node.data.apis || []} />
      <InspectorList title="Related Services" items={node.data.services || []} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        <DashButton icon={Icons.file} label="Open Source" variant="secondary" onClick={() => setActivePage("repo-explorer")} />
        <DashButton icon={Icons.deps} label="Dependencies" variant="secondary" onClick={() => setActivePage("deps")} />
        <DashButton icon={Icons.graph} label={expandedNodeIds.has(node.id) ? "Collapse Node" : "Expand Node"} variant="secondary" onClick={() => toggleExpand(node.id)} />
        <DashButton icon={Icons.impact} label="Analysis" variant="secondary" onClick={() => setActivePage("repo-analysis")} style={{ gridColumn: "1 / -1" }} />
      </div>
    </aside>
  );
}

function InfoBlock({ rows }) {
  return (
    <div style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12, display: "grid", gap: 8, marginBottom: 18 }}>
      {rows.map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}><span style={{ color: T.faint }}>{label}</span><span style={{ color: T.text, fontFamily: T.mono, textAlign: "right", wordBreak: "break-word" }}>{value}</span></div>)}
    </div>
  );
}

function InspectorList({ title, items }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.length ? items.map(item => <div key={item} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "6px 8px", color: T.text, fontSize: 12, fontFamily: T.mono }}>{item}</div>) : <div style={{ color: T.faint, fontSize: 12 }}>None</div>}
      </div>
    </div>
  );
}

function ArchitectureStatisticsPanel() {
  const allNodes = architectureMockData.nodes;
  const totalApis = allNodes.reduce((sum, node) => sum + (node.data.apis || []).length, 0);
  const avgConnections = (architectureMockData.edges.length / Math.max(allNodes.length, 1)).toFixed(1);
  const countType = types => allNodes.filter(node => types.includes(node.data.type)).length;
  const stats = [
    ["Total Services", countType(["Service"])],
    ["Total APIs", totalApis],
    ["Total Controllers", countType(["Controller"])],
    ["Total Databases", countType(["Database", "Redis Cache"])],
    ["External Integrations", countType(["External APIs", "Storage"])],
    ["Architecture Layers", Object.keys(archLayerColors).length],
    ["Dependency Count", architectureMockData.edges.length],
    ["Average Connections", avgConnections],
  ];
  return <aside style={{ padding: 20 }}><h3 style={{ color: T.text, fontSize: 14, marginBottom: 16 }}>Architecture Statistics</h3><div style={{ display: "grid", gap: 10 }}>{stats.map(([label, value]) => <StatRow key={label} label={label} val={value} />)}</div></aside>;
}

function HealthCards() {
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Architecture Health</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["Layer Coupling", "Medium", T.warning], ["Circular Deps", "2", T.error], ["Unused Services", "3", T.info], ["Service Density", "Healthy", T.success], ["Complexity", "High", T.warning], ["Risk Score", "Medium", T.warning]].map(([label, value, color]) => (
          <div key={label} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}>
            <div style={{ color: T.faint, fontSize: 10 }}>{label}</div>
            <div style={{ color, fontSize: 13, fontWeight: 650, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArchitectureLegend() {
  return (
    <section style={{ padding: 16 }}>
      <h3 style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Legend</h3>
      <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
        {Object.entries(archLayerColors).map(([label, color]) => <div key={label} style={{ color: T.dim }}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color, marginRight: 8 }} />{label}</div>)}
        {["calls", "reads", "writes", "publishes", "consumes", "authenticates", "stores", "caches", "triggers", "depends on", "imports"].map(rel => <div key={rel} style={{ color: T.faint }}>{rel}</div>)}
      </div>
    </section>
  );
}

function ArchitectureQuickNav({ setActivePage }) {
  return (
    <section style={{ padding: 16, borderTop: `1px solid ${T.border}` }}>
      <h3 style={{ fontSize: 12, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Quick Navigation</h3>
      <div style={{ display: "grid", gap: 7 }}>
        {[["Repository Explorer", "repo-explorer"], ["Repository Analysis", "repo-analysis"], ["Dependency Explorer", "deps"], ["Git Timeline", "git"], ["Impact Analysis", "impact"]].map(([label, page]) => <button key={page} onClick={() => setActivePage(page)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: T.r4, border: `1px solid ${T.border}`, background: T.surfaceEl, color: T.text, cursor: "pointer", fontSize: 12 }}>{label}</button>)}
      </div>
    </section>
  );
}

function ArchitectureLoadingSkeleton() {
  return <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 340px", height: "100%" }}><div className="dash-skeleton" style={{ margin: 16 }} /><div style={{ display: "grid", placeItems: "center" }}><GraphLoadingState /></div><div className="dash-skeleton" style={{ margin: 16 }} /></div>;
}

function ArchitectureEmptyState({ onRun }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}><div><Icons.arch size={44} /><h2 style={{ color: T.text, marginTop: 14 }}>No architecture model generated yet.</h2><p style={{ color: T.dim, margin: "8px 0 18px" }}>Run architecture generation to map services, layers, APIs, and data stores.</p><DashButton variant="primary" onClick={onRun}>Generate Architecture</DashButton></div></div>;
}

function ArchitectureErrorState({ onRetry }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}><div><Icons.error size={44} stroke={T.error} /><h2 style={{ color: T.text, marginTop: 14 }}>Unable to load architecture.</h2><p style={{ color: T.dim, margin: "8px 0 18px" }}>The architecture graph could not be generated from the latest analysis data.</p><DashButton variant="primary" onClick={onRetry}>Retry</DashButton></div></div>;
}

function ArchitectureExplorerPage({ setActivePage }) {
  return <ReactFlowProvider><ArchitectureExplorerInner setActivePage={setActivePage} /></ReactFlowProvider>;
}

function ArchitectureExplorerInner({ setActivePage }) {
  const [status, setStatus] = useState("ready");
  const [level, setLevel] = useState("Repository View");
  const [filters, setFilters] = useState({ search: "", layer: "All", language: "All", framework: "All", nodeType: "All", relationship: "All", visibility: "All" });
  const [collapsedLayers, setCollapsedLayers] = useState(new Set());
  const [activeFlow, setActiveFlow] = useState("login");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState(new Set());
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const flowNodes = new Set(activeFlow ? architectureMockData.flows[activeFlow] : []);
    const expandedNeighbors = new Set();
    architectureMockData.edges.forEach(edge => {
      if (expandedNodeIds.has(edge.source)) expandedNeighbors.add(edge.target);
      if (expandedNodeIds.has(edge.target)) expandedNeighbors.add(edge.source);
    });
    const derivedNodes = architectureMockData.nodes.map(node => {
      const searchIndex = [node.data.label, node.data.type, node.data.path, node.data.framework, node.data.lang, ...(node.data.files || []), ...(node.data.apis || []), ...(node.data.services || [])].join(" ").toLowerCase();
      const match = searchIndex.includes(filters.search.toLowerCase());
      const visible = match && (filters.layer === "All" || node.data.layer === filters.layer) && (filters.language === "All" || node.data.lang === filters.language) && (filters.framework === "All" || node.data.framework === filters.framework) && (filters.nodeType === "All" || node.data.type === filters.nodeType) && (filters.visibility === "All" || node.data.visibility === filters.visibility) && !collapsedLayers.has(node.data.layer);
      const active = flowNodes.has(node.id);
      const expanded = expandedNodeIds.has(node.id) || expandedNeighbors.has(node.id);
      return { ...node, data: { ...node.data, hidden: !visible, hideLayer: level === "Project View" }, style: { opacity: !visible ? 0.1 : focusMode && activeFlow && !active && !expanded ? 0.18 : 1 } };
    });
    const derivedEdges = architectureMockData.edges.map(edge => {
      const sourceVisible = derivedNodes.find(node => node.id === edge.source && !node.data.hidden);
      const targetVisible = derivedNodes.find(node => node.id === edge.target && !node.data.hidden);
      const relationshipVisible = filters.relationship === "All" || edge.label === filters.relationship;
      const selectedPath = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
      const expandedPath = expandedNodeIds.has(edge.source) || expandedNodeIds.has(edge.target);
      const active = (activeFlow && flowNodes.has(edge.source) && flowNodes.has(edge.target)) || selectedPath || expandedPath;
      return { ...edge, type: "architecture", hidden: !(sourceVisible && targetVisible && relationshipVisible), data: { label: edge.label, active }, ...architectureEdgeStyle(edge.label, active, focusMode && activeFlow && !active) };
    });
    setNodes(derivedNodes);
    setEdges(derivedEdges);
  }, [filters, collapsedLayers, activeFlow, focusMode, level, selectedNodeId, expandedNodeIds, setNodes, setEdges]);

  if (status === "loading") return <ArchitectureLoadingSkeleton />;
  if (status === "empty") return <ArchitectureEmptyState onRun={() => setStatus("generating")} />;
  if (status === "error") return <ArchitectureErrorState onRetry={() => setStatus("ready")} />;
  if (status === "generating") return <ArchitectureLoadingSkeleton />;

  const selectedNode = selectedNodeId ? nodes.find(node => node.id === selectedNodeId) : null;
  const toggleLayer = layerName => setCollapsedLayers(prev => { const next = new Set(prev); next.has(layerName) ? next.delete(layerName) : next.add(layerName); return next; });
  const reset = () => { setFilters({ search: "", layer: "All", language: "All", framework: "All", nodeType: "All", relationship: "All", visibility: "All" }); setCollapsedLayers(new Set()); setActiveFlow(null); setSelectedNodeId(null); setExpandedNodeIds(new Set()); };
  const toggleExpand = nodeId => setExpandedNodeIds(prev => { const next = new Set(prev); next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId); return next; });
  const autoLayout = () => setNodes(current => current.map((node, index) => ({ ...node, position: { x: 90 + (index % 5) * 280, y: 70 + Math.floor(index / 5) * 170 } })));

  return (
    <div className="page-in" style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 340px", height: fullscreen ? "calc(100vh - 64px)" : "calc(100vh - 120px)", borderTop: `1px solid ${T.border}`, background: T.bg }}>
      <aside style={{ background: T.surface, borderRight: `1px solid ${T.border}`, overflowY: "auto" }}>
        <ArchitectureFilters filters={filters} setFilters={setFilters} />
        <LayerSwitcher level={level} setLevel={setLevel} collapsedLayers={collapsedLayers} toggleLayer={toggleLayer} />
        <FlowSimulator activeFlow={activeFlow} setActiveFlow={setActiveFlow} />
        <HealthCards />
        <ArchitectureLegend />
      </aside>
      <main style={{ position: "relative", minWidth: 0 }}>
        <ArchitectureToolbar fitView={() => fitView({ duration: 600, padding: 0.2 })} reset={reset} focusMode={focusMode} setFocusMode={setFocusMode} fullscreen={fullscreen} setFullscreen={setFullscreen} autoLayout={autoLayout} />
        <ArchitectureCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(null)} />
      </main>
      <aside style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto" }}>
        <ArchitectureNodeInspector node={selectedNode} nodes={nodes} edges={edges} setActivePage={setActivePage} expandedNodeIds={expandedNodeIds} toggleExpand={toggleExpand} />
        <ArchitectureQuickNav setActivePage={setActivePage} />
      </aside>
    </div>
  );
}

/* 
   PROMPT 12: CHANGE IMPACT ANALYSIS
 */

const impactRiskColor = risk => risk === "Critical" ? T.error : risk === "High" ? T.warning : risk === "Medium" ? T.info : T.success;

function ImpactSearch({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></div>
      <input aria-label="Search files, functions, services, classes, and APIs" value={value} onChange={e => onChange(e.target.value)} placeholder="Search impact targets..." style={{ width: "100%", padding: "7px 10px 7px 30px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }} />
    </div>
  );
}

function ImpactFilters({ filters, setFilters, maxDepth, setMaxDepth }) {
  const field = (key, label, values) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <select aria-label={label} value={filters[key]} onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: "100%", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "7px 9px", fontSize: 12 }}>
        {values.map(value => <option key={value}>{value}</option>)}
      </select>
    </label>
  );
  return (
    <section style={{ display: "grid", gap: 12, padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>Filters</h3>
        <button aria-label="Reset impact filters" onClick={() => { setFilters({ search: "", risk: "All", componentType: "All", language: "All", relationship: "All" }); setMaxDepth(3); }} style={{ background: "transparent", border: "none", color: T.accentBright, fontSize: 12, cursor: "pointer" }}>Reset</button>
      </div>
      <ImpactSearch value={filters.search} onChange={value => setFilters(prev => ({ ...prev, search: value }))} />
      {field("risk", "Risk Level", ["All", "Low", "Medium", "High", "Critical"])}
      {field("componentType", "Component Type", ["All", "File", "Function", "Class", "Service", "API Endpoint", "Database Table", "Repository", "Worker"])}
      {field("language", "Language", ["All", "TypeScript", "HTTP", "Go", "SQL", "Kotlin"])}
      {field("relationship", "Relationship Type", ["All", "defines", "called by", "guards", "depends on", "uses", "queries", "referenced by", "contract"])}
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dependency Depth</span>
        <input aria-label="Dependency depth" type="range" min="1" max="3" value={maxDepth} onChange={e => setMaxDepth(Number(e.target.value))} />
        <span style={{ color: T.faint, fontSize: 12 }}>Showing levels 1 to {maxDepth}</span>
      </label>
    </section>
  );
}

function ImpactTargetTree({ items, selectedTargetId, setSelectedTargetId, depth = 0 }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {items.map(item => <ImpactTargetItem key={item.id} item={item} depth={depth} selectedTargetId={selectedTargetId} setSelectedTargetId={setSelectedTargetId} />)}
    </div>
  );
}

function ImpactTargetItem({ item, depth, selectedTargetId, setSelectedTargetId }) {
  const [open, setOpen] = useState(depth < 2);
  const active = selectedTargetId === item.id;
  const hasChildren = item.children?.length > 0;
  return (
    <div>
      <button aria-label={`Select ${item.type} ${item.name}`} onClick={() => { setSelectedTargetId(item.id); if (hasChildren) setOpen(!open); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", paddingLeft: 8 + depth * 14, border: `1px solid ${active ? T.accentBorder : "transparent"}`, borderRadius: T.r6, background: active ? T.accentSoft : "transparent", color: active ? T.accentBright : T.text, cursor: "pointer", textAlign: "left" }}>
        <span style={{ width: 14, color: T.faint }}>{hasChildren ? (open ? <Icons.chevronDown size={13} /> : <Icons.chevronRight size={13} />) : null}</span>
        <Icons.file size={14} />
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontFamily: T.mono }}>{item.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.faint }}>{item.type}</span>
      </button>
      {open && hasChildren && <ImpactTargetTree items={item.children} depth={depth + 1} selectedTargetId={selectedTargetId} setSelectedTargetId={setSelectedTargetId} />}
    </div>
  );
}

function ImpactHistoryPanel({ history, setSelectedTargetId }) {
  return (
    <section style={{ padding: 16, borderTop: `1px solid ${T.border}` }}>
      <h3 style={{ fontSize: 14, color: T.text, marginBottom: 10 }}>History</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {history.map(item => (
          <button key={item.id} onClick={() => setSelectedTargetId("class-token-service")} style={{ textAlign: "left", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{item.target}</span><span style={{ color: impactRiskColor(item.risk), fontSize: 11 }}>{item.risk}</span></div>
            <div style={{ color: T.dim, fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>{item.summary}</div>
            <div style={{ color: T.faint, fontSize: 10, marginTop: 6 }}>{item.when}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RiskScoreCard({ risk, summary }) {
  const color = impactRiskColor(risk.level);
  return (
    <section style={{ background: `linear-gradient(135deg, ${T.surfaceEl}, rgba(248,81,73,0.08))`, border: `1px solid ${risk.level === "Critical" ? T.error : risk.level === "High" ? "rgba(210,153,34,0.55)" : T.border}`, borderRadius: T.r8, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${color} ${summary.riskScore}%, rgba(255,255,255,0.08) 0)`, boxShadow: `0 0 0 1px ${T.border}` }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: T.surface, display: "grid", placeItems: "center", color: T.text, fontFamily: T.mono, fontSize: 18, fontWeight: 700 }}>{summary.riskScore}</div>
        </div>
        <div>
          <div style={{ color, fontSize: 13, fontWeight: 700 }}>{risk.level} Risk</div>
          <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.5 }}>Change touches auth boundaries, API contracts, service clients, and persistence.</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 7, marginTop: 14 }}>
        {risk.reasons.map(reason => <div key={reason} style={{ color: T.dim, fontSize: 12, display: "flex", gap: 8 }}><span style={{ color }}>-</span><span>{reason}</span></div>)}
      </div>
    </section>
  );
}

function ImpactDashboard({ summary }) {
  const cards = [
    ["Risk Score", summary.riskScore, T.warning],
    ["Files Affected", summary.filesAffected, T.info],
    ["Functions Affected", summary.functionsAffected, T.accentBright],
    ["Classes Affected", summary.classesAffected, T.warning],
    ["Services Affected", summary.servicesAffected, "#f771a3"],
    ["API Endpoints", summary.apisAffected, T.error],
    ["Database Tables", summary.databaseTablesAffected, T.success],
    ["Test Coverage", `${summary.estimatedTestCoverage}%`, T.info],
    ["Confidence", `${summary.confidenceScore}%`, T.success]
  ];
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr))", gap: 10 }}>
      {cards.map(([label, value, color]) => (
        <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12 }}>
          <div style={{ color: T.dim, fontSize: 11 }}>{label}</div>
          <div style={{ color, fontSize: 20, fontFamily: T.mono, fontWeight: 700, marginTop: 6 }}>{value}</div>
        </div>
      ))}
    </section>
  );
}

function ImpactNode({ data, selected }) {
  const color = impactRiskColor(data.risk);
  return (
    <div aria-label={`${data.type} impact node ${data.label}`} style={{ minWidth: 178, background: data.depth === 0 ? T.accentSoft : T.surfaceEl, border: `1px solid ${selected ? T.text : data.critical ? T.error : color}`, borderRadius: T.r6, padding: 11, boxShadow: selected ? `0 0 0 3px ${T.accentSoft}` : T.shadow, opacity: data.dimmed ? 0.25 : 1 }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: "none", width: 8, height: 8 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 700, fontFamily: T.mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.label}</div>
          <div style={{ color: T.dim, fontSize: 11 }}>{data.type} - {data.impact}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, marginTop: 9, paddingTop: 8, color: T.faint, fontSize: 10 }}>
        <span>Depth {data.depth}</span>
        <span>{data.dependencyCount} deps</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: "none", width: 8, height: 8 }} />
    </div>
  );
}

const impactNodeTypes = { impact: ImpactNode };

function ImpactEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "2px 6px", color: data?.critical ? T.error : T.dim, fontSize: 10, pointerEvents: "all" }}>{data?.label}</div>
      </EdgeLabelRenderer>
    </>
  );
}

const impactEdgeTypes = { impact: ImpactEdge };

function impactEdgeStyle(edge) {
  const color = edge.critical ? T.error : edge.direct ? T.warning : edge.label === "queries" ? T.success : T.info;
  return { type: "impact", data: { label: edge.label, critical: edge.critical }, markerEnd: { type: MarkerType.ArrowClosed, color }, animated: edge.critical || edge.direct, style: { stroke: color, strokeWidth: edge.critical ? 2.5 : 1.6, strokeDasharray: edge.direct ? "0" : "5 5", opacity: 0.92 } };
}

function ImpactToolbar({ fitView, reset, status, calculate, maxDepth, setMaxDepth }) {
  return (
    <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 7, boxShadow: T.shadow }}>
      <button aria-label="Fit impact graph" onClick={fitView} style={{ border: "none", background: "transparent", color: T.text, cursor: "pointer", fontSize: 12 }}>Fit View</button>
      <button aria-label="Expand dependency depth" onClick={() => setMaxDepth(Math.min(3, maxDepth + 1))} style={{ border: "none", background: "transparent", color: T.text, cursor: "pointer", fontSize: 12 }}>Expand</button>
      <button aria-label="Reset impact graph" onClick={reset} style={{ border: "none", background: "transparent", color: T.text, cursor: "pointer", fontSize: 12 }}>Reset</button>
      <button aria-label="Calculate impact" onClick={calculate} style={{ border: "none", background: T.accentSoft, color: T.accentBright, borderRadius: T.r4, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>{status === "calculating" ? "Calculating..." : "Recalculate"}</button>
      <button aria-label="Export impact report placeholder" onClick={() => {}} style={{ border: "none", background: "transparent", color: T.faint, cursor: "pointer", fontSize: 12 }}>Export PDF</button>
    </div>
  );
}

function BlastRadiusGraph({ nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onPaneClick }) {
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={impactNodeTypes} edgeTypes={impactEdgeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onPaneClick={onPaneClick} fitView theme="dark" attributionPosition="bottom-right">
      <Background color={T.border} gap={22} size={1} />
      <Controls style={{ display: "flex", flexDirection: "column", backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: "hidden" }} />
      <MiniMap nodeColor={node => impactRiskColor(node.data.risk)} style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6 }} maskColor="rgba(0,0,0,0.55)" />
    </ReactFlow>
  );
}

function DependencyPathsPanel({ edges }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 10 }}>Dependency Paths</h3>
      <div style={{ display: "grid", gap: 7 }}>
        {edges.filter(edge => !edge.hidden).slice(0, 6).map(edge => <div key={edge.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: T.dim, fontSize: 12, background: T.surfaceEl, borderRadius: T.r4, padding: "7px 9px" }}><span>{edge.source} {"->"} {edge.target}</span><span style={{ color: edge.data?.critical ? T.error : T.info }}>{edge.data?.label}</span></div>)}
      </div>
    </section>
  );
}

function AffectedComponentsPanel({ components }) {
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Affected Components</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {components.map(group => (
          <details key={group.category} open={["Files", "APIs", "Services"].includes(group.category)} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}>
            <summary style={{ color: T.text, fontSize: 12, cursor: "pointer" }}>{group.category} <span style={{ color: T.faint }}>({group.count})</span></summary>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{group.items.map(item => <div key={item} style={{ color: T.dim, fontSize: 11, fontFamily: T.mono }}>{item}</div>)}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ImpactRecommendationCard({ recommendation }) {
  const color = impactRiskColor(recommendation.level);
  return (
    <div style={{ background: T.surfaceEl, border: `1px solid ${recommendation.level === "High" ? "rgba(210,153,34,0.45)" : T.border}`, borderRadius: T.r6, padding: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><h4 style={{ color: T.text, fontSize: 12 }}>{recommendation.title}</h4><span style={{ color, fontSize: 11 }}>{recommendation.level}</span></div>
      <p style={{ color: T.dim, fontSize: 11, lineHeight: 1.5, marginTop: 6 }}>{recommendation.detail}</p>
    </div>
  );
}

function SuggestedTestsPanel({ tests }) {
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Suggested Tests</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {tests.map(group => (
          <div key={group.category} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 11 }}>
            <div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{group.category}</div>
            <p style={{ color: T.dim, fontSize: 11, lineHeight: 1.5, margin: "5px 0 8px" }}>{group.why}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{group.tests.map(test => <span key={test} style={{ border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "3px 6px", color: T.faint, fontSize: 10, fontFamily: T.mono }}>{test}</span>)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImpactReport({ data }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 8 }}>Impact Report</h3>
      <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.6 }}>
        <div><strong style={{ color: T.text }}>Selected:</strong> {data.selectedComponent}</div>
        <div><strong style={{ color: T.text }}>Risk Score:</strong> {data.riskScore}</div>
        <p style={{ marginTop: 8 }}>{data.summary}</p>
        <div style={{ marginTop: 8, color: T.faint }}>{data.exportStatus}</div>
      </div>
    </section>
  );
}

function ImpactNodeInspector({ node, setActivePage }) {
  if (!node) return (
    <section style={{ padding: 16 }}>
      <div style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 14, textAlign: "center", color: T.dim, fontSize: 12 }}>
        Select a graph node to inspect impact reason, dependency count, risk level, and quick links.
      </div>
    </section>
  );
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Node Inspector</h3>
      <div style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 700, fontFamily: T.mono }}>{node.data.label}</div>
        <div style={{ color: T.dim, fontSize: 12, marginTop: 3 }}>{node.data.type} - {node.data.language}</div>
        <div style={{ color: T.faint, fontSize: 11, marginTop: 10, fontFamily: T.mono }}>{node.data.path}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <StatRow label="Risk" val={node.data.risk} />
          <StatRow label="Deps" val={node.data.dependencyCount} />
        </div>
        <p style={{ color: T.dim, fontSize: 12, lineHeight: 1.5, marginTop: 12 }}>{node.data.reason}</p>
        <p style={{ color: impactRiskColor(node.data.risk), fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>{node.data.action}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <DashButton icon={Icons.file} label="Open File" variant="secondary" onClick={() => {}} />
        <DashButton icon={Icons.deps} label="View Dependency" variant="secondary" onClick={() => setActivePage("deps")} />
        <DashButton icon={Icons.arch} label="View Architecture" variant="secondary" onClick={() => setActivePage("arch")} />
        <DashButton icon={Icons.impact} label="View Analysis" variant="secondary" onClick={() => setActivePage("repo-analysis")} />
      </div>
    </section>
  );
}

function ImpactTimelinePlaceholder({ timeline }) {
  return (
    <section style={{ padding: 16 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Change Timeline</h3>
      <div style={{ display: "grid", gap: 8 }}>{timeline.map(item => <div key={item.title} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}><div style={{ color: T.text, fontSize: 12 }}>{item.title}</div><div style={{ color: T.accentBright, fontSize: 10, marginTop: 4 }}>{item.status}</div><div style={{ color: T.dim, fontSize: 11, lineHeight: 1.5, marginTop: 5 }}>{item.detail}</div></div>)}</div>
    </section>
  );
}

function ImpactLoadingSkeleton() {
  return (
    <div className="impact-layout" style={{ display: "grid", gridTemplateColumns: "300px minmax(620px, 1fr) 360px", height: "calc(100vh - 120px)" }}>
      {[300, 620, 360].map((width, index) => <div key={width} style={{ borderRight: index < 2 ? `1px solid ${T.border}` : "none", background: index === 1 ? T.bg : T.surface, padding: 16 }}><div className="dash-skeleton" style={{ height: index === 1 ? 320 : 44, width: "100%", marginBottom: 14 }} />{[1,2,3,4,5].map(i => <div key={i} className="dash-skeleton" style={{ height: 22, width: `${95 - i * 9}%`, marginBottom: 10 }} />)}</div>)}
    </div>
  );
}

function ImpactEmptyState({ onRun, onRefresh }) {
  return (
    <div style={{ height: "calc(100vh - 120px)", display: "grid", placeItems: "center", textAlign: "center", padding: 40 }}>
      <div style={{ maxWidth: 520 }}><Icons.impact size={42} /><h2 style={{ color: T.text, marginTop: 14 }}>No impact detected.</h2><p style={{ color: T.dim, margin: "8px 0 18px" }}>Select a file, class, function, API, or service to calculate the blast radius.</p><div style={{ display: "flex", justifyContent: "center", gap: 10 }}><DashButton variant="primary" onClick={onRun}>Run Impact Analysis</DashButton><DashButton variant="secondary" onClick={onRefresh}>Refresh</DashButton></div></div>
    </div>
  );
}

function ImpactErrorState({ onRetry }) {
  return (
    <div style={{ height: "calc(100vh - 120px)", display: "grid", placeItems: "center", textAlign: "center", padding: 40 }}>
      <div style={{ maxWidth: 520 }}><Icons.error size={42} stroke={T.error} /><h2 style={{ color: T.text, marginTop: 14 }}>Unable to calculate impact.</h2><p style={{ color: T.dim, margin: "8px 0 18px", lineHeight: 1.5 }}>The dependency index may be stale or incomplete. Refresh the repository analysis and retry the impact calculation.</p><DashButton variant="primary" onClick={onRetry}>Retry</DashButton></div>
    </div>
  );
}

function ImpactAnalysisPage({ setActivePage }) {
  return <ReactFlowProvider><ImpactAnalysisInner setActivePage={setActivePage} /></ReactFlowProvider>;
}

function ImpactAnalysisInner({ setActivePage }) {
  const [status, setStatus] = useState("completed");
  const [selectedTargetId, setSelectedTargetId] = useState(impactMockData.selectedTargetId);
  const [selectedNodeId, setSelectedNodeId] = useState(impactMockData.selectedTargetId);
  const [maxDepth, setMaxDepth] = useState(3);
  const [filters, setFilters] = useState({ search: "", risk: "All", componentType: "All", language: "All", relationship: "All" });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const query = filters.search.toLowerCase();
    const derivedNodes = impactMockData.nodes.map(node => {
      const searchable = [node.data.label, node.data.type, node.data.path, node.data.language, node.data.category].join(" ").toLowerCase();
      const visible = searchable.includes(query) && node.data.depth <= maxDepth && (filters.risk === "All" || node.data.risk === filters.risk) && (filters.componentType === "All" || node.data.type === filters.componentType) && (filters.language === "All" || node.data.language === filters.language);
      const selectedPath = selectedNodeId && impactMockData.edges.some(edge => (edge.source === selectedNodeId && edge.target === node.id) || (edge.target === selectedNodeId && edge.source === node.id));
      return { ...node, data: { ...node.data, critical: impactMockData.criticalPath.includes(node.id), dimmed: selectedNodeId && node.id !== selectedNodeId && !selectedPath && node.data.depth !== 0 }, hidden: !visible };
    });
    const derivedEdges = impactMockData.edges.map(edge => {
      const sourceVisible = derivedNodes.find(node => node.id === edge.source && !node.hidden);
      const targetVisible = derivedNodes.find(node => node.id === edge.target && !node.hidden);
      const relVisible = filters.relationship === "All" || edge.label === filters.relationship;
      return { ...edge, hidden: !(sourceVisible && targetVisible && relVisible && edge.depth <= maxDepth), ...impactEdgeStyle(edge) };
    });
    setNodes(derivedNodes);
    setEdges(derivedEdges);
  }, [filters, maxDepth, selectedNodeId, selectedTargetId, setNodes, setEdges]);

  useEffect(() => {
    setTimeout(() => fitView({ duration: 500, padding: 0.18 }), 60);
  }, [maxDepth, filters, fitView]);

  if (status === "loading" || status === "calculating") return <ImpactLoadingSkeleton />;
  if (status === "no-impact") return <ImpactEmptyState onRun={() => setStatus("calculating")} onRefresh={() => setStatus("completed")} />;
  if (status === "error") return <ImpactErrorState onRetry={() => setStatus("completed")} />;

  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const reset = () => { setFilters({ search: "", risk: "All", componentType: "All", language: "All", relationship: "All" }); setMaxDepth(3); setSelectedNodeId(impactMockData.selectedTargetId); };
  const calculate = () => { setStatus("calculating"); setTimeout(() => setStatus("completed"), 650); };

  return (
    <div className="impact-layout page-in" style={{ display: "grid", gridTemplateColumns: "300px minmax(620px, 1fr) 360px", height: "calc(100vh - 120px)", borderTop: `1px solid ${T.border}`, background: T.bg, overflow: "hidden" }}>
      <aside style={{ background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ color: T.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Change Impact Analysis</div>
          <h2 style={{ color: T.text, fontSize: 18, marginTop: 6 }}>Select Target</h2>
          <p style={{ color: T.dim, fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>Choose a repository, folder, file, class, function, API, or service to estimate blast radius.</p>
        </section>
        <ImpactFilters filters={filters} setFilters={setFilters} maxDepth={maxDepth} setMaxDepth={setMaxDepth} />
        <section style={{ padding: 12, flex: 1 }}>
          <ImpactTargetTree items={impactTargets} selectedTargetId={selectedTargetId} setSelectedTargetId={id => { setSelectedTargetId(id); setSelectedNodeId(impactMockData.selectedTargetId); calculate(); }} />
        </section>
        <ImpactHistoryPanel history={impactHistory} setSelectedTargetId={setSelectedTargetId} />
      </aside>

      <main style={{ position: "relative", minWidth: 0, overflowY: "auto" }}>
        <ImpactToolbar fitView={() => fitView({ duration: 600, padding: 0.18 })} reset={reset} status={status} calculate={calculate} maxDepth={maxDepth} setMaxDepth={setMaxDepth} />
        <div style={{ height: 520, borderBottom: `1px solid ${T.border}` }}>
          <BlastRadiusGraph nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(null)} />
        </div>
        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          <RiskScoreCard risk={impactMockData.risk} summary={impactMockData.summary} />
          <ImpactDashboard summary={impactMockData.summary} />
          <DependencyPathsPanel edges={edges} />
          <ImpactReport data={impactMockData.report} />
        </div>
      </main>

      <aside style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto" }}>
        <ImpactNodeInspector node={selectedNode} setActivePage={setActivePage} />
        <AffectedComponentsPanel components={impactMockData.affectedComponents} />
        <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Safe Refactoring Assistant</h3>
          <div style={{ display: "grid", gap: 10 }}>{impactMockData.recommendations.map(rec => <ImpactRecommendationCard key={rec.title} recommendation={rec} />)}</div>
        </section>
        <SuggestedTestsPanel tests={impactMockData.suggestedTests} />
        <ImpactTimelinePlaceholder timeline={impactMockData.timeline} />
      </aside>
    </div>
  );
}

/* 
   PROMPT 13: GIT INTELLIGENCE
 */

const gitTypeColor = type => type === "Security" ? T.error : type === "Feature" ? T.accentBright : type === "Refactor" ? T.warning : type === "Test" ? T.info : T.dim;

function GitSearch({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></div>
      <input aria-label="Search commit message, author, file, function, branch, or hash" value={value} onChange={e => onChange(e.target.value)} placeholder="Search commits, files, authors..." style={{ width: "100%", padding: "7px 10px 7px 30px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }} />
    </div>
  );
}

function GitFilters({ filters, setFilters }) {
  const field = (key, label, values) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <select aria-label={label} value={filters[key]} onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: "100%", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, padding: "7px 9px", fontSize: 12 }}>
        {values.map(value => <option key={value}>{value}</option>)}
      </select>
    </label>
  );
  return (
    <section style={{ display: "grid", gap: 12, padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ color: T.text, fontSize: 14 }}>Timeline Filters</h3>
        <button aria-label="Reset git filters" onClick={() => setFilters({ search: "", repository: "main-api", branch: "All", author: "All", type: "All", dateRange: "Last 30 days", file: "All" })} style={{ background: "transparent", border: "none", color: T.accentBright, fontSize: 12, cursor: "pointer" }}>Reset</button>
      </div>
      <GitSearch value={filters.search} onChange={value => setFilters(prev => ({ ...prev, search: value }))} />
      {field("repository", "Repository", gitMockData.repositories)}
      {field("branch", "Branch", ["All", ...gitMockData.branches])}
      {field("author", "Author", ["All", ...gitMockData.authors.map(a => a.name)])}
      {field("type", "Commit Type", ["All", "Feature", "Refactor", "Security", "Test", "Fix"])}
      {field("dateRange", "Date Range", ["Last 7 days", "Last 30 days", "Last 90 days", "All time"])}
      {field("file", "File", ["All", ...new Set(gitMockData.commits.flatMap(commit => commit.changedFiles))])}
    </section>
  );
}

function GitStatisticsCards({ stats }) {
  const cards = [
    ["Total Commits", stats.totalCommits],
    ["Contributors", stats.contributors],
    ["Avg Commits / Day", stats.averageCommitsPerDay],
    ["Largest Commit", stats.largestCommit],
    ["Most Active Branch", stats.mostActiveBranch],
    ["Most Modified File", stats.mostModifiedFile],
    ["Oldest File", stats.oldestFile],
    ["Newest File", stats.newestFile]
  ];
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, 1fr))", gap: 10 }}>
      {cards.map(([label, value]) => (
        <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12 }}>
          <div style={{ color: T.dim, fontSize: 11 }}>{label}</div>
          <div style={{ color: T.text, fontSize: 15, fontFamily: T.mono, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
        </div>
      ))}
    </section>
  );
}

function CommitCard({ commit, selected, onSelect }) {
  const color = gitTypeColor(commit.type);
  return (
    <button aria-label={`Select commit ${commit.hash}`} onClick={() => onSelect(commit.hash)} style={{ width: "100%", textAlign: "left", background: selected ? T.accentSoft : T.surface, border: `1px solid ${selected ? T.accentBorder : T.border}`, borderRadius: T.r8, padding: 14, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{commit.message}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, color: T.dim, fontSize: 11 }}>
            <span style={{ fontFamily: T.mono, color: T.accentBright }}>{commit.hash}</span>
            <span>{commit.author}</span>
            <span>{commit.date}</span>
            <span>{commit.branch}</span>
          </div>
        </div>
        <span style={{ color, border: `1px solid ${color}`, borderRadius: T.r4, padding: "3px 7px", fontSize: 11, height: 24 }}>{commit.type}</span>
      </div>
      <p style={{ color: T.dim, fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>{commit.summary}</p>
      <div style={{ display: "flex", gap: 10, color: T.faint, fontSize: 11, marginTop: 12 }}>
        <span>{commit.filesChanged} files</span>
        <span style={{ color: T.success }}>+{commit.insertions}</span>
        <span style={{ color: T.error }}>-{commit.deletions}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>{commit.tags.map(tag => <span key={tag} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "2px 6px", color: T.faint, fontSize: 10 }}>{tag}</span>)}</div>
    </button>
  );
}

function CommitTimeline({ commits, selectedCommitHash, setSelectedCommitHash }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h2 style={{ color: T.text, fontSize: 16, marginBottom: 12 }}>Repository Timeline</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {commits.map(commit => <CommitCard key={commit.hash} commit={commit} selected={selectedCommitHash === commit.hash} onSelect={setSelectedCommitHash} />)}
      </div>
    </section>
  );
}

function GitEvolutionTimeline({ title, items, selectedKey }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>{title}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => (
          <div key={`${title}-${item.commit}-${index}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 10 }}>
            <div style={{ display: "grid", justifyItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: index === items.length - 1 ? T.accentBright : T.faint, marginTop: 4 }} />
              {index < items.length - 1 && <span style={{ width: 1, height: 42, background: T.border }} />}
            </div>
            <div style={{ background: item[selectedKey] ? T.surfaceEl : "transparent", border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{item.state}</span><span style={{ color: T.accentBright, fontSize: 11, fontFamily: T.mono }}>{item.commit}</span></div>
              <div style={{ color: T.dim, fontSize: 11, marginTop: 4 }}>{item.date} - {item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuthorInsights({ authors }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Author Insights</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>
        {authors.map(author => (
          <div key={author.name} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentSoft, color: T.accentBright, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{author.initials}</div>
              <div><div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{author.name}</div><div style={{ color: T.dim, fontSize: 11 }}>{author.commits} commits - {author.filesModified} files</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "end", gap: 3, height: 34, marginTop: 12 }}>{author.timeline.map((value, i) => <span key={i} style={{ width: 10, height: Math.max(6, value), background: T.accentBright, opacity: 0.45 + i * 0.06, borderRadius: 2 }} />)}</div>
            <div style={{ color: T.faint, fontSize: 10, marginTop: 9 }}>{author.activeAreas.join(", ")}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, color: T.faint, fontSize: 11 }}>Contribution heatmap placeholder.</div>
    </section>
  );
}

function HotspotCards({ hotspots }) {
  const group = (title, items) => (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 10 }}>{title}</h3>
      <div style={{ display: "grid", gap: 8 }}>{items.map(item => <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: T.surfaceEl, borderRadius: T.r4, padding: "7px 9px", fontSize: 12 }}><span style={{ color: T.dim, fontFamily: T.mono }}>{item.name}</span><span style={{ color: item.risk === "High" ? T.warning : T.success }}>{item.changes} changes</span></div>)}</div>
    </div>
  );
  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {group("Most Changed Files", hotspots.mostChangedFiles)}
      {group("Stable Areas", hotspots.leastChangedFiles)}
      <div style={{ gridColumn: "1 / -1", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
        <h3 style={{ color: T.text, fontSize: 14, marginBottom: 10 }}>Recently Active Modules</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{hotspots.recentlyActiveModules.map(module => <span key={module} style={{ background: T.accentSoft, border: `1px solid ${T.accentBorder}`, borderRadius: T.r4, padding: "4px 8px", color: T.accentBright, fontSize: 11 }}>{module}</span>)}</div>
      </div>
    </section>
  );
}

function RelatedChangesPanel({ relatedChanges }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Related Changes</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10 }}>
        {relatedChanges.map(change => <div key={change.title} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 11 }}><div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{change.title}</div><div style={{ color: T.info, fontSize: 10, marginTop: 4 }}>{change.type} - {change.confidence}% confidence</div><div style={{ display: "grid", gap: 4, marginTop: 8 }}>{change.items.map(item => <span key={item} style={{ color: T.dim, fontSize: 11, fontFamily: T.mono }}>{item}</span>)}</div></div>)}
      </div>
    </section>
  );
}

function ReplayTimeline({ replay, replayIndex, setReplayIndex }) {
  const point = replay[replayIndex];
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}><h3 style={{ color: T.text, fontSize: 14 }}>Visual Commit Replay</h3><span style={{ color: T.accentBright, fontSize: 11, fontFamily: T.mono }}>{point.hash}</span></div>
      <input aria-label="Move between commits" type="range" min="0" max={replay.length - 1} value={replayIndex} onChange={e => setReplayIndex(Number(e.target.value))} style={{ width: "100%" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
        <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 10 }}><div style={{ color: T.text, fontSize: 12 }}>{point.label}</div><div style={{ color: T.faint, fontSize: 11, marginTop: 4 }}>Future file diff visualization placeholder.</div></div>
        {["files", "functions", "modules"].map(key => <div key={key} style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 10 }}><div style={{ color: T.dim, fontSize: 10, textTransform: "uppercase" }}>{key}</div><div style={{ color: T.text, fontSize: 18, fontFamily: T.mono, marginTop: 4 }}>{point[key]}</div></div>)}
      </div>
    </section>
  );
}

function CommitDetailsPanel({ commit }) {
  if (!commit) return null;
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Commit Details</h3>
      <div style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{commit.message}</div>
        <div style={{ color: T.accentBright, fontFamily: T.mono, fontSize: 12, marginTop: 6 }}>{commit.hash}</div>
        <div style={{ color: T.dim, fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>Author: {commit.author}<br />Date: {commit.date}<br />Parent: {commit.parent}<br />Issue: {commit.relatedIssue}<br />PR: {commit.relatedPR}</div>
      </div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <GitDetailList title="Changed Files" items={commit.changedFiles} />
        <GitDetailList title="Changed Functions" items={commit.changedFunctions} />
        <GitDetailList title="Changed Classes" items={commit.changedClasses.length ? commit.changedClasses : ["No classes changed"]} />
      </div>
    </section>
  );
}

function GitDetailList({ title, items }) {
  return <div><div style={{ color: T.dim, fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>{title}</div><div style={{ display: "grid", gap: 5 }}>{items.map(item => <div key={item} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "6px 8px", color: T.text, fontSize: 11, fontFamily: T.mono }}>{item}</div>)}</div></div>;
}

function GitAuthorDetails({ commit }) {
  const author = gitMockData.authors.find(item => item.name === commit?.author);
  if (!author) return null;
  return (
    <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Author Details</h3>
      <div style={{ display: "flex", gap: 10, alignItems: "center", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.accentSoft, color: T.accentBright, display: "grid", placeItems: "center", fontWeight: 700 }}>{author.initials}</div>
        <div><div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{author.name}</div><div style={{ color: T.dim, fontSize: 11 }}>{author.commits} commits - {author.filesModified} files modified</div></div>
      </div>
    </section>
  );
}

function GitFuturePanel({ future }) {
  return (
    <section style={{ padding: 16 }}>
      <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Future Integrations</h3>
      <div style={{ display: "grid", gap: 8 }}>{future.map(item => <div key={item} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10 }}><div style={{ color: T.text, fontSize: 12 }}>{item}</div><div style={{ color: T.faint, fontSize: 10, marginTop: 4 }}>Future feature placeholder.</div></div>)}</div>
    </section>
  );
}

function GitLoadingSkeleton() {
  return <div className="git-layout" style={{ display: "grid", gridTemplateColumns: "300px minmax(650px, 1fr) 360px", height: "calc(100vh - 120px)" }}>{[300,650,360].map((width, index) => <div key={width} style={{ background: index === 1 ? T.bg : T.surface, borderRight: index < 2 ? `1px solid ${T.border}` : "none", padding: 16 }}><div className="dash-skeleton" style={{ height: index === 1 ? 300 : 42, marginBottom: 14 }} />{[1,2,3,4,5].map(i => <div key={i} className="dash-skeleton" style={{ height: 20, width: `${92 - i * 8}%`, marginBottom: 10 }} />)}</div>)}</div>;
}

function GitEmptyState({ onRefresh }) {
  return <div style={{ height: "calc(100vh - 120px)", display: "grid", placeItems: "center", textAlign: "center", padding: 40 }}><div><Icons.git size={42} /><h2 style={{ color: T.text, marginTop: 14 }}>No Git history available.</h2><p style={{ color: T.dim, margin: "8px 0 18px" }}>Connect a Git repository or refresh repository analysis to load commit intelligence.</p><DashButton variant="primary" onClick={onRefresh}>Refresh</DashButton></div></div>;
}

function GitErrorState({ onRetry }) {
  return <div style={{ height: "calc(100vh - 120px)", display: "grid", placeItems: "center", textAlign: "center", padding: 40 }}><div><Icons.error size={42} stroke={T.error} /><h2 style={{ color: T.text, marginTop: 14 }}>Unable to load Git intelligence.</h2><p style={{ color: T.dim, margin: "8px 0 18px" }}>The repository history index may be stale or unavailable. Retry after reconnecting Git metadata.</p><DashButton variant="primary" onClick={onRetry}>Retry</DashButton></div></div>;
}

function GitIntelligencePage() {
  const [status, setStatus] = useState("ready");
  const [filters, setFilters] = useState({ search: "", repository: "main-api", branch: "All", author: "All", type: "All", dateRange: "Last 30 days", file: "All" });
  const [selectedCommitHash, setSelectedCommitHash] = useState(gitMockData.commits[0].hash);
  const [replayIndex, setReplayIndex] = useState(gitMockData.replay.length - 1);

  if (status === "loading") return <GitLoadingSkeleton />;
  if (status === "empty") return <GitEmptyState onRefresh={() => setStatus("ready")} />;
  if (status === "error") return <GitErrorState onRetry={() => setStatus("ready")} />;

  const query = filters.search.toLowerCase();
  const filteredCommits = gitMockData.commits.filter(commit => {
    const searchable = [commit.message, commit.author, commit.hash, commit.branch, commit.type, ...commit.changedFiles, ...commit.changedFunctions].join(" ").toLowerCase();
    return searchable.includes(query) && (filters.branch === "All" || commit.branch === filters.branch) && (filters.author === "All" || commit.author === filters.author) && (filters.type === "All" || commit.type === filters.type) && (filters.file === "All" || commit.changedFiles.includes(filters.file));
  });
  const selectedCommit = gitMockData.commits.find(commit => commit.hash === selectedCommitHash) || filteredCommits[0] || gitMockData.commits[0];

  return (
    <div className="git-layout page-in" style={{ display: "grid", gridTemplateColumns: "300px minmax(650px, 1fr) 360px", height: "calc(100vh - 120px)", borderTop: `1px solid ${T.border}`, background: T.bg, overflow: "hidden" }}>
      <aside style={{ background: T.surface, borderRight: `1px solid ${T.border}`, overflowY: "auto" }}>
        <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ color: T.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Git Intelligence</div>
          <h2 style={{ color: T.text, fontSize: 18, marginTop: 6 }}>Repository Evolution</h2>
          <p style={{ color: T.dim, fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>Trace who changed code, why it changed, and which files evolve together.</p>
        </section>
        <GitFilters filters={filters} setFilters={setFilters} />
      </aside>
      <main style={{ minWidth: 0, overflowY: "auto", padding: 16, display: "grid", gap: 14 }}>
        <GitStatisticsCards stats={gitMockData.stats} />
        <CommitTimeline commits={filteredCommits} selectedCommitHash={selectedCommit.hash} setSelectedCommitHash={setSelectedCommitHash} />
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <GitEvolutionTimeline title="File Evolution" items={gitMockData.fileEvolution} selectedKey="file" />
          <GitEvolutionTimeline title="Function Evolution" items={gitMockData.functionEvolution} selectedKey="fn" />
        </section>
        <AuthorInsights authors={gitMockData.authors} />
        <HotspotCards hotspots={gitMockData.hotspots} />
        <RelatedChangesPanel relatedChanges={gitMockData.relatedChanges} />
        <ReplayTimeline replay={gitMockData.replay} replayIndex={replayIndex} setReplayIndex={setReplayIndex} />
      </main>
      <aside style={{ background: T.surface, borderLeft: `1px solid ${T.border}`, overflowY: "auto" }}>
        <CommitDetailsPanel commit={selectedCommit} />
        <GitAuthorDetails commit={selectedCommit} />
        <section style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ color: T.text, fontSize: 14, marginBottom: 12 }}>Related Commits</h3>
          <div style={{ display: "grid", gap: 8 }}>{gitMockData.commits.filter(commit => commit.hash !== selectedCommit.hash).slice(0, 3).map(commit => <button key={commit.hash} onClick={() => setSelectedCommitHash(commit.hash)} style={{ textAlign: "left", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 10, cursor: "pointer" }}><div style={{ color: T.text, fontSize: 12 }}>{commit.message}</div><div style={{ color: T.accentBright, fontSize: 10, fontFamily: T.mono, marginTop: 4 }}>{commit.hash}</div></button>)}</div>
        </section>
        <GitFuturePanel future={gitMockData.future} />
      </aside>
    </div>
  );
}

/*  */

function PageStub({ pageId, setActivePage }) {
  if (pageId === "arch") return <ArchitectureExplorerPage setActivePage={setActivePage} />;
  if (pageId === "deps") return <DependencyIntelligencePage setActivePage={setActivePage} />;
  if (pageId === "impact") return <ImpactAnalysisPage setActivePage={setActivePage} />;
  if (pageId === "git") return <GitIntelligencePage setActivePage={setActivePage} />;
  if (pageId === "dashboard") return <DashboardPage setActivePage={setActivePage} />;
  if (pageId === "projects") return <ProjectsPage setActivePage={setActivePage} />;
  if (pageId === "repos")    return <RepositoriesPage setActivePage={setActivePage} />;
  if (pageId === "repo-overview") return <RepoOverviewPage setActivePage={setActivePage} />;
  if (pageId === "repo-explorer") return <RepoExplorerPage setActivePage={setActivePage} />;
  if (pageId === "repo-analysis") return <RepoAnalysisPage setActivePage={setActivePage} />;
  if (pageId === "knowledge-graph") return <KnowledgeGraphPage setActivePage={setActivePage} />;
  
  const meta = PAGE_META[pageId] || { label: "Page", breadcrumb: [pageId] };
  return (
    <div className="page-in" style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: "-0.03em", marginBottom: 6 }}>{meta.label}</h1>
        <p style={{ fontSize: 13, color: T.faint }}>This page content will be built in a future prompt.</p>
      </div>
      {/* Skeleton cards to show layout works */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 20, height: 110 }}>
            <div style={{ width: "60%", height: 10, background: T.surfaceHov, borderRadius: T.r4, marginBottom: 10 }} />
            <div style={{ width: "40%", height: 8, background: T.surfaceHov, borderRadius: T.r4, marginBottom: 8 }} />
            <div style={{ width: "80%", height: 8, background: T.surfaceEl, borderRadius: T.r4 }} />
          </div>
        ))}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 24, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 13, color: T.faint, fontFamily: T.mono }}>// {meta.label.toLowerCase().replace(/ /g, "_")}_widget  coming in next prompt</span>
      </div>
    </div>
  );
}

/*  MOBILE SIDEBAR OVERLAY  */
function MobileSidebarOverlay({ open, setOpen, activePage, setActivePage }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", animation: "fadeIn 0.15s ease" }} onClick={() => setOpen(false)} />
      <div style={{ position: "relative", width: 240, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100%", animation: "fadeUp 0.2s ease" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", padding: "0 14px", borderBottom: `1px solid ${T.border}`, gap: 8 }}>
          <Icons.logoSm />
          <span style={{ fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: "-0.01em", fontFamily: T.sans }}>CodeScope</span>
          <button onClick={() => setOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.faint, display: "flex" }}><Icons.x /></button>
        </div>
        <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
          {NAV_ITEMS.map((item, i) =>
            item === null
              ? <div key={`d-${i}`} style={{ height: 1, background: T.border, margin: "6px 4px" }} />
              : <SidebarItem key={item.id} item={item} collapsed={false} active={activePage} onClick={(id) => { setActivePage(id); setOpen(false); }} />
          )}
        </nav>
      </div>
    </div>
  );
}

/*  APP LAYOUT  */
function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = PAGE_META[activePage] || {};

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: T.bg }}>
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} activePage={activePage} setActivePage={setActivePage} />

      {/* Mobile sidebar */}
      <MobileSidebarOverlay open={mobileOpen} setOpen={setMobileOpen} activePage={activePage} setActivePage={setActivePage} />

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Mobile menu button */}
        <div className="sidebar-mobile-visible" style={{ display: "none", position: "absolute", top: 12, left: 12, zIndex: 30 }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 8, cursor: "pointer", color: T.faint, display: "flex" }}>
            <Icons.menu />
          </button>
        </div>

        <TopNav breadcrumb={meta.breadcrumb || ["Dashboard"]} setActivePage={setActivePage} />

        {/* Scrollable content */}
        <main
          id="main-content"
          tabIndex={-1}
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}
        >
          <PageStub pageId={activePage} setActivePage={setActivePage} />
        </main>
      </div>
    </div>
  );
}


/* 
   PROMPT 10: DEPENDENCY INTELLIGENCE EXPLORER
 */

/* 
   PROMPT 10: DEPENDENCY INTELLIGENCE EXPLORER
 */

const getDepEdgeStyle = (label, selectedNodeId, source, target) => {
  let color = T.dim;
  let strokeDasharray = "0";
  let animated = false;

  if (label === "imports" || label === "read by" || label === "configures") { color = T.warning; strokeDasharray = "5 5"; }
  if (label === "calls" || label === "routes to") { color = T.info; animated = true; }
  if (label === "depends on") { color = T.error; strokeDasharray = "2 4"; }
  if (label === "queries") { color = T.success; animated = true; }
  if (label === "uses") { color = T.accentBright; }
  if (label === "extends" || label === "implements") { color = "#71f7a3"; strokeDasharray = "6 2"; }
  if (label === "references") { color = "#f771a3"; strokeDasharray = "2 2"; }

  let opacity = 1;
  if (selectedNodeId) {
    if (source !== selectedNodeId && target !== selectedNodeId) {
      opacity = 0.15;
    } else {
      color = T.text;
      if (source === selectedNodeId) color = T.info; 
      if (target === selectedNodeId) color = T.warning; 
    }
  }

  return { style: { stroke: color, strokeDasharray, opacity, strokeWidth: selectedNodeId ? 2 : 1 }, animated };
};

const CustomDepNode = ({ data, selected }) => {
  let bgColor = T.surfaceEl;
  let borderColor = T.border;
  let icon = Icons.file;
  
  if (data.type === "Service" || data.type === "API Endpoint") { borderColor = "#f771a3"; icon = Icons.arch; }
  if (data.type === "Class") { bgColor = "#1e1e24"; borderColor = T.warning; }
  if (data.type === "Function") { bgColor = "#1a221d"; borderColor = T.success; }
  if (data.type === "Database Table") { bgColor = "#2d1b1b"; borderColor = T.error; icon = Icons.database; }
  if (data.type === "Module" || data.type === "Package") { borderColor = T.info; icon = Icons.gridView; }
  if (data.type === "Configuration File") { borderColor = "#a371f7"; icon = Icons.settings; }
  if (data.type === "Environment Variable") { bgColor = "#261a29"; borderColor = "#a371f7"; icon = Icons.arch; }
  if (data.type === "Repository") { borderColor = T.accent; icon = Icons.repos; }
  if (data.type === "Folder") { icon = Icons.archive; }

  const riskColor = data.risk === "Critical" ? T.error : data.risk === "High" ? T.warning : data.risk === "Medium" ? T.info : T.success;

  return (
    <div 
      aria-label={`${data.type} node: ${data.label}`}
      style={{
      padding: "10px 14px",
      background: bgColor,
      border: `1px solid ${selected ? T.text : borderColor}`,
      borderRadius: T.r6,
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 160,
      boxShadow: selected ? `0 0 0 2px ${T.accentSoft}` : T.shadow,
      transition: "all 0.2s ease",
      opacity: data.hidden ? 0.2 : 1
    }}>
      <Handle type="target" position={Position.Top} style={{ background: T.faint, border: "none", width: 8, height: 8 }} />
      <div style={{ color: selected ? T.text : T.faint }}>
        <icon.type {...icon.props} size={16} />
      </div>
      <div style={{ flex: 1 }}>
        {!data.hideLabel && <div style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: T.mono }}>{data.label}</div>}
        <div style={{ fontSize: 11, color: T.dim }}>{data.type}</div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor }} title={`Risk: ${data.risk}`} />
      <Handle type="source" position={Position.Bottom} style={{ background: T.faint, border: "none", width: 8, height: 8 }} />
    </div>
  );
};

const depNodeTypes = { customDep: CustomDepNode };

/*  SUBCOMPONENTS  */

function DependencyTree({ items, depth = 0 }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
      <h3 style={{ fontSize: 12, fontWeight: 500, color: T.dim, marginBottom: 8, paddingLeft: 8, textTransform: "uppercase" }}>Dependency Tree</h3>
      {items.map(root => (
        <DependencyTreeItem key={root.id} item={root} depth={depth} />
      ))}
    </div>
  );
}

function DependencyTreeItem({ item, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <button 
        aria-label={`Toggle ${item.name}`}
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: hasChildren ? "pointer" : "default", borderRadius: T.r4, background: "transparent", border: "none", width: "100%", textAlign: "left" }}
        onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center", color: T.faint }}>
          {hasChildren ? (expanded ? <Icons.chevronDown size={14}/> : <Icons.chevronRight size={14}/>) : <span style={{width: 14}}/>}
        </div>
        <Icons.file size={14} color={T.dim} />
        <span style={{ fontSize: 13, color: T.text, fontFamily: T.mono }}>{item.name}</span>
        <span style={{ fontSize: 11, color: T.faint }}>{item.type}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {item.children.map(child => <DependencyTreeItem key={child.id} item={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function DependencySearch({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 10, top: 8, color: T.faint }}><Icons.search size={14} /></div>
      <input
        aria-label="Search by function, class, file, module, package, or API"
        type="text"
        placeholder="Search function, class, file..."
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "6px 12px 6px 30px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.text, fontSize: 13, outline: "none" }}
      />
    </div>
  );
}

function DependencyFilters({ filters, setFilters }) {
  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
      <h3 style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 12 }}>Filters</h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <DependencySearch value={filters.search} onChange={search => setFilters({ ...filters, search })} />

        <div>
          <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Relationship Type</div>
          <select aria-label="Relationship Type" value={filters.rel} onChange={e => setFilters({...filters, rel: e.target.value})} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
            <option value="All">All Relationships</option>
            <option value="imports">Imports / Imported By</option>
            <option value="calls">Calls / Called By</option>
            <option value="uses">Uses / Used By</option>
            <option value="depends on">Depends On</option>
            <option value="extends">Extends / Implements</option>
            <option value="references">References</option>
          </select>
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Risk Level</div>
          <select aria-label="Risk Level" value={filters.risk} onChange={e => setFilters({...filters, risk: e.target.value})} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
            <option value="All">All Risks</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <div>
          <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Language</div>
          <select aria-label="Language" value={filters.lang} onChange={e => setFilters({...filters, lang: e.target.value})} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
            <option value="All">All Languages</option>
            <option value="TypeScript">TypeScript</option>
            <option value="Go">Go</option>
            <option value="Java">Java</option>
            <option value="SQL">SQL</option>
          </select>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Module</div>
            <select aria-label="Module" value={filters.module} onChange={e => setFilters({...filters, module: e.target.value})} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
              <option value="All">All</option>
              <option value="Auth">Auth</option>
              <option value="Billing">Billing</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 4, fontSize: 11, color: T.dim }}>Depth</div>
            <select aria-label="Depth" value={filters.depth} onChange={e => setFilters({...filters, depth: e.target.value})} style={{ width: "100%", padding: "6px", background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.text, fontSize: 12, outline: "none" }}>
              <option value="All">Infinite</option>
              <option value="1">1 Level</option>
              <option value="2">2 Levels</option>
              <option value="3">3 Levels</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}

function DependencyLegend() {
  return (
    <div style={{ position: "absolute", left: 16, bottom: 16, zIndex: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 12, boxShadow: T.shadow, display: "grid", gap: 8, minWidth: 190 }}>
      <div style={{ fontSize: 11, color: T.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Legend</div>
      {[
        ["Repository / Folder", T.accent],
        ["File / Module / Package", T.info],
        ["Class / Function", T.warning],
        ["Service / API", "#f771a3"],
        ["Data / Config / Env", T.error],
      ].map(([label, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 11, color: T.dim }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function DependencyToolbar({ showLabels, setShowLabels, resetFocus, fitView }) {
  return (
    <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "6px 8px", boxShadow: T.shadow }}>
      <button aria-label="Toggle Labels" onClick={() => setShowLabels(!showLabels)} style={{ padding: "4px 8px", background: "none", color: showLabels ? T.text : T.dim, border: "none", cursor: "pointer", fontSize: 12 }}>
        {showLabels ? "Hide Labels" : "Show Labels"}
      </button>
      <div style={{ width: 1, background: T.border }}></div>
      <button aria-label="Reset Focus" onClick={resetFocus} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>
        Reset Focus
      </button>
      <div style={{ width: 1, background: T.border }}></div>
      <button aria-label="Center View" onClick={fitView} style={{ padding: "4px 8px", background: "none", color: T.text, border: "none", cursor: "pointer", fontSize: 12 }}>
        Center View
      </button>
    </div>
  );
}

function RiskIndicator({ risk }) {
  const color = risk === 'Critical' ? T.error : risk === 'High' ? T.warning : risk === 'Medium' ? T.info : T.success;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <Icons.alertTriangle size={16} color={color} />
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Blast Radius: {risk} Risk</span>
    </div>
  );
}

function BlastRadiusPanel({ node }) {
  return (
    <div style={{ background: node.data.risk === 'Critical' ? "rgba(248,81,73,0.1)" : node.data.risk === 'High' ? "rgba(210,153,34,0.1)" : T.surfaceEl, border: `1px solid ${node.data.risk === 'Critical' ? T.error : node.data.risk === 'High' ? T.warning : T.border}`, borderRadius: T.r6, padding: 16, marginBottom: 24 }}>
      <RiskIndicator risk={node.data.risk} />
      
      <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5, marginBottom: 16 }}>
        {node.data.risk === 'Critical' ? "Modifying this will cause sweeping, potentially dangerous downstream effects across multiple domain boundaries." : 
         node.data.risk === 'High' ? "Modifying this affects major subsystems and requires deep architectural review." :
         node.data.risk === 'Medium' ? "Modifying this affects localized components. Ensure unit tests pass." :
         "Modifying this has minimal isolated impact. Safe to refactor."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{node.data.files}</div>
          <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Files</div>
        </div>
        <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{node.data.functions}</div>
          <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Funcs</div>
        </div>
        <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{node.data.classes}</div>
          <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Classes</div>
        </div>
        <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{node.data.modules}</div>
          <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Modules</div>
        </div>
        <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{node.data.apis}</div>
          <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>APIs</div>
        </div>
        <div style={{ background: T.surface, padding: "6px", borderRadius: T.r4, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: T.text, fontFamily: T.mono }}>{node.data.services}</div>
          <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase" }}>Services</div>
        </div>
      </div>
    </div>
  );
}

function NodeInspector({ node, edges, nodes }) {
  if (!node) return null;
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: T.r6, background: T.surfaceEl, display: "flex", alignItems: "center", justifyContent: "center", color: T.text }}>
          <Icons.arch size={18} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.mono }}>{node.data.label}</div>
          <div style={{ fontSize: 12, color: T.dim }}>{node.data.type} &middot; {node.data.lang}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase" }}>Location</div>
      <div style={{ background: T.surfaceEl, borderRadius: T.r6, padding: 12, marginBottom: 24, fontSize: 12, color: T.text, fontFamily: T.mono }}>
        {node.data.loc}
        <div style={{ fontSize: 10, color: T.faint, fontFamily: T.sans, marginTop: 4 }}>Last updated: {node.data.updated}</div>
      </div>

      <BlastRadiusPanel node={node} />
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        <DashButton icon={Icons.search} label="Open File" variant="secondary" onClick={() => {}} />
        <DashButton icon={Icons.arch} label="View Arch" variant="secondary" onClick={() => {}} />
        <DashButton icon={Icons.gitBranch} label="View Graph" variant="secondary" onClick={() => {}} />
        <DashButton icon={Icons.impact} label="Full Analysis" variant="secondary" onClick={() => {}} />
      </div>

      <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Depended On By (Incoming: {node.data.fanIn})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {edges.filter(e => e.target === node.id).map(e => {
          const other = nodes.find(n => n.id === e.source);
          if(!other) return null;
          return (
            <div key={e.id} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{other.data.label}</div>
              <div style={{ fontSize: 10, color: T.warning }}>{e.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: T.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Depends On (Outgoing: {node.data.fanOut})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {edges.filter(e => e.source === node.id).map(e => {
          const other = nodes.find(n => n.id === e.target);
          if(!other) return null;
          return (
            <div key={e.id} style={{ background: T.surfaceEl, borderRadius: T.r4, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 10, color: T.info }}>{e.label}</div>
              <div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{other.data.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatisticsPanel() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 16 }}>Repository Statistics</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <StatRow label="Total Dependencies" val="9,642" />
        <StatRow label="Circular Dependencies" val="12" />
        <StatRow label="SCCs (Strongly Connected)" val="3" />
        <StatRow label="Highest Fan-In" val="Logger (8)" />
        <StatRow label="Highest Fan-Out" val="UserService (2)" />
        <StatRow label="Most Referenced File" val="config.json" />
        <StatRow label="Most Referenced Function" val="formatDate" />
      </div>
      <div style={{ marginTop: 40, textAlign: "center", color: T.faint, fontSize: 13, padding: 20, background: T.surfaceEl, borderRadius: T.r6 }}>
        <Icons.arch size={24} style={{ marginBottom: 12, opacity: 0.5 }} />
        <br/>
        Select a node to inspect its blast radius and specific dependency paths.
      </div>
    </div>
  );
}

function DependencyLoadingState() {
  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <div className="dependency-layout" style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr) 340px", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 280, borderRight: `1px solid ${T.border}`, background: T.surface, padding: 16 }}>
          <div className="skeleton-pulse" style={{ height: 24, width: "60%", background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} />
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-pulse" style={{ height: 16, width: `${90 - i*10}%`, background: T.surfaceEl, borderRadius: T.r4, marginBottom: 12, marginLeft: i*10 }} />)}
        </div>
        <div style={{ flex: 1, position: "relative", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GraphLoadingState />
        </div>
        <div style={{ width: 340, borderLeft: `1px solid ${T.border}`, background: T.surface, padding: 20 }}>
          <div className="skeleton-pulse" style={{ height: 36, width: "80%", background: T.surfaceEl, borderRadius: T.r4, marginBottom: 24 }} />
          <div className="skeleton-pulse" style={{ height: 120, width: "100%", background: T.surfaceEl, borderRadius: T.r6, marginBottom: 24 }} />
          <div className="skeleton-pulse" style={{ height: 60, width: "100%", background: T.surfaceEl, borderRadius: T.r6, marginBottom: 12 }} />
          <div className="skeleton-pulse" style={{ height: 60, width: "100%", background: T.surfaceEl, borderRadius: T.r6 }} />
        </div>
      </div>
    </div>
  );
}

/*  MAIN COMPONENT  */

function LoadingSkeleton() {
  return <DependencyLoadingState />;
}

function EmptyState({ onRun, onRefresh }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{ width: 64, height: 64, background: T.surfaceEl, borderRadius: T.r8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: T.faint }}>
          <Icons.deps size={24} />
        </div>
        <h2 style={{ fontSize: 18, color: T.text, marginBottom: 12 }}>No dependency data available.</h2>
        <p style={{ color: T.dim, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          Run repository analysis to index imports, calls, references, and downstream dependency paths before inspecting blast radius.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <DashButton icon={Icons.arch} label="Run Analysis" variant="primary" onClick={onRun} />
          <DashButton icon={Icons.upload} label="Refresh" variant="secondary" onClick={onRefresh} />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{ width: 64, height: 64, background: "rgba(248,81,73,0.1)", borderRadius: T.r8, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: T.error }}>
          <Icons.error size={24} />
        </div>
        <h2 style={{ fontSize: 18, color: T.text, marginBottom: 12 }}>Unable to load dependency graph.</h2>
        <p style={{ color: T.dim, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          The dependency index may be stale or the graph service may have failed while resolving deep import and call paths. Retry after refreshing the analysis data.
        </p>
        <DashButton icon={Icons.upload} label="Retry" variant="primary" onClick={onRetry} />
      </div>
    </div>
  );
}

function DependencyGraph({ nodes, edges, onNodesChange, onEdgesChange, onNodeClick, onPaneClick }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={depNodeTypes}
      fitView
      attributionPosition="bottom-right"
      theme="dark"
    >
      <Background color={T.border} gap={20} size={1} />
      <Controls style={{ display: 'flex', flexDirection: 'column', backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, overflow: 'hidden' }} />
      <MiniMap
        nodeColor={n => n.data.risk === 'Critical' ? T.error : n.data.risk === 'High' ? T.warning : T.surfaceEl}
        style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6 }}
        maskColor="rgba(0,0,0,0.5)"
      />
    </ReactFlow>
  );
}

function DependencyIntelligencePage({ setActivePage }) {
  const [status, setStatus] = useState("success"); // loading, success, error, empty
  
  if (status === "loading" || status === "running") return <LoadingSkeleton />;
  if (status === "empty") return <EmptyState onRun={() => setStatus("running")} onRefresh={() => setStatus("success")} />;
  if (status === "error") return <ErrorState onRetry={() => setStatus("success")} />;

  return (
    <ReactFlowProvider>
      <DependencyIntelligenceInner />
    </ReactFlowProvider>
  );
}

function DependencyIntelligenceInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  const [filters, setFilters] = useState({ search: "", rel: "All", lang: "All", risk: "All", module: "All", depth: "All" });
  const [showLabels, setShowLabels] = useState(true);
  
  const { fitView } = useReactFlow();

  useEffect(() => {
    const filteredNodes = dependencyMockData.nodes.map(node => {
      const matchSearch = node.data.label.toLowerCase().includes(filters.search.toLowerCase());
      const matchLang = filters.lang === "All" || node.data.lang === filters.lang;
      const matchRisk = filters.risk === "All" || node.data.risk === filters.risk;
      const isVisible = matchSearch && matchLang && matchRisk;
      
      return {
        ...node,
        data: { ...node.data, hidden: !isVisible, hideLabel: !showLabels }
      };
    });

    const filteredEdges = dependencyMockData.edges.map(edge => {
      const matchRel = filters.rel === "All" || edge.label === filters.rel;
      
      const sourceVisible = filteredNodes.find(n => n.id === edge.source && !n.data.hidden);
      const targetVisible = filteredNodes.find(n => n.id === edge.target && !n.data.hidden);
      const isVisible = matchRel && sourceVisible && targetVisible;

      const edgeStyleProps = getDepEdgeStyle(edge.label, selectedNodeId, edge.source, edge.target);

      return {
        ...edge,
        type: "smoothstep",
        hidden: !isVisible,
        ...edgeStyleProps
      };
    });

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [filters, showLabels, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 50);
  }, [filters, showLabels, fitView]);

  const onNodeClick = (_, node) => setSelectedNodeId(node.id);
  const onPaneClick = () => setSelectedNodeId(null);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left Sidebar - Dependency Tree & Filters */}
        <div style={{ width: 280, borderRight: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column" }}>
          <DependencyFilters filters={filters} setFilters={setFilters} />
          <DependencyTree items={dependencyTree} />
        </div>

        {/* Center Canvas */}
        <div style={{ minWidth: 0, position: "relative", background: T.bg }}>
          <DependencyToolbar 
            showLabels={showLabels} 
            setShowLabels={setShowLabels} 
            resetFocus={() => { setFilters({ search: "", rel: "All", lang: "All", risk: "All", module: "All", depth: "All" }); setSelectedNodeId(null); }} 
            fitView={() => fitView({ duration: 800, padding: 0.2 })} 
          />

          <DependencyGraph
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
          />
          <DependencyLegend />
        </div>

        {/* Right Sidebar - Inspector Panel */}
        <div className="dependency-inspector" style={{ width: 340, borderLeft: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {selectedNode ? <NodeInspector node={selectedNode} edges={edges} nodes={nodes} /> : <StatisticsPanel />}
        </div>
      </div>
    </div>
  );
}

/*  */

/* 
   ROOT ROUTER
 */
export default function CodeScopeApp({ initialScreen = "app" }) {
  const [screen, setScreen] = useState(initialScreen); // login | register | forgot | reset | app

  const nav = (dest) => setScreen(dest);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {screen === "login"    && <LoginPage    nav={nav} />}
      {screen === "register" && <RegisterPage nav={nav} />}
      {screen === "forgot"   && <ForgotPage   nav={nav} />}
      {screen === "reset"    && <ResetPage    nav={nav} />}
      {screen === "app"      && <AppLayout />}
    </>
  );
}
