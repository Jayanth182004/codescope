Created At: 2026-06-25T13:27:26Z
Completed At: 2026-06-25T13:27:26Z
File Path: `file:///c:/Users/eslav/OneDrive/Desktop/my%20project/CodeScopeApp.jsx`
Total Lines: 1389
Total Bytes: 78282
Showing lines 1 to 800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import { useState, useEffect, useRef, createContext, useContext } from "react";
2: 
3: /* ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
4:    Dark shell: near-black base, subtle zinc surfaces, single teal accent.
5:    Typography: Inter for UI, JetBrains Mono for code/data moments.
6:    Mirrors the landing page accent (#2B5C52) but on a dark ground.
7: ──────────────────────────────────────────────────────────────────────────── */
8: const T = {
9:   /* Backgrounds */
10:   bg:        "#0D0E0F",   /* page base — near-black with warm undertone */
11:   surface:   "#141516",   /* sidebar, cards */
12:   surfaceEl: "#1A1B1D",   /* elevated panels */
13:   surfaceHov:"#1F2022",   /* hover state */
14: 
15:   /* Borders */
16:   border:    "rgba(255,255,255,0.07)",
17:   borderMid: "rgba(255,255,255,0.11)",
18: 
19:   /* Text */
20:   text:      "#F0EFEC",   /* primary */
21:   dim:       "rgba(240,239,236,0.60)",
22:   faint:     "rgba(240,239,236,0.35)",
23: 
24:   /* Accent — deep teal from landing, brightened for dark bg */
25:   accent:    "#3D8B7A",
26:   accentBright: "#4EADA0",
27:   accentSoft:"rgba(61,139,122,0.12)",
28:   accentBorder:"rgba(61,139,122,0.30)",
29: 
30:   /* Semantic */
31:   success:   "#3FB950",
32:   warning:   "#D29922",
33:   error:     "#F85149",
34:   info:      "#58A6FF",
35: 
36:   /* Type */
37:   sans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
38:   mono:  "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
39: 
40:   /* Radius */
41:   r4:  "4px",
42:   r6:  "6px",
43:   r8:  "8px",
44:   r12: "12px",
45: 
46:   /* Shadow */
47:   shadow:    "0 4px 24px rgba(0,0,0,0.5)",
48:   shadowLg:  "0 8px 48px rgba(0,0,0,0.65)",
49: };
50: 
51: /* ─── APP CONTEXT ────────────────────────────────────────────────────────── */
52: const AppCtx = createContext(null);
53: function useApp() { return useContext(AppCtx); }
54: 
55: /* ─── ICONS (inline SVG, no dependency) ─────────────────────────────────── */
56: const Icon = ({ d, size = 16, stroke = T.faint, fill = "none", strokeWidth = 1.5 }) => (
57:   <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
58:     <path d={d} />
59:   </svg>
60: );
61: 
62: const Icons = {
63:   logo: () => (
64:     <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
65:       <rect x="1" y="1" width="18" height="18" rx="4" stroke={T.accent} strokeWidth="1.2"/>
66:       <path d="M5 10h10M10 5v10" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
67:     </svg>
68:   ),
69:   logoSm: () => (
70:     <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
71:       <rect x="1" y="1" width="18" height="18" rx="4" stroke={T.accent} strokeWidth="1.2"/>
72:       <path d="M5 10h10M10 5v10" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
73:     </svg>
74:   ),
75:   dashboard:    () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
76:   projects:     () => <Icon d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
77:   repos:        () => <Icon d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
78:   arch:         () => <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
79:   deps:         () => <Icon d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
80:   git:          () => <Icon d="M18 3a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3zM6 21a3 3 0 0 0 3-3 3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3zM6 3a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="none" />,
81:   impact:       () => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
82:   error:        () => <Icon d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
83:   ai:           () => <Icon d="M12 8V4H8M12 8h4M12 8v4M8 12H4v4h4v-4zM20 12h-4v4h4v-4zM8 4H4v4h4V4zM20 4h-4v4h4V4z" />,
84:   settings:     () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
85:   logout:       () => <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
86:   search:       () => <Icon d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />,
87:   bell:         () => <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
88:   chevronDown:  () => <Icon d="M6 9l6 6 6-6" />,
89:   chevronRight: () => <Icon d="M9 18l6-6-6-6" />,
90:   menu:         () => <Icon d="M3 12h18M3 6h18M3 18h18" />,
91:   eye:          () => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
92:   eyeOff:       () => <Icon d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />,
93:   github:       () => <Icon d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
94:   google:       () => (
95:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
96:       <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill={T.dim} />
97:     </svg>
98:   ),
99:   check:        () => <Icon d="M20 6L9 17l-5-5" stroke={T.success} />,
100:   workspace:    () => <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
101:   repo:         () => <Icon d="M3 3h18v18H3zM9 3v18M3 9h6M3 15h6" />,
102:   user:         () => <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
103:   sun:          () => <Icon d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z" />,
104:   moon:         () => <Icon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
105:   x:            () => <Icon d="M18 6L6 18M6 6l12 12" />,
106: };
107: 
108: /* ─── KEYFRAMES ──────────────────────────────────────────────────────────── */
109: const GLOBAL_CSS = `
110:   *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
111:   html, body { background: ${T.bg}; color: ${T.text}; font-family: ${T.sans}; height: 100%; }
112:   ::selection { background: ${T.accentSoft}; }
113:   :focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; border-radius: 4px; }
114:   input, button { font-family: inherit; }
115:   @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
116:   @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
117:   @keyframes spin { to { transform:rotate(360deg); } }
118:   @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
119:   @keyframes pulseGreen { 0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,0.4)} 50%{box-shadow:0 0 0 6px rgba(63,185,80,0)} }
120:   @keyframes shimmer { 100% { transform: translateX(100%); } }
121:   @keyframes progressSweep { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
122:   .sidebar-item { transition: background 0.12s, color 0.12s; }
123:   .sidebar-item:hover { background: ${T.surfaceHov} !important; color: ${T.text} !important; }
124:   .sidebar-item.active { background: ${T.accentSoft} !important; color: ${T.accentBright} !important; }
125:   .nav-dropdown { animation: fadeUp 0.18s ease; }
126:   .auth-card { animation: fadeUp 0.4s ease; }
127:   .page-in { animation: fadeIn 0.25s ease; }
128:   .dash-card { transition: border-color 0.16s ease, transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease; }
129:   .dash-card:hover { transform: translateY(-2px); border-color: ${T.borderMid} !important; box-shadow: 0 12px 36px rgba(0,0,0,0.24); }
130:   .dash-grid-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
131:   .dash-priority-grid { display: grid; grid-template-columns: minmax(260px, 1.2fr) repeat(3, minmax(170px, 1fr)); gap: 12px; }
132:   .dash-grid-main { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr); gap: 16px; align-items: start; }
133:   .dash-grid-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
134:   .dash-skeleton { position: relative; overflow: hidden; background: ${T.surfaceEl}; border-radius: 6px; }
135:   .dash-skeleton::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: shimmer 1.35s infinite; }
136:   .dash-progress-fill { background-size: 220% 100%; animation: progressSweep 2.8s linear infinite; }
137:   @media (max-width: 1180px) {
138:     .dash-grid-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
139:     .dash-priority-grid, .dash-grid-main, .dash-grid-three { grid-template-columns: 1fr; }
140:   }
141:   @media (max-width: 640px) {
142:     .dash-page { padding: 24px 16px !important; }
143:     .dash-grid-stats { grid-template-columns: 1fr; }
144:     .dash-filter-row { grid-template-columns: 1fr !important; }
145:     .dash-header-actions { width: 100%; justify-content: stretch !important; }
146:     .dash-header-actions button { flex: 1; }
147:   }
148:   @media (max-width: 900px) {
149:     .sidebar-desktop { display: none !important; }
150:     .sidebar-mobile-visible { display: flex !important; }
151:   }
152:   @media (min-width: 901px) {
153:     .sidebar-mobile-visible { display: none !important; }
154:   }
155: `;
156: 
157: /* ═══════════════════════════════════════════════════════════════════════════
158:    AUTHENTICATION
159: ═══════════════════════════════════════════════════════════════════════════ */
160: 
161: /* ─── Input ──────────────────────────────────────────────────────────────── */
162: function AuthInput({ label, type = "text", value, onChange, placeholder, error, autoFocus, suffix }) {
163:   const [show, setShow] = useState(false);
164:   const isPassword = type === "password";
165:   const actualType = isPassword ? (show ? "text" : "password") : type;
166:   return (
167:     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
168:       <label style={{ fontSize: 12, fontWeight: 500, color: T.dim, letterSpacing: "0.01em" }}>{label}</label>
169:       <div style={{ position: "relative" }}>
170:         <input
171:           type={actualType}
172:           value={value}
173:           onChange={e => onChange(e.target.value)}
174:           placeholder={placeholder}
175:           autoFocus={autoFocus}
176:           style={{
177:             width: "100%",
178:             background: T.bg,
179:             border: `1px solid ${error ? T.error : T.borderMid}`,
180:             borderRadius: 5,
181:             padding: isPassword ? "10px 40px 10px 12px" : "10px 12px",
182:             color: T.text,
183:             fontSize: 14,
184:             outline: "none",
185:             transition: "border-color 0.15s",
186:           }}
187:           onFocus={e => { if (!error) e.target.style.borderColor = T.accent; }}
188:           onBlur={e => { if (!error) e.target.style.borderColor = T.borderMid; }}
189:         />
190:         {isPassword && (
191:           <button
192:             type="button"
193:             onClick={() => setShow(s => !s)}
194:             style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: T.faint, display: "flex" }}
195:             aria-label={show ? "Hide password" : "Show password"}
196:           >
197:             {show ? <Icons.eyeOff /> : <Icons.eye />}
198:           </button>
199:         )}
200:         {suffix && !isPassword && <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>{suffix}</div>}
201:       </div>
202:       {error && <span style={{ fontSize: 12, color: T.error }}>{error}</span>}
203:     </div>
204:   );
205: }
206: 
207: /* ─── AuthBtn ────────────────────────────────────────────────────────────── */
208: function AuthBtn({ children, onClick, loading, disabled, variant = "primary" }) {
209:   const base = {
210:     width: "100%", padding: "10px 16px", borderRadius: 5,
211:     fontSize: 14, fontWeight: 500, cursor: loading || disabled ? "not-allowed" : "pointer",
212:     border: "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center",
213:     gap: 8, transition: "opacity 0.15s, transform 0.1s", opacity: loading || disabled ? 0.6 : 1,
214:     letterSpacing: "-0.01em",
215:   };
216:   const variants = {
217:     primary: { background: T.accent, color: "#fff", borderColor: T.accent },
218:     ghost:   { background: T.surfaceEl, color: T.dim, borderColor: T.borderMid },
219:   };
220:   return (
221:     <button
222:       onClick={onClick}
223:       disabled={loading || disabled}
224:       style={{ ...base, ...variants[variant] }}
225:       onMouseEnter={e => { if (!loading && !disabled) e.currentTarget.style.opacity = "0.85"; }}
226:       onMouseLeave={e => { if (!loading && !disabled) e.currentTarget.style.opacity = "1"; }}
227:     >
228:       {loading && (
229:         <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
230:       )}
231:       {children}
232:     </button>
233:   );
234: }
235: 
236: /* ─── AuthShell ──────────────────────────────────────────────────────────── */
237: function AuthShell({ children, title, subtitle }) {
238:   return (
239:     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: "40px 20px", position: "relative", overflow: "hidden" }}>
240:       {/* Subtle grid backdrop */}
241:       <div style={{
242:         position: "absolute", inset: 0, opacity: 0.04,
243:         backgroundImage: `linear-gradient(${T.faint} 1px, transparent 1px), linear-gradient(90deg, ${T.faint} 1px, transparent 1px)`,
244:         backgroundSize: "32px 32px", pointerEvents: "none"
245:       }} />
246:       {/* Glow */}
247:       <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: `radial-gradient(ellipse, ${T.accentSoft} 0%, transparent 70%)`, pointerEvents: "none" }} />
248: 
249:       <div className="auth-card" style={{ width: "100%", maxWidth: 400, position: "relative" }}>
250:         {/* Logo */}
251:         <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, justifyContent: "center" }}>
252:           <Icons.logo />
253:           <span style={{ fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: "-0.01em", fontFamily: T.sans }}>CodeScope</span>
254:           <span style={{ fontSize: 11, color: T.faint, fontFamily: T.mono }}>AI</span>
255:         </div>
256: 
257:         <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r12, padding: "32px 32px 28px", boxShadow: T.shadowLg }}>
258:           <div style={{ marginBottom: 24 }}>
259:             <h1 style={{ fontSize: 18, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", marginBottom: 6 }}>{title}</h1>
260:             {subtitle && <p style={{ fontSize: 13, color: T.faint }}>{subtitle}</p>}
261:           </div>
262:           {children}
263:         </div>
264:       </div>
265:     </div>
266:   );
267: }
268: 
269: /* ─── AuthDivider ────────────────────────────────────────────────────────── */
270: function AuthDivider() {
271:   return (
272:     <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
273:       <div style={{ flex: 1, height: 1, background: T.border }} />
274:       <span style={{ fontSize: 12, color: T.faint }}>or</span>
275:       <div style={{ flex: 1, height: 1, background: T.border }} />
276:     </div>
277:   );
278: }
279: 
280: /* ─── LOGIN ──────────────────────────────────────────────────────────────── */
281: function LoginPage({ nav }) {
282:   const [email, setEmail] = useState("");
283:   const [password, setPassword] = useState("");
284:   const [remember, setRemember] = useState(false);
285:   const [loading, setLoading] = useState(false);
286:   const [errors, setErrors] = useState({});
287:   const [success, setSuccess] = useState(false);
288: 
289:   const validate = () => {
290:     const e = {};
291:     if (!email.includes("@")) e.email = "Enter a valid email address.";
292:     if (password.length < 6) e.password = "Password must be at least 6 characters.";
293:     return e;
294:   };
295: 
296:   const handleSubmit = () => {
297:     const e = validate();
298:     if (Object.keys(e).length) { setErrors(e); return; }
299:     setErrors({});
300:     setLoading(true);
301:     setTimeout(() => {
302:       setLoading(false);
303:       setSuccess(true);
304:       setTimeout(() => nav("app"), 800);
305:     }, 1400);
306:   };
307: 
308:   if (success) {
309:     return (
310:       <AuthShell title="Welcome back" subtitle="Signing you in…">
311:         <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0" }}>
312:           <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(63,185,80,0.12)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulseGreen 1.5s ease infinite" }}>
313:             <Icons.check />
314:           </div>
315:           <p style={{ fontSize: 14, color: T.dim }}>Redirecting to dashboard…</p>
316:         </div>
317:       </AuthShell>
318:     );
319:   }
320: 
321:   return (
322:     <AuthShell title="Sign in" subtitle="Continue to your workspace">
323:       {/* Social */}
324:       <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
325:         <AuthBtn variant="ghost" onClick={() => {}}>
326:           <Icons.github /> Continue with GitHub
327:         </AuthBtn>
328:         <AuthBtn variant="ghost" onClick={() => {}}>
329:           <Icons.google /> Continue with Google
330:         </AuthBtn>
331:       </div>
332: 
333:       <AuthDivider />
334: 
335:       {/* Fields */}
336:       <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
337:         <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" error={errors.email} autoFocus />
338:         <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" error={errors.password} />
339: 
340:         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
341:           <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: T.dim }}>
342:             <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: T.accent, width: 13, height: 13 }} />
343:             Remember me
344:           </label>
345:           <button onClick={() => nav("forgot")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Forgot password?</button>
346:         </div>
347: 
348:         <AuthBtn onClick={handleSubmit} loading={loading}>Sign in</AuthBtn>
349:       </div>
350: 
351:       <p style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 20 }}>
352:         No account?{" "}
353:         <button onClick={() => nav("register")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Create one</button>
354:       </p>
355:     </AuthShell>
356:   );
357: }
358: 
359: /* ─── REGISTER ───────────────────────────────────────────────────────────── */
360: function RegisterPage({ nav }) {
361:   const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
362:   const [loading, setLoading] = useState(false);
363:   const [errors, setErrors] = useState({});
364:   const set = k => v => setForm(f => ({ ...f, [k]: v }));
365: 
366:   const validate = () => {
367:     const e = {};
368:     if (!form.name.trim()) e.name = "Full name is required.";
369:     if (!form.email.includes("@")) e.email = "Enter a valid email address.";
370:     if (form.password.length < 8) e.password = "Use at least 8 characters.";
371:     if (form.password !== form.confirm) e.confirm = "Passwords don't match.";
372:     return e;
373:   };
374: 
375:   const handleSubmit = () => {
376:     const e = validate();
377:     if (Object.keys(e).length) { setErrors(e); return; }
378:     setErrors({});
379:     setLoading(true);
380:     setTimeout(() => { setLoading(false); nav("login"); }, 1400);
381:   };
382: 
383:   return (
384:     <AuthShell title="Create account" subtitle="Start understanding your codebase">
385:       <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
386:         <AuthInput label="Full name" value={form.name} onChange={set("name")} placeholder="Arjun Mehta" error={errors.name} autoFocus />
387:         <AuthInput label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" error={errors.email} />
388:         <AuthInput label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" error={errors.password} />
389:         <AuthInput label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter password" error={errors.confirm} />
390:         <AuthBtn onClick={handleSubmit} loading={loading}>Create account</AuthBtn>
391:       </div>
392:       <p style={{ fontSize: 12, color: T.faint, textAlign: "center", marginTop: 20 }}>
393:         Already have an account?{" "}
394:         <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.accent }}>Sign in</button>
395:       </p>
396:     </AuthShell>
397:   );
398: }
399: 
400: /* ─── FORGOT PASSWORD ────────────────────────────────────────────────────── */
401: function ForgotPage({ nav }) {
402:   const [email, setEmail] = useState("");
403:   const [loading, setLoading] = useState(false);
404:   const [sent, setSent] = useState(false);
405:   const [error, setError] = useState("");
406: 
407:   const handleSubmit = () => {
408:     if (!email.includes("@")) { setError("Enter a valid email address."); return; }
409:     setError(""); setLoading(true);
410:     setTimeout(() => { setLoading(false); setSent(true); }, 1200);
411:   };
412: 
413:   return (
414:     <AuthShell title="Reset password" subtitle="We'll send a link to your email">
415:       {sent ? (
416:         <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0" }}>
417:           <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
418:             <span style={{ color: T.accentBright, fontSize: 20 }}>✓</span>
419:           </div>
420:           <p style={{ fontSize: 14, color: T.dim, textAlign: "center" }}>Check your inbox — a reset link is on its way.</p>
421:           <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.accent }}>Back to sign in</button>
422:         </div>
423:       ) : (
424:         <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
425:           <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" error={error} autoFocus />
426:           <AuthBtn onClick={handleSubmit} loading={loading}>Send reset link</AuthBtn>
427:           <button onClick={() => nav("login")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.faint, textAlign: "center" }}>← Back to sign in</button>
428:         </div>
429:       )}
430:     </AuthShell>
431:   );
432: }
433: 
434: /* ─── RESET PASSWORD ─────────────────────────────────────────────────────── */
435: function ResetPage({ nav }) {
436:   const [password, setPassword] = useState("");
437:   const [confirm, setConfirm] = useState("");
438:   const [loading, setLoading] = useState(false);
439:   const [errors, setErrors] = useState({});
440: 
441:   const handleSubmit = () => {
442:     const e = {};
443:     if (password.length < 8) e.password = "Use at least 8 characters.";
444:     if (password !== confirm) e.confirm = "Passwords don't match.";
445:     if (Object.keys(e).length) { setErrors(e); return; }
446:     setErrors({}); setLoading(true);
447:     setTimeout(() => { setLoading(false); nav("login"); }, 1200);
448:   };
449: 
450:   return (
451:     <AuthShell title="New password" subtitle="Choose a strong password">
452:       <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
453:         <AuthInput label="New password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" error={errors.password} autoFocus />
454:         <AuthInput label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" error={errors.confirm} />
455:         <AuthBtn onClick={handleSubmit} loading={loading}>Reset password</AuthBtn>
456:       </div>
457:     </AuthShell>
458:   );
459: }
460: 
461: /* ═══════════════════════════════════════════════════════════════════════════
462:    APP SHELL
463: ═══════════════════════════════════════════════════════════════════════════ */
464: 
465: const NAV_ITEMS = [
466:   { id: "dashboard",    label: "Dashboard",           Icon: Icons.dashboard,   group: "main" },
467:   { id: "projects",     label: "Projects",            Icon: Icons.projects,    group: "main" },
468:   { id: "repos",        label: "Repositories",        Icon: Icons.repos,       group: "main" },
469:   null, /* divider */
470:   { id: "arch",         label: "Architecture",        Icon: Icons.arch,        group: "explore" },
471:   { id: "deps",         label: "Dependencies",        Icon: Icons.deps,        group: "explore" },
472:   { id: "git",          label: "Git Intelligence",    Icon: Icons.git,         group: "explore" },
473:   { id: "impact",       label: "Impact Analysis",     Icon: Icons.impact,      group: "explore" },
474:   { id: "errors",       label: "Error Investigation", Icon: Icons.error,       group: "explore" },
475:   null,
476:   { id: "ai",           label: "AI Assistant",        Icon: Icons.ai,          group: "tools" },
477:   { id: "settings",     label: "Settings",            Icon: Icons.settings,    group: "tools" },
478: ];
479: 
480: /* ─── SidebarItem ────────────────────────────────────────────────────────── */
481: function SidebarItem({ item, collapsed, active, onClick }) {
482:   const [hovered, setHovered] = useState(false);
483:   const isActive = active === item.id;
484:   return (
485:     <button
486:       className={`sidebar-item${isActive ? " active" : ""}`}
487:       onClick={() => onClick(item.id)}
488:       onMouseEnter={() => setHovered(true)}
489:       onMouseLeave={() => setHovered(false)}
490:       title={collapsed ? item.label : ""}
491:       aria-label={item.label}
492:       aria-current={isActive ? "page" : undefined}
493:       style={{
494:         display: "flex", alignItems: "center", gap: 10,
495:         padding: collapsed ? "8px" : "7px 10px",
496:         borderRadius: T.r6, border: "none", width: "100%",
497:         cursor: "pointer", color: isActive ? T.accentBright : T.faint,
498:         background: "transparent", textAlign: "left",
499:         justifyContent: collapsed ? "center" : "flex-start",
500:       }}
501:     >
502:       <item.Icon />
503:       {!collapsed && <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{item.label}</span>}
504:     </button>
505:   );
506: }
507: 
508: /* ─── Sidebar ────────────────────────────────────────────────────────────── */
509: function Sidebar({ collapsed, setCollapsed, activePage, setActivePage }) {
510:   const [wsOpen, setWsOpen] = useState(false);
511:   const width = collapsed ? 56 : 220;
512: 
513:   return (
514:     <aside
515:       className="sidebar-desktop"
516:       style={{
517:         width, minWidth: width, height: "100vh", position: "sticky", top: 0,
518:         background: T.surface, borderRight: `1px solid ${T.border}`,
519:         display: "flex", flexDirection: "column",
520:         transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)",
521:         overflow: "hidden", zIndex: 20,
522:       }}
523:     >
524:       {/* Logo row */}
525:       <div style={{ height: 52, display: "flex", alignItems: "center", padding: collapsed ? "0 16px" : "0 14px", borderBottom: `1px solid ${T.border}`, gap: 8, flexShrink: 0 }}>
526:         <Icons.logoSm />
527:         {!collapsed && (
528:           <span style={{ fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: "-0.01em", fontFamily: T.sans, flex: 1 }}>CodeScope</span>
529:         )}
530:         {!collapsed && (
531:           <button
532:             onClick={() => setCollapsed(true)}
533:             style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.faint, display: "flex", borderRadius: T.r4 }}
534:             aria-label="Collapse sidebar"
535:           >
536:             <Icons.menu />
537:           </button>
538:         )}
539:         {collapsed && (
540:           <button
541:             onClick={() => setCollapsed(false)}
542:             style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: T.faint, display: "flex", width: "100%", justifyContent: "center" }}
543:             aria-label="Expand sidebar"
544:           >
545:             <Icons.menu />
546:           </button>
547:         )}
548:       </div>
549: 
550:       {/* Workspace switcher */}
551:       {!collapsed && (
552:         <div style={{ padding: "10px 10px 6px" }}>
553:           <button
554:             onClick={() => setWsOpen(o => !o)}
555:             style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${T.border}`, cursor: "pointer", color: T.dim }}
556:           >
557:             <div style={{ width: 20, height: 20, borderRadius: T.r4, background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
558:               <span style={{ fontSize: 9, fontWeight: 700, color: T.accentBright }}>CS</span>
559:             </div>
560:             <span style={{ fontSize: 12, fontWeight: 500, flex: 1, textAlign: "left" }}>codescope-ai</span>
561:             <Icons.chevronDown />
562:           </button>
563:           {wsOpen && (
564:             <div className="nav-dropdown" style={{ background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r6, padding: 6, marginTop: 4 }}>
565:               {["codescope-ai", "personal", "+ New workspace"].map(ws => (
566:                 <button key={ws} onClick={() => setWsOpen(false)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 8px", borderRadius: T.r4, cursor: "pointer", fontSize: 12, color: T.faint }}
567:                   onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
568:                   onMouseLeave={e => e.currentTarget.style.background = "none"}
569:                 >{ws}</button>
570:               ))}
571:             </div>
572:           )}
573:         </div>
574:       )}
575: 
576:       {/* Nav items */}
577:       <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto", overflowX: "hidden" }} aria-label="Main navigation">
578:         {NAV_ITEMS.map((item, i) =>
579:           item === null
580:             ? <div key={`div-${i}`} style={{ height: 1, background: T.border, margin: "6px 4px" }} />
581:             : <SidebarItem key={item.id} item={item} collapsed={collapsed} active={activePage} onClick={setActivePage} />
582:         )}
583:       </nav>
584: 
585:       {/* Bottom: profile + logout */}
586:       <div style={{ padding: "8px 8px 12px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
587:         {!collapsed && (
588:           <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: T.r6 }}>
589:             <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.accentSoft, border: `1px solid ${T.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
590:               <span style={{ fontSize: 10, fontWeight: 600, color: T.accentBright }}>AM</span>
591:             </div>
592:             <div style={{ flex: 1, minWidth: 0 }}>
593:               <div style={{ fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Arjun Mehta</div>
594:               <div style={{ fontSize: 11, color: T.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>arjun@company.com</div>
595:             </div>
596:           </div>
597:         )}
598:         <button
599:           onClick={() => {}}
600:           title="Sign out"
601:           style={{ display: "flex", alignItems: "center", gap: 8, padding: collapsed ? "8px" : "7px 10px", borderRadius: T.r6, background: "none", border: "none", cursor: "pointer", color: T.faint, justifyContent: collapsed ? "center" : "flex-start", width: "100%" }}
602:           onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHov; e.currentTarget.style.color = T.error; }}
603:           onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.faint; }}
604:           aria-label="Sign out"
605:         >
606:           <Icons.logout />
607:           {!collapsed && <span style={{ fontSize: 13 }}>Sign out</span>}
608:         </button>
609:       </div>
610:     </aside>
611:   );
612: }
613: 
614: /* ─── Breadcrumb ─────────────────────────────────────────────────────────── */
615: function Breadcrumb({ trail }) {
616:   return (
617:     <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6 }}>
618:       {trail.map((crumb, i) => (
619:         <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
620:           {i > 0 && <span style={{ color: T.faint, fontSize: 12, marginTop: 1 }}><Icons.chevronRight /></span>}
621:           <span style={{
622:             fontSize: 13, color: i === trail.length - 1 ? T.text : T.faint,
623:             fontWeight: i === trail.length - 1 ? 500 : 400,
624:             cursor: i < trail.length - 1 ? "pointer" : "default",
625:           }}>{crumb}</span>
626:         </span>
627:       ))}
628:     </nav>
629:   );
630: }
631: 
632: /* ─── GlobalSearch ───────────────────────────────────────────────────────── */
633: function GlobalSearch() {
634:   const [open, setOpen] = useState(false);
635:   const [query, setQuery] = useState("");
636:   const inputRef = useRef(null);
637: 
638:   useEffect(() => {
639:     const handler = (e) => {
640:       if ((e.metaKey || e.ctrlKey) && e.key === "k") {
641:         e.preventDefault();
642:         setOpen(o => !o);
643:       }
644:       if (e.key === "Escape") setOpen(false);
645:     };
646:     window.addEventListener("keydown", handler);
647:     return () => window.removeEventListener("keydown", handler);
648:   }, []);
649: 
650:   useEffect(() => {
651:     if (open && inputRef.current) { setTimeout(() => inputRef.current?.focus(), 60); }
652:   }, [open]);
653: 
654:   return (
655:     <>
656:       {/* Search trigger */}
657:       <button
658:         onClick={() => setOpen(true)}
659:         style={{
660:           display: "flex", alignItems: "center", gap: 8,
661:           background: T.surfaceEl, border: `1px solid ${T.border}`,
662:           borderRadius: T.r6, padding: "6px 12px",
663:           cursor: "pointer", color: T.faint, width: 220,
664:         }}
665:         aria-label="Search (Ctrl+K)"
666:       >
667:         <Icons.search />
668:         <span style={{ fontSize: 13, flex: 1, textAlign: "left" }}>Search…</span>
669:         <span style={{ fontSize: 11, fontFamily: T.mono, background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r4, padding: "1px 6px", color: T.faint }}>⌘K</span>
670:       </button>
671: 
672:       {/* Modal */}
673:       {open && (
674:         <div
675:           style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "18vh", animation: "fadeIn 0.12s ease" }}
676:           onClick={() => setOpen(false)}
677:         >
678:           <div
679:             className="nav-dropdown"
680:             style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: T.r12, width: "100%", maxWidth: 560, boxShadow: T.shadowLg, overflow: "hidden" }}
681:             onClick={e => e.stopPropagation()}
682:           >
683:             <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
684:               <Icons.search />
685:               <input
686:                 ref={inputRef}
687:                 value={query}
688:                 onChange={e => setQuery(e.target.value)}
689:                 placeholder="Search files, functions, services…"
690:                 style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: T.text }}
691:               />
692:               <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, display: "flex" }}>
693:                 <Icons.x />
694:               </button>
695:             </div>
696:             <div style={{ padding: "12px 16px" }}>
697:               <p style={{ fontSize: 12, color: T.faint, marginBottom: 10 }}>Recent</p>
698:               {["PaymentService", "BillingAdapter", "auth/login endpoint"].map(r => (
699:                 <button key={r} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: T.r6, background: "none", border: "none", cursor: "pointer", color: T.dim, textAlign: "left", fontSize: 13 }}
700:                   onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
701:                   onMouseLeave={e => e.currentTarget.style.background = "none"}
702:                 >
703:                   <span style={{ fontFamily: T.mono, fontSize: 11 }}>›</span> {r}
704:                 </button>
705:               ))}
706:             </div>
707:             <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 12 }}>
708:               {[["↩","select"],["↑↓","navigate"],["esc","close"]].map(([k,v]) => (
709:                 <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.faint }}>
710:                   <span style={{ fontFamily: T.mono, background: T.surfaceEl, border: `1px solid ${T.border}`, borderRadius: T.r4, padding: "1px 6px" }}>{k}</span>
711:                   {v}
712:                 </span>
713:               ))}
714:             </div>
715:           </div>
716:         </div>
717:       )}
718:     </>
719:   );
720: }
721: 
722: /* ─── TopNav ─────────────────────────────────────────────────────────────── */
723: function TopNav({ breadcrumb, sidebarCollapsed }) {
724:   const [notifOpen, setNotifOpen] = useState(false);
725:   const [profileOpen, setProfileOpen] = useState(false);
726:   const [repoOpen, setRepoOpen] = useState(false);
727:   const [isDark] = useState(true);
728:   const notifRef = useRef(null);
729:   const profileRef = useRef(null);
730: 
731:   useEffect(() => {
732:     const handler = (e) => {
733:       if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
734:       if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
735:     };
736:     document.addEventListener("mousedown", handler);
737:     return () => document.removeEventListener("mousedown", handler);
738:   }, []);
739: 
740:   return (
741:     <header style={{
742:       height: 52, position: "sticky", top: 0, zIndex: 10,
743:       background: `${T.bg}cc`, backdropFilter: "blur(16px)",
744:       borderBottom: `1px solid ${T.border}`,
745:       display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
746:       flexShrink: 0,
747:     }}>
748:       {/* Breadcrumb */}
749:       <div style={{ flex: 1 }}>
750:         <Breadcrumb trail={breadcrumb} />
751:       </div>
752: 
753:       {/* Repo selector */}
754:       <div style={{ position: "relative" }} ref={notifRef}>
755:         <button
756:           onClick={() => setRepoOpen(o => !o)}
757:           style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: T.r6, background: T.surfaceEl, border: `1px solid ${T.border}`, cursor: "pointer", color: T.dim, fontSize: 12 }}
758:         >
759:           <Icons.repo />
760:           <span style={{ fontFamily: T.mono, fontSize: 11 }}>main-api</span>
761:           <Icons.chevronDown />
762:         </button>
763:         {repoOpen && (
764:           <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 6, minWidth: 180, boxShadow: T.shadow, zIndex: 50 }}>
765:             {["main-api", "payments-service", "auth-gateway", "frontend"].map(r => (
766:               <button key={r} onClick={() => setRepoOpen(false)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: T.r4, background: "none", border: "none", cursor: "pointer", color: T.dim, fontSize: 12, textAlign: "left", fontFamily: T.mono }}
767:                 onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
768:                 onMouseLeave={e => e.currentTarget.style.background = "none"}
769:               >{r}</button>
770:             ))}
771:           </div>
772:         )}
773:       </div>
774: 
775:       {/* Search */}
776:       <GlobalSearch />
777: 
778:       {/* Notification */}
779:       <div style={{ position: "relative" }} ref={notifRef}>
780:         <button
781:           onClick={() => setNotifOpen(o => !o)}
782:           style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: T.faint, display: "flex", padding: 6, borderRadius: T.r6 }}
783:           aria-label="Notifications"
784:           onMouseEnter={e => { e.currentTarget.style.background = T.surfaceEl; e.currentTarget.style.color = T.text; }}
785:           onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.faint; }}
786:         >
787:           <Icons.bell />
788:           <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: T.accent, border: `1.5px solid ${T.bg}` }} />
789:         </button>
790:         {notifOpen && (
791:           <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: 8, width: 300, boxShadow: T.shadow, zIndex: 50 }}>
792:             <p style={{ fontSize: 12, fontWeight: 500, color: T.dim, padding: "4px 8px 10px" }}>Notifications</p>
793:             {[["Impact alert: PaymentService", "3 services at risk · 2m ago", T.warning],
794:               ["Analysis complete: auth-gateway", "0 breaking changes · 18m ago", T.success]].map(([t, s, c]) => (
795:               <div key={t} style={{ padding: "8px 10px", borderRadius: T.r6, marginBottom: 2 }}
796:                 onMouseEnter={e => e.cu
<truncated 534 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.