import { createContext, useContext } from "react";

const T = {
  /* Backgrounds */
  bg:        "#0D0E0F",   /* page base  near-black with warm undertone */
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

  /* Accent  deep teal from landing, brightened for dark bg */
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

/*  APP CONTEXT  */
const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

/*  ICONS (inline SVG, no dependency)  */
const Icon = ({ d, size = 16, stroke = T.faint, fill = "none", strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  alertTriangle: () => <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  upload: () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  gitBranch: () => <Icon d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9" />,
  star: () => <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  starFilled: () => <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#D29922" stroke="#D29922" />,
  moreH: () => <Icon d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.5} />,
  link: () => <Icon d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  file: () => <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />,
  database: () => <Icon d="M12 3c4.42 0 8 1.34 8 3s-3.58 3-8 3-8-1.34-8-3 3.58-3 8-3zM4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />,
  trash: () => <Icon d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />,
  gridView: () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  listView: () => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  archive: () => <Icon d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />,
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

/*  KEYFRAMES  */
const GLOBAL_CSS = `
.tree-node-hover:hover { background: rgba(255,255,255,0.04) !important; }
.list-row-hover:hover { background: rgba(255,255,255,0.02) !important; }
.hover-text:hover { color: #fff !important; }

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
  @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes dropPulse { 0%,100% { border-color: rgba(61,139,122,0.5); background: rgba(61,139,122,0.06); } 50% { border-color: rgba(61,139,122,0.9); background: rgba(61,139,122,0.12); } }
  @keyframes uploadFill { from { width: 0%; } to { width: 100%; } }
  @keyframes cardIn { from { opacity:0; transform:scale(0.97) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .repo-card { transition: border-color 0.16s, transform 0.16s, box-shadow 0.16s, background 0.16s; }
  .repo-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.13) !important; box-shadow: 0 10px 32px rgba(0,0,0,0.28); }
  .repo-card-new { animation: cardIn 0.3s ease; }
  .drop-active { animation: dropPulse 1.2s ease infinite; }
  .upload-tab { transition: color 0.15s, border-color 0.15s, background 0.15s; }
  .repo-action-btn { transition: background 0.12s, color 0.12s; }
  .repo-action-btn:hover { background: rgba(255,255,255,0.06) !important; }
  .repo-list-row { transition: background 0.12s; }
  .repo-list-row:hover { background: rgba(255,255,255,0.03) !important; }
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
    .knowledge-layout { grid-template-columns: 260px minmax(560px, 1fr) 320px !important; overflow-x: auto !important; }
    .dependency-layout { grid-template-columns: minmax(220px, 260px) minmax(520px, 1fr) 300px !important; overflow-x: auto !important; }
    .impact-layout { grid-template-columns: minmax(240px, 280px) minmax(620px, 1fr) 320px !important; overflow-x: auto !important; }
    .git-layout { grid-template-columns: minmax(240px, 280px) minmax(650px, 1fr) 320px !important; overflow-x: auto !important; }
    .dependency-inspector { width: 300px !important; }
  }
  @media (min-width: 901px) {
    .sidebar-mobile-visible { display: none !important; }
  }
`;

export { T, AppCtx, useApp, Icons, GLOBAL_CSS };
