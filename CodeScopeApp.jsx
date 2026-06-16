import { useState, useEffect, useRef, createContext, useContext } from "react";

/* ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
   Dark shell: near-black base, subtle zinc surfaces, single teal accent.
   Typography: Inter for UI, JetBrains Mono for code/data moments.
   Mirrors the landing page accent (#2B5C52) but on a dark ground.
──────────────────────────────────────────────────────────────────────────── */
const T = {
  /* Backgrounds */
  bg:        "#0D0E0F",   /* page base — near-black with warm undertone */
  surface:   "#141516",   /* sidebar, cards */
  surfaceEl: "#1A1B1D",   /* elevated panels */
  surfaceHov:"#1F2022",   /* hover state */

  /* Borders */
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.11)",

  /* Text */
  text:      "#F0EFEC",   /* primary */
  dim:       "rgba(240,239,236,0.60)",
  faint:     "rgba(240,239,236,0.35)",

  /* Accent — deep teal from landing, brightened for dark bg */
  accent:    "#3D8B7A",
  accentBright: "#4EADA0",
  accentSoft:"rgba(61,139,122,0.12)",
  accentBorder:"rgba(61,139,122,0.30)",

  /* Semantic */
  success:   "#3FB950",
  warning:   "#D29922",
  error:     "#F85149",
  info:      "#58A6FF",

  /* Type */
  sans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:  "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",

  /* Radius */
  r4:  "4px",
  r6:  "6px",
  r8:  "8px",
  r12: "12px",

  /* Shadow */
  shadow:    "0 4px 24px rgba(0,0,0,0.5)",
  shadowLg:  "0 8px 48px rgba(0,0,0,0.65)",
};

/* ─── APP CONTEXT ────────────────────────────────────────────────────────── */
const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

/* ─── ICONS (inline SVG, no dependency) ─────────────────────────────────── */
const Icon = ({ d, size = 16, stroke = T.faint, fill = "none", strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  logo: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="18" height="18" rx="4" stroke={T.accent} strokeWidth="1.2"/>
      <path d="M5 10h10M10 5v10" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  logoSm: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="18" height="18" rx="4" stroke={T.accent} strokeWidth="1.2"/>
      <path d="M5 10h10M10 5v10" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  dashboard:    () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  projects:     () => <Icon d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  repos:        () => <Icon d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  arch:         () => <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  deps:         () => <Icon d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
  git:          () => <Icon d="M18 3a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3zM6 21a3 3 0 0 0 3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3zM6 3a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="none" />,
  impact:       () => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  error:        () => <Icon d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
  ai:           () => <Icon d="M12 8V4H8M12 8h4M12 8v4M8 12H4v4h4v-4zM20 12h-4v4h4v-4zM8 4H4v4h4V4zM20 4h-4v4h4V4z" />,
  settings:     () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  logout:       () => <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  search:       () => <Icon d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />,
  bell:         () => <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
  chevronDown:  () => <Icon d="M6 9l6 6 6-6" />,
  chevronRight: () => <Icon d="M9 18l6-6-6-6" />,
  menu:         () => <Icon d="M3 12h18M3 6h18M3 18h18" />,
  eye:          () => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  eyeOff:       () => <Icon d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />,
  github:       () => <Icon d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  google:       () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill={T.dim} />
    </svg>
  ),
  check:        () => <Icon d="M20 6L9 17l-5-5" stroke={T.success} />,
  workspace:    () => <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  repo:         () => <Icon d="M3 3h18v18H3zM9 3v18M3 9h6M3 15h6" />,
  user:         () => <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  sun:          () => <Icon d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z" />,
  moon:         () => <Icon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  x:            () => <Icon d="M18 6L6 18M6 6l12 12" />,
};

/* ─── KEYFRAMES ──────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${T.bg}; color: ${T.text}; font-family: ${T.sans}; height: 100%; }
  ::selection { background: ${T.accentSoft}; }
  :focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; border-radius: 4px; }
  input, button { font-family: inherit; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  @keyframes pulseGreen { 0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,0.4)} 50%{box-shadow:0 0 0 6px rgba(63,185,80,0)} }
  @keyframes shimmer { 100% { transform: translateX(100%); } }
  @keyframes progressSweep { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
  .sidebar-item { transition: background 0.12s, color 0.12s; }
  .sidebar-item:hover { background: ${T.surfaceHov} !important; color: ${T.text} !important; }
  .sidebar-item.active { background: ${T.accentSoft} !important; color: ${T.accentBright} !important; }
  .nav-dropdown { animation: fadeUp 0.18s ease; }
  .auth-card { animation: fadeUp 0.4s ease; }
  .page-in { animation: fadeIn 0.25s ease; }
  .dash-card { transition: border-color 0.16s ease, transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease; }
  .dash-card:hover { transform: translateY(-2px); border-color: ${T.borderMid} !important; box-shadow: 0 12px 36px rgba(0,0,0,0.24); }
  .dash-grid-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .dash-priority-grid { display: grid; grid-template-columns: minmax(260px, 1.2fr) repeat(3, minmax(170px, 1fr)); gap: 12px; }
  .dash-grid-main { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr); gap: 16px; align-items: start; }
  .dash-grid-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .dash-skeleton { position: relative; overflow: hidden; background: ${T.surfaceEl}; border-radius: 6px; }
  .dash-skeleton::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: shimmer 1.35s infinite; }
  .dash-progress-fill { background-size: 220% 100%; animation: progressSweep 2.8s linear infinite; }
  @media (max-width: 1180px) {
    .dash-grid-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dash-priority-grid, .dash-grid-main, .dash-grid-three { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .dash-page { padding: 24px 16px !important; }
    .dash-grid-stats { grid-template-columns: 1fr; }
    .dash-filter-row { grid-template-columns: 1fr !important; }
    .dash-header-actions { width: 100%; justify-content: stretch !important; }
    .dash-header-actions button { flex: 1; }
  }
  @media (max-width: 900px) {
    .sidebar-desktop { display: none !important; }
    .sidebar-mobile-visible { display: flex !important; }
  }
  @media (min-width: 901px) {
    .sidebar-mobile-visible { display: none !important; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   AUTHENTICATION
═══════════════════════════════════════════════════════════════════════════ */

/* ─── Input ──────────────────────────────────────────────────────────────── */
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

/* ─── AuthBtn ────────────────────────────────────────────────────────────── */
function AuthBtn({ children, onClick, loading, disabled, variant = "primary" }) {
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
      onClick={onClick}
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

/* ─── AuthShell ──────────────────────────────────────────────────────────── */
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

/* ─── AuthDivider ────────────────────────────────────────────────────────── */
function AuthDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      <span style={{ fontSize: 12, color: T.faint }}>or</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

/* ─── LOGIN ──────────────────────────────────────────────────────────────── */
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

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => nav("app"), 800);
    }, 1400);
  };

  if (success) {
    return (
      <AuthShell title="Welcome back" subtitle="Signing you in…">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(63,185,80,0.12)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGreen 1.5s ease infinite" }}>
            <Icons.check />
          </div>
          <p style={{ fontSize: 14, color: T.dim }}>Redirecting to dashboard…</p>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" error={errors.email} autoFocus />
        <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={errors.password} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: T.dim }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: T.accent, width: 13, height: 13 }} />
            Remember me
          </label>
          <button onClick={() => nav("forgot")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Forgot password?</button>
        </div>

        <AuthBtn onClick={handleSubmit} loading={loading}>Sign in</AuthBtn>
      </div>

      <p style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 20 }}>
        No account?{" "}
        <button onClick={() => nav("register")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Create one</button>
      </p>
    </AuthShell>
  );
}

/* ─── REGISTER ───────────────────────────────────────────────────────────── */
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

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    setTimeout(() => { setLoading(false); nav("login"); }, 1400);
  };

  return (
    <AuthShell title="Create account" subtitle="Start understanding your codebase">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="Full name" value={form.name} onChange={set("name")} placeholder="Arjun Mehta" error={errors.name} autoFocus />
        <AuthInput label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" error={errors.email} />
        <AuthInput label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" error={errors.password} />
        <AuthInput label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter password" error={errors.confirm} />
        <AuthBtn onClick={handleSubmit} loading={loading}>Create account</AuthBtn>
      </div>
      <p style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 20 }}>
        Already have an account?{" "}
        <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Sign in</button>
      </p>
    </AuthShell>
  );
}

/* ─── FORGOT PASSWORD ────────────────────────────────────────────────────── */
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
            <span style={{ color: T.accentBright, fontSize: 20 }}>✓</span>
          </div>
          <p style={{ fontSize: 14, color: T.dim, textAlign: "center" }}>Check your inbox — a reset link is on its way.</p>
          <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.accent }}>Back to sign in</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" error={error} autoFocus />
          <AuthBtn onClick={handleSubmit} loading={loading}>Send reset link</AuthBtn>
          <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.faint, textAlign: "center" }}>← Back to sign in</button>
        </div>
      )}
    </AuthShell>
  );
}

/* ─── RESET PASSWORD ─────────────────────────────────────────────────────── */
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <AuthInput label="New password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" error={errors.password} autoFocus />
        <AuthInput label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" error={errors.confirm} />
        <AuthBtn onClick={handleSubmit} loading={loading}>Reset password</AuthBtn>
      </div>
    </AuthShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP SHELL
═══════════════════════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { id: "dashboard",    label: "Dashboard",           Icon: Icons.dashboard,   group: "main" },
  { id: "projects",     label: "Projects",            Icon: Icons.projects,    group: "main" },
  { id: "repos",        label: "Repositories",        Icon: Icons.repos,       group: "main" },
  null, /* divider */
  { id: "arch",         label: "Architecture",        Icon: Icons.arch,        group: "explore" },
  { id: "deps",         label: "Dependencies",        Icon: Icons.deps,        group: "explore" },
  { id: "git",          label: "Git Intelligence",    Icon: Icons.git,         group: "explore" },
  { id: "impact",       label: "Impact Analysis",     Icon: Icons.impact,      group: "explore" },
  { id: "errors",       label: "Error Investigation", Icon: Icons.error,       group: "explore" },
  null,
  { id: "ai",           label: "AI Assistant",        Icon: Icons.ai,          group: "tools" },
  { id: "settings",     label: "Settings",            Icon: Icons.settings,    group: "tools" },
];

/* ─── SidebarItem ────────────────────────────────────────────────────────── */
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

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
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

/* ─── Breadcrumb ─────────────────────────────────────────────────────────── */
function Breadcrumb({ trail }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {trail.map((crumb, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: T.faint, fontSize: 12, marginTop: 1 }}><Icons.chevronRight /></span>}
          <span style={{
            fontSize: 13, color: i === trail.length - 1 ? T.text : T.faint,
            fontWeight: i === trail.length - 1 ? 500 : 400,
            cursor: i < trail.length - 1 ? "pointer" : "default",
          }}>{crumb}</span>
        </span>
      ))}
    </nav>
  );
}

/* ─── GlobalSearch ───────────────────────────────────────────────────────── */
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
        <span style={{ fontSize: 13, flex: 1, textAlign: "left" }}>Search…</span>
        <span style={{ fontSize: 11, fontFamily: T.mono, background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, padding: "1px 6px", color: T.faint }}>⌘K</span>
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
                placeholder="Search files, functions, services…"
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
                  <span style={{ fontFamily: T.mono, fontSize: 11 }}>›</span> {r}
                </button>
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12 }}>
              {[["↩","select"],["↑↓","navigate"],["esc","close"]].map(([k,v]) => (
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

/* ─── TopNav ─────────────────────────────────────────────────────────────── */
function TopNav({ breadcrumb, sidebarCollapsed }) {
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
        <Breadcrumb trail={breadcrumb} />
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
            {[["Impact alert: PaymentService", "3 services at risk · 2m ago", T.warning],
              ["Analysis complete: auth-gateway", "0 breaking changes · 18m ago", T.success]].map(([t, s, c]) => (
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

/* ─── PAGE CONTENT STUBS ─────────────────────────────────────────────────── */
const PAGE_META = {
  dashboard:  { label: "Dashboard",           breadcrumb: ["Dashboard"] },
  projects:   { label: "Projects",            breadcrumb: ["Dashboard", "Projects"] },
  repos:      { label: "Repositories",        breadcrumb: ["Dashboard", "Repositories"] },
  arch:       { label: "Architecture",        breadcrumb: ["Dashboard", "Architecture Explorer"] },
  deps:       { label: "Dependencies",        breadcrumb: ["Dashboard", "Dependency Explorer"] },
  git:        { label: "Git Intelligence",    breadcrumb: ["Dashboard", "Git Intelligence"] },
  impact:     { label: "Impact Analysis",     breadcrumb: ["Dashboard", "Impact Analysis"] },
  errors:     { label: "Error Investigation", breadcrumb: ["Dashboard", "Error Investigation"] },
  ai:         { label: "AI Assistant",        breadcrumb: ["Dashboard", "AI Assistant"] },
  settings:   { label: "Settings",            breadcrumb: ["Dashboard", "Settings"] },
};

const dashboardData = {
  user: "Arjun",
  workspace: "Northstar Platform",
  stats: [
    ["Projects", "12", "+2 this week", T.success],
    ["Repositories", "48", "+6 connected", T.success],
    ["Files Analyzed", "128.4k", "+18%", T.success],
    ["Functions Indexed", "42,817", "+3,204", T.success],
    ["Dependencies Found", "9,642", "+411", T.info],
    ["Architecture Graphs", "34", "+5 generated", T.success],
    ["Analyses Completed", "216", "+24 today", T.success],
    ["Avg. Repository Health", "86%", "-3 pts", T.warning],
  ],
  repos: [
    { name: "main-api", language: "TypeScript", branch: "main", status: "Attention", last: "12 min ago", score: 74, risk: "Medium", color: T.warning },
    { name: "payments-service", language: "Go", branch: "release/2.4", status: "Healthy", last: "38 min ago", score: 92, risk: "Low", color: T.success },
    { name: "auth-gateway", language: "Java", branch: "main", status: "Critical path", last: "1 hr ago", score: 61, risk: "High", color: T.error },
  ],
  activity: [
    ["Repository Uploaded", "frontend-platform", "2 min ago", Icons.repos],
    ["Analysis Completed", "payments-service", "18 min ago", Icons.check],
    ["Dependency Graph Generated", "main-api", "44 min ago", Icons.deps],
    ["Architecture Updated", "auth-gateway", "1 hr ago", Icons.arch],
    ["Project Created", "mobile-suite", "3 hr ago", Icons.projects],
    ["Future AI Analysis Placeholder", "search-indexer", "Soon", Icons.ai],
  ],
  recent: [
    ["main-api", "Today, 4:18 PM", "TypeScript", 72],
    ["auth-gateway", "Today, 2:03 PM", "Java", 58],
    ["data-pipeline", "Yesterday", "Python", 91],
  ],
  queue: [
    { repo: "frontend-platform", progress: 68, eta: "4 min", step: "Parsing Code" },
    { repo: "search-indexer", progress: 42, eta: "9 min", step: "Scanning Files" },
  ],
  languages: [
    ["Python", 28, "#58A6FF"],
    ["TypeScript", 24, T.accentBright],
    ["JavaScript", 17, "#D29922"],
    ["Go", 13, "#79C0FF"],
    ["Java", 11, "#F0883E"],
    ["Rust", 7, "#F85149"],
  ],
  risks: [
    ["Critical Repositories", "3", T.error],
    ["Medium Risk", "9", T.warning],
    ["Healthy Projects", "18", T.success],
    ["Pending Analysis", "7", T.info],
  ],
  favorites: [
    ["payments-service", "92% health"],
    ["main-api", "3 queued tasks"],
    ["frontend-platform", "analysis running"],
  ],
};

function DashButton({ children, variant = "ghost", onClick, title }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        minHeight: 34, padding: "8px 12px", borderRadius: T.r6, cursor: "pointer",
        border: `1px solid ${isPrimary ? T.accentBorder : T.border}`,
        background: isPrimary ? T.accent : T.surfaceEl,
        color: isPrimary ? "#fff" : T.dim, fontSize: 12, fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children, color = T.dim }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px",
      borderRadius: T.r12, border: `1px solid ${color}55`, background: `${color}16`,
      color, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function ProgressBar({ value, color = T.accentBright, animated = false }) {
  return (
    <div aria-label={`${value}% complete`} style={{ height: 7, borderRadius: 999, background: T.bg, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <div
        className={animated ? "dash-progress-fill" : ""}
        style={{
          width: `${value}%`, height: "100%", borderRadius: 999,
          background: animated
            ? `linear-gradient(90deg, ${color}, ${T.accentBright}, ${color})`
            : color,
        }}
      />
    </div>
  );
}

function WidgetShell({ title, children, action, loading, empty, error }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className="dash-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, overflow: "hidden" }}>
      <div style={{ minHeight: 48, padding: "12px 14px", borderBottom: collapsed ? "none" : `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: "-0.01em", flex: 1 }}>{title}</h2>
        {action}
        <button aria-label={`Refresh ${title}`} title="Refresh" style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", display: "flex", padding: 5 }}><Icons.git /></button>
        <button aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} title={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed(c => !c)} style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", display: "flex", padding: 5 }}>
          {collapsed ? <Icons.chevronRight /> : <Icons.chevronDown />}
        </button>
      </div>
      {!collapsed && (
        <div style={{ padding: 14 }}>
          {loading ? <WidgetLoading /> : error ? <WidgetError /> : empty ? <WidgetEmpty /> : children}
        </div>
      )}
    </section>
  );
}

function WidgetLoading() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="dash-skeleton" style={{ height: 16, width: "45%" }} />
      <div className="dash-skeleton" style={{ height: 86 }} />
      <div className="dash-skeleton" style={{ height: 12, width: "70%" }} />
    </div>
  );
}

function WidgetEmpty() {
  return (
    <div style={{ minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: T.faint, fontSize: 13 }}>
      No projects yet. Create a project or upload a repository to begin.
    </div>
  );
}

function WidgetError() {
  return (
    <div style={{ minHeight: 130, display: "grid", placeItems: "center", gap: 10, color: T.faint, textAlign: "center" }}>
      <div>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Unable to load dashboard.</div>
        <div style={{ fontSize: 12 }}>Check the workspace connection and try again.</div>
      </div>
      <DashButton><Icons.git />Retry</DashButton>
    </div>
  );
}

function MetricCard({ label, value, trend, color }) {
  return (
    <div className="dash-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16, minHeight: 112 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: T.faint }}>{label}</span>
        <Pill color={color}>{trend}</Pill>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 26, color: T.text, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

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

function ProjectsPage() {
  // --- Simulation States ---
  const [viewState, setViewState] = useState("loaded"); // loaded | loading | empty | error
  
  // --- Workspaces ---
  const [workspaces, setWorkspaces] = useState([
    { id: "ws-1", name: "Northstar Platform", avatar: "NP", members: ["AM", "SK", "JL", "TR"], projectCount: 5 },
    { id: "ws-2", name: "Alpha Core Labs", avatar: "AC", members: ["AM", "JL"], projectCount: 3 },
    { id: "ws-3", name: "Personal Experiments", avatar: "PE", members: ["AM"], projectCount: 1 }
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("ws-1");
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  
  const [projects, setProjects] = useState([
    {
      id: "p-1",
      workspaceId: "ws-1",
      name: "Core Gateway API",
      description: "Codebase analyzer edge routing, gateway token verification, and reverse proxy definitions.",
      owner: "Arjun Mehta",
      createdDate: "2026-02-14",
      repositoryCount: 3,
      repoHealths: [90, 85, 92], // health breakdown for sub-repositories
      lastAnalysis: "12 min ago",
      healthScore: 89,
      favorite: true,
      icon: "🌐",
      color: "#3D8B7A",
      visibility: "Private"
    },
    {
      id: "p-2",
      workspaceId: "ws-1",
      name: "Checkout Integration",
      description: "Stripe and Adyen webhooks orchestrator, checkout workflows, and user subscription mapping.",
      owner: "Sarah Kim",
      createdDate: "2026-03-01",
      repositoryCount: 2,
      repoHealths: [94, 90],
      lastAnalysis: "45 min ago",
      healthScore: 92,
      favorite: true,
      icon: "💳",
      color: "#58A6FF",
      visibility: "Private"
    },
    {
      id: "p-3",
      workspaceId: "ws-1",
      name: "User Authentication Gateway",
      description: "Multi-tenant auth services, OAuth2 wrappers, security key protocols, and session stores.",
      owner: "Julian Lee",
      createdDate: "2026-01-20",
      repositoryCount: 4,
      repoHealths: [50, 72, 60, 62],
      lastAnalysis: "1 hr ago",
      healthScore: 61,
      favorite: false,
      icon: "🔒",
      color: "#F85149",
      visibility: "Internal"
    },
    {
      id: "p-4",
      workspaceId: "ws-1",
      name: "ML Processing Pipelines",
      description: "Data preparation scripts, feature maps generator, PyTorch service templates, and export utilities.",
      owner: "Arjun Mehta",
      createdDate: "2026-04-10",
      repositoryCount: 5,
      repoHealths: [88, 80, 82, 85, 85],
      lastAnalysis: "Yesterday",
      healthScore: 84,
      favorite: false,
      icon: "🧠",
      color: "#D29922",
      visibility: "Private"
    },
    {
      id: "p-5",
      workspaceId: "ws-1",
      name: "Developer Documentation Hub",
      description: "Astro-based documentation site generated automatically from backend type definitions.",
      owner: "Tanya Ray",
      createdDate: "2026-05-18",
      repositoryCount: 1,
      repoHealths: [97],
      lastAnalysis: "3 days ago",
      healthScore: 97,
      favorite: false,
      icon: "📝",
      color: "#79C0FF",
      visibility: "Public"
    },
    
    // Workspace 2 Projects
    {
      id: "p-6",
      workspaceId: "ws-2",
      name: "Alpha Compute Infrastructure",
      description: "Kubernetes config, Helm templates, Terraform modules, and environment manifests.",
      owner: "Julian Lee",
      createdDate: "2026-05-01",
      repositoryCount: 6,
      repoHealths: [95, 96, 92, 94, 93, 95],
      lastAnalysis: "2 hrs ago",
      healthScore: 94,
      favorite: true,
      icon: "🛡️",
      color: "#3D8B7A",
      visibility: "Private"
    },
    {
      id: "p-7",
      workspaceId: "ws-2",
      name: "Alpha Analytics Service",
      description: "Telemetry ingestion handlers, Clickhouse schema migration tools, and dashboard APIs.",
      owner: "Arjun Mehta",
      createdDate: "2026-05-12",
      repositoryCount: 2,
      repoHealths: [74, 82],
      lastAnalysis: "1 day ago",
      healthScore: 78,
      favorite: false,
      icon: "📊",
      color: "#D29922",
      visibility: "Private"
    },
    {
      id: "p-8",
      workspaceId: "ws-2",
      name: "Billing Adapter V2",
      description: "Internal ledger microservice syncing transaction states with invoice engines.",
      owner: "Arjun Mehta",
      createdDate: "2026-06-02",
      repositoryCount: 1,
      repoHealths: [100],
      lastAnalysis: "Never",
      healthScore: 100,
      favorite: false,
      icon: "⚡",
      color: "#F85149",
      visibility: "Internal"
    },

    // Workspace 3 Projects
    {
      id: "p-9",
      workspaceId: "ws-3",
      name: "My Indie Projects Repo",
      description: "Playground for experiments, helper scripts, and boilerplate templates.",
      owner: "Arjun Mehta",
      createdDate: "2026-01-01",
      repositoryCount: 12,
      repoHealths: [80, 82, 85, 81, 84, 82, 80, 83, 82, 85, 80, 82],
      lastAnalysis: "1 week ago",
      healthScore: 82,
      favorite: true,
      icon: "🏠",
      color: "#3D8B7A",
      visibility: "Private"
    }
  ]);

  // --- Filtering & Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | healthy | warning | critical
  const [filterRepoCount, setFilterRepoCount] = useState("all"); // all | single | multiple
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [sortBy, setSortBy] = useState("recent"); // recent | name | health

  // --- Keyboard Shortcuts Search Box ---
  const searchInputRef = useRef(null);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Create Project Modal Form ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState("form"); // form | loading | success
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formIcon, setFormIcon] = useState("🌐");
  const [formColor, setFormColor] = useState("#3D8B7A");
  const [formVisibility, setFormVisibility] = useState("Private");
  const [formErrors, setFormErrors] = useState({});

  // --- Card Action Menu ---
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const clickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  // --- Workspace Switch helper ---
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // --- Calculations ---
  const activeWorkspaceProjects = projects.filter(p => p.workspaceId === activeWorkspaceId);

  const filteredProjects = activeWorkspaceProjects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (filterStatus === "healthy") matchesStatus = p.healthScore >= 85;
    else if (filterStatus === "warning") matchesStatus = p.healthScore >= 70 && p.healthScore < 85;
    else if (filterStatus === "critical") matchesStatus = p.healthScore < 70;

    let matchesRepo = true;
    if (filterRepoCount === "single") matchesRepo = p.repositoryCount <= 1;
    else if (filterRepoCount === "multiple") matchesRepo = p.repositoryCount > 1;

    const matchesFav = filterFavorite ? p.favorite === true : true;

    return matchesSearch && matchesStatus && matchesRepo && matchesFav;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "health") return b.healthScore - a.healthScore;
    return 1; // default fallback keeps creation order/recent
  });

  const totalWorkspaceRepos = activeWorkspaceProjects.reduce((acc, p) => acc + p.repositoryCount, 0);
  const avgHealth = Math.round(activeWorkspaceProjects.reduce((acc, p) => acc + p.healthScore, 0) / (activeWorkspaceProjects.length || 1));
  const indexedDepsCount = activeWorkspaceProjects.reduce((acc, p) => acc + p.repositoryCount * 187, 0);

  // --- Actions ---
  const handleToggleFavorite = (projId) => {
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, favorite: !p.favorite } : p));
  };

  const handleDuplicateProject = (proj) => {
    const newProj = {
      ...proj,
      id: "p-" + Date.now(),
      name: `${proj.name} (Copy)`,
      createdDate: new Date().toISOString().split("T")[0],
      favorite: false
    };
    setProjects(prev => [...prev, newProj]);
    setActiveMenuId(null);
  };

  const handleDeleteProject = (projId) => {
    if (confirm("Are you sure you want to delete this project? All meta histories will be lost.")) {
      setProjects(prev => prev.filter(p => p.id !== projId));
    }
    setActiveMenuId(null);
  };

  const handleCreateWorkspace = (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    const newId = "ws-" + Date.now();
    const newWs = {
      id: newId,
      name: newWsName,
      avatar: newWsName.substring(0, 2).toUpperCase(),
      members: ["AM"],
      projectCount: 0
    };
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newId);
    setNewWsName("");
    setIsCreateWsOpen(false);
  };

  const handleCreateProjectSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!formName.trim()) errors.name = "Project name is required.";
    else if (formName.length < 3) errors.name = "Name must be at least 3 characters.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setModalStep("loading");

    // Simulate database / indexing latency
    setTimeout(() => {
      const newProjObj = {
        id: "p-" + Date.now(),
        workspaceId: activeWorkspaceId,
        name: formName,
        description: formDesc || "No description provided.",
        owner: "Arjun Mehta",
        createdDate: new Date().toISOString().split("T")[0],
        repositoryCount: 0,
        repoHealths: [],
        lastAnalysis: "Never",
        healthScore: 100,
        favorite: false,
        icon: formIcon,
        color: formColor,
        visibility: formVisibility
      };

      setProjects(prev => [newProjObj, ...prev]);
      setModalStep("success");
    }, 1500);
  };

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormIcon("🌐");
    setFormColor("#3D8B7A");
    setFormVisibility("Private");
    setFormErrors({});
    setModalStep("form");
    setIsModalOpen(false);
  };

  // --- Dynamic State Overrides ---
  const simulateLoading = viewState === "loading";
  const simulateError = viewState === "error";
  const simulateEmpty = viewState === "empty" || activeWorkspaceProjects.length === 0;

  return (
    <div className="page-in" style={{ padding: "24px 32px 64px", maxWidth: 1480, margin: "0 auto" }}>
      
      {/* Simulation Controller Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24, padding: "8px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: T.faint, fontSize: 11, fontFamily: T.mono }}>PREVIEW STATE CONTROL:</span>
          {["loaded", "loading", "empty", "error"].map(state => (
            <button key={state} onClick={() => setViewState(state)} style={{
              background: viewState === state ? T.accentSoft : "transparent",
              color: viewState === state ? T.accentBright : T.faint,
              border: `1px solid ${viewState === state ? T.accentBorder : "transparent"}`,
              borderRadius: T.r4,
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              textTransform: "capitalize",
            }}>{state}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.faint, fontFamily: T.mono }}>
          CodeScope AI Workspace Orchestrator v1.4
        </div>
      </div>

      {/* --- HEADER SECTION --- */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.accentBright, textTransform: "uppercase", letterSpacing: "0.05em" }}>Workspaces</span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: T.faint }} />
            <span style={{ fontSize: 12, color: T.faint }}>Project Directory</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            {/* Workspace Avatar */}
            <div style={{ width: 32, height: 32, borderRadius: T.r8, background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: T.accentBright, fontSize: 14 }}>
              {activeWorkspace.avatar}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
                  {activeWorkspace.name}
                </h1>

                {/* Pulsing Active Syncing Indicator */}
                <span 
                  title="Workspace syncing with VCS provider"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    background: "rgba(63,185,80,0.12)",
                    border: `1px solid ${T.success}33`,
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.success
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.success, animation: "pulseGreen 1.5s infinite" }} />
                  Live Sync
                </span>

                {/* Dropdown Toggle */}
                <button 
                  onClick={() => setWsDropdownOpen(prev => !prev)}
                  style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, color: T.dim, borderRadius: T.r6, padding: 6, display: "flex", cursor: "pointer" }}
                  aria-label="Switch workspace"
                >
                  <Icons.chevronDown />
                </button>
              </div>
            </div>

            {/* Switch Workspace Dropdown */}
            {wsDropdownOpen && (
              <div className="nav-dropdown" style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: T.r8, padding: 8, width: 260, boxShadow: T.shadowLg, zIndex: 100 }}>
                <p style={{ fontSize: 11, color: T.faint, padding: "4px 8px" }}>Select Workspace</p>
                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setWsDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: T.r6,
                      background: activeWorkspaceId === ws.id ? T.accentSoft : "transparent",
                      border: "none",
                      color: activeWorkspaceId === ws.id ? T.accentBright : T.dim,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                    onMouseEnter={e => { if (activeWorkspaceId !== ws.id) e.currentTarget.style.background = T.surfaceHov; }}
                    onMouseLeave={e => { if (activeWorkspaceId !== ws.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: T.r4, background: activeWorkspaceId === ws.id ? T.accentBorder : T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                      {ws.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{ws.name}</div>
                      <div style={{ fontSize: 10, color: T.faint }}>{ws.members.length} members · {projects.filter(p => p.workspaceId === ws.id).length} projects</div>
                    </div>
                    {activeWorkspaceId === ws.id && <span style={{ color: T.accentBright }}>✓</span>}
                  </button>
                ))}

                <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
                
                {isCreateWsOpen ? (
                  <form onSubmit={handleCreateWorkspace} style={{ padding: "4px 8px" }}>
                    <input 
                      type="text"
                      placeholder="Workspace name..."
                      value={newWsName}
                      onChange={e => setNewWsName(e.target.value)}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, color: T.text, fontSize: 12, padding: "5px 8px", outline: "none", marginBottom: 6 }}
                    />
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="submit" style={{ flex: 1, background: T.accent, border: "none", borderRadius: T.r4, color: "#fff", fontSize: 11, padding: "4px 0", cursor: "pointer" }}>Create</button>
                      <button type="button" onClick={() => setIsCreateWsOpen(false)} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r4, color: T.dim, fontSize: 11, padding: "4px 0", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button 
                    onClick={() => setIsCreateWsOpen(true)}
                    style={{ width: "100%", background: "none", border: "none", padding: "8px 10px", borderRadius: T.r6, cursor: "pointer", color: T.accentBright, fontSize: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span>+</span> Create New Workspace
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Workspace Members Avatars */}
          <div style={{ display: "flex", alignItems: "center", marginRight: 8 }}>
            {activeWorkspace.members.map((m, idx) => (
              <div 
                key={m} 
                title={`${m} (Collaborator)`}
                style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: "50%", 
                  background: T.surfaceEl, 
                  border: `2px solid ${T.bg}`, 
                  color: T.dim, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 10, 
                  fontWeight: 600,
                  marginLeft: idx === 0 ? 0 : -8,
                  zIndex: 10 - idx
                }}
              >
                {m}
              </div>
            ))}
            <button 
              title="Invite Members"
              style={{ width: 28, height: 28, borderRadius: "50%", background: T.surfaceEl, border: `2px solid ${T.bg}`, color: T.faint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginLeft: -8, zIndex: 0, cursor: "pointer" }}
            >
              +
            </button>
          </div>

          <DashButton onClick={() => alert("Workspace settings are configuration placeholders.")}>
            <Icons.settings /> Settings
          </DashButton>

          <DashButton variant="primary" onClick={() => { setIsModalOpen(true); setModalStep("form"); }}>
            <span>+</span> Create Project
          </DashButton>
        </div>
      </header>

      {/* --- ERROR STATE PANEL --- */}
      {simulateError && (
        <div style={{ background: `${T.error}0a`, border: `1px solid ${T.error}40`, borderRadius: T.r8, padding: "40px 24px", textAlign: "center", marginBottom: 32 }}>
          <div style={{ color: T.error, fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontSize: 16, fontWeight: 650, color: T.text, marginBottom: 8 }}>Failed to retrieve projects list</h3>
          <p style={{ fontSize: 13, color: T.dim, maxWidth: 480, margin: "0 auto 20px" }}>
            The API endpoint timed out while querying workspace databases. Ensure your organization billing is active and try again.
          </p>
          <DashButton onClick={() => setViewState("loaded")} variant="primary">
            Retry Connection
          </DashButton>
        </div>
      )}

      {/* --- STATISTICS PANELS --- */}
      {!simulateError && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          {simulateLoading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="dash-skeleton" style={{ height: 100, borderRadius: T.r8 }} />
            ))
          ) : (
            <>
              <MetricCard label="Total Projects" value={simulateEmpty ? 0 : activeWorkspaceProjects.length} trend="Active Scope" color={T.accentBright} />
              <MetricCard label="Repositories Connected" value={simulateEmpty ? 0 : totalWorkspaceRepos} trend="Syncing" color={T.info} />
              <MetricCard label="Workspace Avg Health" value={simulateEmpty ? "—" : `${avgHealth}%`} trend={avgHealth >= 80 ? "Optimal" : "Attention"} color={avgHealth >= 80 ? T.success : T.warning} />
              <MetricCard label="Dependencies Indexed" value={simulateEmpty ? 0 : indexedDepsCount.toLocaleString()} trend="Indexed" color={T.accentBright} />
              <MetricCard label="Architecture Graphs" value={simulateEmpty ? 0 : activeWorkspaceProjects.length * 2} trend="Calculated" color={T.info} />
              <MetricCard label="Last Workspace Activity" value={simulateEmpty ? "Never" : "12 min ago"} trend="Syncing live" color={T.success} />
            </>
          )}
        </section>
      )}

      {/* --- SEARCH & FILTERS CONTROLS --- */}
      {!simulateError && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16, marginBottom: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
            {/* Search Input */}
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
                <Icons.search />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search projects by name or keywords... (Press Ctrl + F to focus)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  background: T.bg,
                  border: `1px solid ${T.borderMid}`,
                  borderRadius: T.r6,
                  color: T.text,
                  padding: "0 100px 0 38px",
                  fontSize: 13,
                  outline: "none"
                }}
              />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontFamily: T.mono, color: T.faint, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "2px 6px" }}>
                Ctrl + F
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button 
                onClick={() => setFilterFavorite(prev => !prev)}
                style={{
                  height: 40,
                  padding: "0 16px",
                  background: filterFavorite ? T.accentSoft : T.surfaceEl,
                  border: `1px solid ${filterFavorite ? T.accentBorder : T.border}`,
                  borderRadius: T.r6,
                  color: filterFavorite ? T.accentBright : T.dim,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                ★ Favorites Only
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            {/* Filter selectors */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: T.faint }}>Health Status:</span>
                <select 
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "5px 10px", fontSize: 12, outline: "none", cursor: "pointer" }}
                >
                  <option value="all">All Health Scores</option>
                  <option value="healthy">Healthy (&gt;= 85)</option>
                  <option value="warning">Warning (70 - 84)</option>
                  <option value="critical">Critical (&lt; 70)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: T.faint }}>Repo Load:</span>
                <select 
                  value={filterRepoCount}
                  onChange={e => setFilterRepoCount(e.target.value)}
                  style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "5px 10px", fontSize: 12, outline: "none", cursor: "pointer" }}
                >
                  <option value="all">All Sizes</option>
                  <option value="single">Single Repository</option>
                  <option value="multiple">Multi-Repository</option>
                </select>
              </div>
            </div>

            {/* Sorting */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.faint }}>Sort By:</span>
              <select 
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, padding: "5px 10px", fontSize: 12, outline: "none", cursor: "pointer" }}
              >
                <option value="recent">Recently Created</option>
                <option value="name">Alphabetical (A-Z)</option>
                <option value="health">Health Rating</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* --- RECENT PROJECTS BLOCK --- */}
      {!simulateError && !simulateEmpty && !simulateLoading && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 650, color: T.text, marginBottom: 12, letterSpacing: "-0.01em" }}>Last Opened Projects</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {filteredProjects.slice(0, 3).map(p => (
              <div 
                key={`recent-${p.id}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</h3>
                    <p style={{ fontSize: 11, color: T.faint }}>{p.repositoryCount} connected · last analysis {p.lastAnalysis}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 42, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: T.mono, color: T.faint }}>
                      <span>HLTH</span>
                      <span style={{ color: p.healthScore >= 85 ? T.success : p.healthScore >= 70 ? T.warning : T.error }}>{p.healthScore}%</span>
                    </div>
                    <ProgressBar value={p.healthScore} color={p.healthScore >= 85 ? T.success : p.healthScore >= 70 ? T.warning : T.error} />
                  </div>
                  <button 
                    onClick={() => alert(`Redirecting to Repository Management for project "${p.name}"`)}
                    style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: "6px 10px", color: T.dim, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center" }}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- PROJECT GRID & CARD HANDLERS --- */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 650, color: T.text, letterSpacing: "-0.015em" }}>
            Workspace Projects ({simulateLoading ? "..." : filteredProjects.length})
          </h2>
        </div>

        {simulateLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="dash-skeleton" style={{ height: 210, borderRadius: T.r8 }} />
            ))}
          </div>
        ) : simulateEmpty ? (
          /* --- EMPTY ONBOARDING STATE --- */
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r12, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>No active projects found</h3>
            <p style={{ fontSize: 13, color: T.dim, maxWidth: 520, margin: "0 auto 24px" }}>
              Workspaces are empty directories until you register a project wrapper. Get started by organizing your repositories and setting up automatic indexing schedules.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <DashButton variant="primary" onClick={() => { setIsModalOpen(true); setModalStep("form"); }}>
                + Create New Project
              </DashButton>
              <DashButton onClick={() => alert("Redirecting to help documentation...")}>
                Read Onboarding Guide
              </DashButton>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {filteredProjects.map(proj => (
              <article 
                key={proj.id} 
                className="dash-card"
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.r8,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 240,
                  position: "relative"
                }}
              >
                <div>
                  {/* Top line: Icon, name, favorite */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24, padding: "4px 8px", background: T.surfaceEl, borderRadius: T.r6 }}>{proj.icon}</span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 650, color: T.text, letterSpacing: "-0.01em" }}>{proj.name}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: T.faint }}>by {proj.owner}</span>
                          <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.faint }} />
                          <span style={{ fontSize: 10, color: T.faint }}>{proj.visibility}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4 }}>
                      {/* Favorite button */}
                      <button 
                        onClick={() => handleToggleFavorite(proj.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: proj.favorite ? T.warning : T.faint }}
                        aria-label="Add to favorites"
                      >
                        {proj.favorite ? "★" : "☆"}
                      </button>

                      {/* Dropdown Menu Trigger */}
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === proj.id ? null : proj.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: T.faint }}
                        aria-label="Actions menu"
                      >
                        ⋮
                      </button>

                      {/* Action Dropdown Menu */}
                      {activeMenuId === proj.id && (
                        <div 
                          ref={menuRef}
                          style={{ position: "absolute", right: 18, top: 50, background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: T.r6, padding: 6, width: 140, boxShadow: T.shadowLg, zIndex: 50 }}
                        >
                          <button onClick={() => alert(`Redirecting to Repository Management for project "${proj.name}"`)} style={{ width: "100%", padding: "6px 8px", background: "none", border: "none", color: T.dim, textAlign: "left", fontSize: 12, cursor: "pointer", borderRadius: T.r4 }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov} onMouseLeave={e => e.currentTarget.style.background = "none"}>Open</button>
                          <button onClick={() => { const name = prompt("Rename project to:", proj.name); if (name) setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, name } : p)); setActiveMenuId(null); }} style={{ width: "100%", padding: "6px 8px", background: "none", border: "none", color: T.dim, textAlign: "left", fontSize: 12, cursor: "pointer", borderRadius: T.r4 }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov} onMouseLeave={e => e.currentTarget.style.background = "none"}>Rename</button>
                          <button onClick={() => handleDuplicateProject(proj)} style={{ width: "100%", padding: "6px 8px", background: "none", border: "none", color: T.dim, textAlign: "left", fontSize: 12, cursor: "pointer", borderRadius: T.r4 }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov} onMouseLeave={e => e.currentTarget.style.background = "none"}>Duplicate</button>
                          <button onClick={() => { alert("Project archived successfully."); setActiveMenuId(null); }} style={{ width: "100%", padding: "6px 8px", background: "none", border: "none", color: T.dim, textAlign: "left", fontSize: 12, cursor: "pointer", borderRadius: T.r4 }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov} onMouseLeave={e => e.currentTarget.style.background = "none"}>Archive</button>
                          <div style={{ height: 1, background: T.border, margin: "4px 0" }} />
                          <button onClick={() => handleDeleteProject(proj.id)} style={{ width: "100%", padding: "6px 8px", background: "none", border: "none", color: T.error, textAlign: "left", fontSize: 12, cursor: "pointer", borderRadius: T.r4 }} onMouseEnter={e => e.currentTarget.style.background = "rgba(248,81,73,0.08)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: T.dim, lineHeight: "1.4", margin: "10px 0 16px", minHeight: 34 }}>
                    {proj.description}
                  </p>
                </div>

                {/* Health Rating and Repo Count line */}
                <div>
                  {/* Repository Spark Health Dots */}
                  {proj.repoHealths && proj.repoHealths.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, background: T.surfaceEl, padding: "6px 10px", borderRadius: T.r6, border: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 10, color: T.faint, fontWeight: 500 }}>REPOS HEALTH:</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        {proj.repoHealths.map((h, i) => (
                          <span 
                            key={i} 
                            title={`Sub-repository health score: ${h}%`}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: h >= 85 ? T.success : h >= 70 ? T.warning : T.error,
                              display: "inline-block"
                            }} 
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: T.faint }}>Repos:</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.mono }}>{proj.repositoryCount}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: T.faint }}>Health:</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: proj.healthScore >= 85 ? T.success : proj.healthScore >= 70 ? T.warning : T.error, fontFamily: T.mono }}>
                        {proj.healthScore}%
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <ProgressBar value={proj.healthScore} color={proj.healthScore >= 85 ? T.success : proj.healthScore >= 70 ? T.warning : T.error} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                    <span style={{ fontSize: 11, color: T.faint }}>Analyzed: {proj.lastAnalysis}</span>
                    <button 
                      onClick={() => alert(`Redirecting to Repository Management for project "${proj.name}"`)}
                      style={{
                        background: T.accentSoft,
                        border: `1px solid ${T.accentBorder}`,
                        borderRadius: T.r6,
                        padding: "6px 12px",
                        color: T.accentBright,
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      Open Project ➔
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* --- QUICK SHORTCUT ACTIONS BAR --- */}
      {!simulateError && (
        <section style={{ borderTop: `1px solid ${T.border}`, paddingTop: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 650, color: T.text, marginBottom: 14, letterSpacing: "-0.01em" }}>Quick Start Actions</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              { title: "Create Project wrapper", desc: "Define workspace and set access credentials.", icon: "📁", action: () => { setIsModalOpen(true); setModalStep("form"); } },
              { title: "Upload local Repository", desc: "Initialize source folder analysis directly.", icon: "📤", action: () => alert("Initiating repository loader simulator...") },
              { title: "Connect GitHub/GitLab", desc: "Authorize connection tokens for repositories.", icon: "🐙", action: () => alert("Connecting git integrations...") },
              { title: "Open Documentation docs", desc: "View schema reference manuals and graph models.", icon: "📚", action: () => alert("Opening knowledge docs...") }
            ].map(qa => (
              <div 
                key={qa.title}
                onClick={qa.action}
                className="dash-card"
                style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 16, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span style={{ fontSize: 24, padding: 6, background: T.surfaceEl, borderRadius: T.r6 }}>{qa.icon}</span>
                <div>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>{qa.title}</h3>
                  <p style={{ fontSize: 11, color: T.dim, lineHeight: "1.3" }}>{qa.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- CREATE PROJECT MODAL --- */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.15s ease" }}>
          <div 
            style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r12, width: "100%", maxWidth: 480, padding: 28, boxShadow: T.shadowLg, position: "relative" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 650, color: T.text }}>Create Workspace Project</h3>
              {modalStep !== "loading" && (
                <button 
                  onClick={resetForm}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.faint }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* --- STEP 1: FORM CONTROLS --- */}
            {modalStep === "form" && (
              <form onSubmit={handleCreateProjectSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>Project Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. core-ledger-microservice"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    style={{ background: T.bg, border: `1px solid ${formErrors.name ? T.error : T.borderMid}`, borderRadius: T.r6, color: T.text, padding: "8px 12px", fontSize: 13, outline: "none" }}
                  />
                  {formErrors.name && <span style={{ color: T.error, fontSize: 11 }}>{formErrors.name}</span>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>Description</label>
                  <textarea 
                    rows="3"
                    placeholder="Describe this project container..."
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    style={{ background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: T.r6, color: T.text, padding: "8px 12px", fontSize: 13, outline: "none", resize: "none" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>Visual Icon</label>
                    <select 
                      value={formIcon}
                      onChange={e => setFormIcon(e.target.value)}
                      style={{ background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: T.r6, color: T.text, padding: "8px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}
                    >
                      <option value="🌐">🌐 Global</option>
                      <option value="🔒">🔒 Secure</option>
                      <option value="🧠">🧠 Neural</option>
                      <option value="📊">📊 Graph</option>
                      <option value="⚡">⚡ Speed</option>
                      <option value="🏠">🏠 Base</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>Visibility Mode</label>
                    <select 
                      value={formVisibility}
                      onChange={e => setFormVisibility(e.target.value)}
                      style={{ background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: T.r6, color: T.text, padding: "8px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}
                    >
                      <option value="Private">Private</option>
                      <option value="Internal">Internal</option>
                      <option value="Public">Public</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button 
                    type="button" 
                    onClick={resetForm}
                    style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: T.r6, color: T.dim, fontSize: 12, padding: "8px 16px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    style={{ background: T.accent, border: "none", borderRadius: T.r6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "8px 16px", cursor: "pointer" }}
                  >
                    Create Project
                  </button>
                </div>
              </form>
            )}

            {/* --- STEP 2: LOADING --- */}
            {modalStep === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "30px 0" }}>
                <span style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: T.text, textAlign: "center", marginBottom: 4 }}>Creating Project Directory</h4>
                  <p style={{ fontSize: 11, color: T.faint, textAlign: "center" }}>Allocating workspace schemas and mapping indices...</p>
                </div>
              </div>
            )}

            {/* --- STEP 3: SUCCESS --- */}
            {modalStep === "success" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${T.success}1c`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: T.success, fontSize: 20 }}>✓</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <h4 style={{ fontSize: 14, fontWeight: 650, color: T.text, marginBottom: 4 }}>Project Created Successfully</h4>
                  <p style={{ fontSize: 12, color: T.dim }}>
                    The container wrapper has been registered. You can now begin loading source code repositories.
                  </p>
                </div>
                <button 
                  onClick={resetForm}
                  style={{ background: T.accent, border: "none", borderRadius: T.r6, color: "#fff", fontSize: 12, padding: "8px 24px", cursor: "pointer", fontWeight: 500 }}
                >
                  Go to Directory
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

function PageStub({ pageId, setActivePage }) {
  if (pageId === "dashboard") return <DashboardPage setActivePage={setActivePage} />;
  if (pageId === "projects") return <ProjectsPage />;
  
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
        <span style={{ fontSize: 13, color: T.faint, fontFamily: T.mono }}>// {meta.label.toLowerCase().replace(/ /g, "_")}_widget · coming in next prompt</span>
      </div>
    </div>
  );
}

/* ─── MOBILE SIDEBAR OVERLAY ─────────────────────────────────────────────── */
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

/* ─── APP LAYOUT ─────────────────────────────────────────────────────────── */
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

        <TopNav breadcrumb={meta.breadcrumb || ["Dashboard"]} />

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

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT ROUTER
═══════════════════════════════════════════════════════════════════════════ */
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

      {/* Demo nav strip — remove in production */}
      {screen !== "app" && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: "6px 8px", zIndex: 999 }}>
          {[["login","Login"],["register","Register"],["forgot","Forgot"],["reset","Reset"],["app","App shell"]].map(([id, label]) => (
            <button key={id} onClick={() => setScreen(id)} style={{
              padding: "5px 12px", borderRadius: T.r4, border: "none", cursor: "pointer", fontSize: 11,
              background: screen === id ? T.accent : T.surfaceEl, color: screen === id ? "#fff" : T.faint,
              fontFamily: T.mono,
            }}>{label}</button>
          ))}
        </div>
      )}
    </>
  );
}
