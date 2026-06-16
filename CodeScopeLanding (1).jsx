import { useState, useEffect, useRef } from "react";

/* ─── DESIGN TOKENS ─────────────────────────────────────────── */
/* Cartography theme: paper-white surfaces, ink text, one deep map-teal accent. */
const T = {
  bg:      "#0D0E0F",
  surface: "#141516",
  surfaceEl: "#1A1B1D",
  border:  "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.11)",
  text:    "#F0EFEC",
  dim:     "rgba(240,239,236,0.60)",
  faint:   "rgba(240,239,236,0.35)",
  accent:  "#3D8B7A",
  accentBright: "#4EADA0",
  accentSoft: "rgba(61,139,122,0.12)",
  good:    "#3FB950",
  mono:    "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
  serif:   "Georgia, 'Times New Roman', serif",
  sans:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

/* ─── SCROLL FADE ────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.1 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0,
      transform: v ? "translateY(0)" : "translateY(16px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      ...style
    }}>{children}</div>
  );
}

/* ─── TYPING ANIMATION ───────────────────────────────────────── */
function TypeLine({ lines }) {
  const [display, setDisplay] = useState([]);
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (lineIdx >= lines.length) { setDone(true); return; }
    const line = lines[lineIdx];
    if (charIdx <= line.text.length) {
      const t = setTimeout(() => {
        setDisplay(prev => {
          const next = [...prev];
          next[lineIdx] = { ...line, text: line.text.slice(0, charIdx) };
          return next;
        });
        setCharIdx(c => c + 1);
      }, charIdx === 0 ? (lineIdx === 0 ? 600 : 200) : 28);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => { setLineIdx(i => i + 1); setCharIdx(0); }, 180);
      return () => clearTimeout(t);
    }
  }, [lineIdx, charIdx, lines]);

  return (
    <div style={{ fontFamily: T.mono, fontSize: 13, lineHeight: 2, userSelect: "none" }}>
      {display.map((l, i) => (
        <div key={i} style={{ color: l.color || T.dim, display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ color: T.faint, minWidth: 16 }}>{l.prompt || ">"}</span>
          <span>{l.text}</span>
          {i === display.length - 1 && !done && (
            <span style={{ display: "inline-block", width: 7, height: 13, background: T.accent, animation: "blink 1s step-end infinite", marginLeft: 1, verticalAlign: "middle" }} />
          )}
        </div>
      ))}
      {done && (
        <div style={{ color: T.faint, marginTop: 4, fontSize: 12 }}>
          <span style={{ color: "#4ADE80" }}>✓</span> analysis complete · risk: low · 0 breaking changes
        </div>
      )}
    </div>
  );
}

const TERMINAL_LINES = [
  { text: "codescope analyze PaymentService", prompt: "$", color: T.text },
  { text: "resolving dependencies...", prompt: "·", color: T.faint },
  { text: "mapped 847 call relationships", prompt: "·", color: T.faint },
  { text: "checking downstream impact...", prompt: "·", color: T.faint },
  { text: "6 services affected · 3 tests need to run", prompt: "·", color: T.accent },
  { text: "root cause: BillingAdapter.processCharge:142", prompt: "·", color: T.accent },
];

/* ─── NAV ────────────────────────────────────────────────────── */
function Nav({ onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent",
      background: scrolled ? "rgba(13,14,15,0.88)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      transition: "all 0.4s ease",
    }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 40px", height: 60, display: "flex", alignItems: "center", gap: 8 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="1" y="1" width="18" height="18" rx="4" stroke={T.accent} strokeWidth="1.2"/>
            <path d="M5 10h10M10 5v10" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ color: T.text, fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", fontFamily: T.sans }}>CodeScope</span>
          <span style={{ color: T.faint, fontSize: 11, fontFamily: T.mono }}>AI</span>
        </div>

        {/* Links */}
        <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
          {["Features", "How it works", "Docs", "Pricing"].map(l => (
            <a key={l} href="#" style={{
              color: T.faint, fontSize: 13, padding: "6px 14px", textDecoration: "none",
              fontFamily: T.sans, fontWeight: 400, transition: "color 0.15s",
            }}
              onMouseEnter={e => e.target.style.color = T.dim}
              onMouseLeave={e => e.target.style.color = T.faint}
            >{l}</a>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
          <a href="#login" onClick={(e) => { e.preventDefault(); onEnterApp?.("login"); }} style={{ color: T.faint, fontSize: 13, padding: "7px 16px", textDecoration: "none", fontFamily: T.sans }}>Log in</a>
          <a href="#" style={{
            color: T.bg, background: T.text, fontSize: 13, padding: "7px 18px",
            borderRadius: 5, textDecoration: "none", fontWeight: 500,
            fontFamily: T.sans, letterSpacing: "-0.01em"
          }} onClick={(e) => { e.preventDefault(); onEnterApp?.("app"); }}>Get started</a>
        </div>
      </div>
    </nav>
  );
}

/* ─── HERO ───────────────────────────────────────────────────── */
function Hero({ onEnterApp }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "120px 40px 100px", maxWidth: 1080, margin: "0 auto" }}>
      {/* Signature: faint topographic contour lines — the codebase as terrain */}
      <svg
        viewBox="0 0 1080 760" preserveAspectRatio="xMaxYMid slice"
        style={{ position: "absolute", top: 0, right: 0, width: "62%", height: "100%", opacity: 0.55, pointerEvents: "none" }}
      >
        {[0,1,2,3,4,5].map(i => (
          <path
            key={i}
            d={[
              "M 760,40 C 880,90 960,180 940,300 C 920,420 800,470 780,580 C 765,660 800,700 880,740",
              "M 700,0 C 850,30 1000,120 1010,260 C 1020,400 880,460 860,560 C 845,640 880,700 960,760",
              "M 640,-40 C 820,-10 1020,90 1050,240 C 1080,390 920,450 900,560 C 882,655 930,710 1020,760",
              "M 820,60 C 900,110 950,200 935,300 C 920,400 850,440 840,520 C 832,580 855,610 900,640",
              "M 880,90 C 935,130 965,200 955,280 C 945,360 895,390 888,450 C 882,500 900,520 930,540",
              "M 940,120 C 975,150 990,200 982,260 C 975,320 945,340 940,380",
            ][i]}
            fill="none"
            stroke={T.borderMid}
            strokeWidth="1"
          />
        ))}
        <circle cx="780" cy="580" r="3.5" fill={T.accent} />
        <circle cx="780" cy="580" r="9" fill="none" stroke={T.accent} strokeWidth="1" opacity="0.5" />
      </svg>

      <div style={{ maxWidth: 680, position: "relative" }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.faint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 40 }}>
          Code intelligence platform
        </div>

        <h1 style={{
          fontFamily: T.serif, fontSize: "clamp(42px, 5.5vw, 72px)",
          fontWeight: 400, color: T.text, lineHeight: 1.06,
          letterSpacing: "-0.025em", margin: "0 0 32px",
        }}>
          Understand any codebase.<br />
          <em style={{ fontStyle: "italic", color: T.accent }}>In minutes, not months.</em>
        </h1>

        <p style={{
          fontFamily: T.sans, fontSize: 17, color: T.dim,
          lineHeight: 1.7, maxWidth: 520, margin: "0 0 48px", fontWeight: 400
        }}>
          CodeScope maps every dependency, predicts every blast radius, and answers any question about your system — grounded in the actual code.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); onEnterApp?.("app"); }} style={{
            color: T.bg, background: T.text, fontSize: 14, padding: "11px 24px",
            borderRadius: 5, textDecoration: "none", fontWeight: 500,
            fontFamily: T.sans, letterSpacing: "-0.01em"
          }}>Start for free</a>
          <a href="#" style={{
            color: T.dim, fontSize: 14, textDecoration: "none",
            fontFamily: T.sans, display: "flex", alignItems: "center", gap: 6, padding: "11px 0"
          }}>
            See how it works
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </div>

      {/* Terminal */}
      <div style={{ marginTop: 80, maxWidth: 580 }}>
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 32 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.faint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>
            Live example · payment service outage
          </div>
          <TypeLine lines={TERMINAL_LINES} />
        </div>
      </div>
    </section>
  );
}

/* ─── DIVIDER ────────────────────────────────────────────────── */
function Divider() {
  return <div style={{ borderTop: `1px solid ${T.border}`, margin: "0 40px" }} />;
}

/* ─── STATS ──────────────────────────────────────────────────── */
function Stats() {
  const stats = [
    { n: "22 min", label: "Average time to fix a production incident" },
    { n: "4 hrs", label: "Same task without CodeScope" },
    { n: "Day 4", label: "When new developers make their first PR" },
    { n: "0", label: "Dependencies you'll miss before shipping" },
  ];
  return (
    <FadeIn>
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, borderTop: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
          {stats.map((s, i) => (
            <div key={i} style={{ padding: "36px 32px", borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: T.mono, fontSize: 28, fontWeight: 400, color: T.text, marginBottom: 10, letterSpacing: "-0.02em" }}>{s.n}</div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.faint, lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}

/* ─── FEATURES ───────────────────────────────────────────────── */
const FEATURES = [
  { tag: "01", title: "Architecture Explorer", desc: "Every service, module, and connection rendered as a navigable graph. Zoom from system-level down to a single function call." },
  { tag: "02", title: "Dependency Intelligence", desc: "Bidirectional dependency trees. See everything a function calls, and everything that calls it, across the entire codebase." },
  { tag: "03", title: "Change Impact Prediction", desc: "Before you touch anything — see the blast radius. Risk score, affected tests, downstream services, all in one report." },
  { tag: "04", title: "Git Intelligence", desc: "Every commit linked to every symbol it touched. AI-written summaries of intent, not just raw diff output." },
  { tag: "05", title: "Error Investigation", desc: "Paste a stack trace. CodeScope traces it through the dependency graph to the root file, annotated with who last changed it." },
  { tag: "06", title: "AI Code Assistant", desc: "Ask anything in plain English. Every answer cites a real file and line — no hallucination, no guesswork." },
  { tag: "07", title: "Knowledge Graph", desc: "Understand code by what it does — authentication, payments, notifications — not just where it lives in the file tree." },
  { tag: "08", title: "Command Center", desc: "⌘K from anywhere. Jump to any file, function, feature, or action. Keyboard-first workflows for engineers who don't touch the mouse." },
];

function Features() {
  const [hovered, setHovered] = useState(null);
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 40px" }}>
      <FadeIn>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 60, paddingBottom: 32, borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ fontFamily: T.serif, fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 400, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0, maxWidth: 360 }}>
            Everything you need. Nothing you don't.
          </h2>
          <p style={{ fontFamily: T.sans, fontSize: 14, color: T.faint, maxWidth: 280, lineHeight: 1.6, margin: 0, textAlign: "right" }}>
            Eight precise tools, each solving one well-defined problem in the developer workflow.
          </p>
        </div>
      </FadeIn>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderLeft: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}` }}>
        {FEATURES.map((f, i) => (
          <FadeIn key={f.title} delay={i * 50}>
            <div
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: "32px 36px", borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
                background: hovered === i ? T.surface : "transparent",
                transition: "background 0.2s ease", cursor: "default"
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <h3 style={{ fontFamily: T.sans, fontSize: 14.5, fontWeight: 500, color: T.text, margin: 0, letterSpacing: "-0.01em" }}>{f.title}</h3>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.faint, marginLeft: 12, marginTop: 2 }}>{f.tag}</span>
              </div>
              <p style={{ fontFamily: T.sans, fontSize: 13.5, color: T.faint, lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ───────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { title: "Connect your repository", body: "Link GitHub, GitLab, or Bitbucket. Or upload a ZIP. One step — no configuration files, no agents to install." },
    { title: "Automatic deep analysis", body: "Tree-sitter parses every file in every supported language. The full call graph is built in the background via Celery workers — you don't wait." },
    { title: "Explore the live graph", body: "Architecture, dependencies, git history, and business workflow maps are ready the moment analysis finishes. Your codebase is now legible." },
    { title: "Ask, investigate, ship", body: "Use the AI assistant, run an impact analysis before any change, trace a production error to its root — all without leaving the platform." },
  ];
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 40px" }}>
      <FadeIn>
        <div style={{ marginBottom: 60, paddingBottom: 32, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.faint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>How it works</div>
          <h2 style={{ fontFamily: T.serif, fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 400, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 480, margin: 0 }}>
            From repository to full understanding in under five minutes.
          </h2>
        </div>
      </FadeIn>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => (
          <FadeIn key={s.title} delay={i * 100}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 32, padding: "32px 0", borderBottom: `1px solid ${T.border}`, alignItems: "start" }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.faint, paddingTop: 4 }}>0{i + 1}</div>
              <div>
                <h3 style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 500, color: T.text, margin: "0 0 10px", letterSpacing: "-0.01em" }}>{s.title}</h3>
                <p style={{ fontFamily: T.sans, fontSize: 14, color: T.faint, lineHeight: 1.7, margin: 0, maxWidth: 520 }}>{s.body}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

/* ─── TESTIMONIAL ────────────────────────────────────────────── */
function Quote() {
  return (
    <FadeIn>
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 40px" }}>
        <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "64px 0" }}>
          <blockquote style={{ fontFamily: T.serif, fontSize: "clamp(22px,3vw,34px)", fontWeight: 400, color: T.text, lineHeight: 1.35, letterSpacing: "-0.015em", margin: "0 0 32px", maxWidth: 720 }}>
            "I fixed a production payment failure in 22 minutes. Same task took me four hours six months ago. The difference is just having a map."
          </blockquote>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 11, color: T.faint }}>R</div>
            <div>
              <div style={{ fontFamily: T.sans, fontSize: 13.5, color: T.text, fontWeight: 500 }}>Riya Sharma</div>
              <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.faint }}>Senior Backend Engineer · Fintech</div>
            </div>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ─── APP PREVIEW ────────────────────────────────────────────── */
function AppPreview() {
  const [tab, setTab] = useState(0);
  const tabs = ["Architecture", "Dependencies", "Impact analysis", "AI assistant"];
  return (
    <FadeIn>
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 40px 80px" }}>
        <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.faint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Product</div>
          <h2 style={{ fontFamily: T.serif, fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 400, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0 }}>
            Built for the way engineers actually think.
          </h2>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: `1px solid ${T.border}` }}>
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: "10px 20px", fontFamily: T.sans, fontSize: 13, cursor: "pointer",
              color: tab === i ? T.text : T.faint,
              background: "none", border: "none",
              borderBottom: tab === i ? `1px solid ${T.text}` : "1px solid transparent",
              marginBottom: -1, transition: "color 0.15s"
            }}>{t}</button>
          ))}
        </div>

        {/* Shell */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
          {/* Window chrome */}
          <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", gap: 6, alignItems: "center" }}>
            {["rgba(240,239,236,0.28)","rgba(240,239,236,0.20)","rgba(240,239,236,0.14)"].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
            <div style={{ marginLeft: 12, fontFamily: T.mono, fontSize: 11, color: T.faint }}>
              codescope.ai · {tabs[tab].toLowerCase()}
            </div>
          </div>

          {/* Sidebar + content */}
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: 380 }}>
            <div style={{ borderRight: `1px solid ${T.border}`, padding: "20px 0" }}>
              {["Dashboard","Architecture","Dependencies","Git Timeline","Impact Analysis","Error Investigation","AI Assistant","Settings"].map((item, i) => (
                <div key={item} style={{
                  padding: "7px 20px", fontSize: 12.5, fontFamily: T.sans, cursor: "pointer",
                  color: item.toLowerCase() === tabs[tab].toLowerCase() ? T.text : T.faint,
                  background: item.toLowerCase() === tabs[tab].toLowerCase() ? T.accentSoft : "transparent",
                  borderLeft: item.toLowerCase() === tabs[tab].toLowerCase() ? `1px solid ${T.text}` : "1px solid transparent",
                }}>
                  {item}
                </div>
              ))}
            </div>

            <div style={{ padding: 32 }}>
              {tab === 0 && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                    {[["Modules","248"],["Functions","4,821"],["Edges","14,302"],["Risk","Low"]].map(([k,v]) => (
                      <div key={k} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "14px 16px" }}>
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.faint, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
                        <div style={{ fontFamily: T.mono, fontSize: 20, color: T.text }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      {[...Array(18)].map((_, i) => {
                        const sizes = [3,5,4,6,3,4,7,4,5,3,6,4,3,5,4,6,3,4];
                        return (
                          <div key={i} style={{ position: "relative" }}>
                            <div style={{ width: sizes[i]*5, height: sizes[i]*5, borderRadius: "50%", border: `1px solid ${T.border}`, background: i % 4 === 0 ? T.accentSoft : "rgba(240,239,236,0.035)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 3, height: 3, borderRadius: "50%", background: i % 4 === 0 ? T.accent : T.faint }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontFamily: T.mono, fontSize: 10, color: T.faint, textAlign: "center" }}>architecture graph · 248 nodes · 14,302 edges</div>
                </div>
              )}
              {tab === 1 && (
                <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.faint, lineHeight: 2 }}>
                  <div style={{ color: T.text, marginBottom: 12, fontSize: 13, fontFamily: T.sans }}>PaymentService.processCharge</div>
                  <div>├── BillingAdapter.charge</div>
                  <div style={{ paddingLeft: 20 }}>├── StripeClient.createCharge</div>
                  <div style={{ paddingLeft: 20 }}>└── RetryHandler.withBackoff</div>
                  <div>├── AuditLogger.log</div>
                  <div>└── NotificationService.send</div>
                  <div style={{ paddingLeft: 20 }}>└── EmailProvider.dispatch</div>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}`, color: T.accent }}>6 downstream services · last changed 3 days ago</div>
                </div>
              )}
              {tab === 2 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
                    <span style={{ fontFamily: T.sans, fontSize: 14, color: T.text }}>Risk: Low</span>
                    <span style={{ fontFamily: T.mono, fontSize: 12, color: T.faint }}>· 0 critical paths affected</span>
                  </div>
                  {[["Affected services","6"],["Tests to run","14"],["Files changed","3"],["Breaking changes","0"]].map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}`, fontFamily: T.sans, fontSize: 13 }}>
                      <span style={{ color: T.faint }}>{k}</span>
                      <span style={{ color: T.text, fontFamily: T.mono }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {tab === 3 && (
                <div style={{ fontFamily: T.mono, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px 14px", color: T.faint }}>
                    $ Why is PaymentService failing in production?
                  </div>
                  <div style={{ background: T.accentSoft, border: `1px solid rgba(43,92,82,0.18)`, borderRadius: 6, padding: "14px 16px", color: T.dim, lineHeight: 1.7, fontSize: 12 }}>
                    Root cause is in <span style={{ color: T.accent }}>BillingAdapter.processCharge:142</span> — a null check was removed in commit <span style={{ color: T.accent }}>a3f9b21</span> (3 days ago, Arjun). This causes a NullPointerException when StripeClient returns an empty response on rate-limit. The fix is a 2-line guard clause. Blast radius: 6 services, 14 tests.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "8px 12px", fontFamily: T.mono, fontSize: 12, color: T.text, outline: "none" }} placeholder="Ask anything about the codebase..." />
                    <button style={{ background: T.text, color: T.bg, border: "none", borderRadius: 5, padding: "8px 14px", fontFamily: T.mono, fontSize: 12, cursor: "pointer" }}>→</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ─── CTA ────────────────────────────────────────────────────── */
function CTA({ onEnterApp }) {
  return (
    <FadeIn>
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 40px 120px" }}>
        <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "80px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontFamily: T.serif, fontSize: "clamp(28px,3.5vw,48px)", fontWeight: 400, color: T.text, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 16px" }}>
              Your codebase is a map.<br /><em style={{ fontStyle: "italic", color: T.accent }}>Start reading it.</em>
            </h2>
            <p style={{ fontFamily: T.sans, fontSize: 14, color: T.faint, lineHeight: 1.7, margin: 0 }}>
              Free to start. No credit card. Works with any Git repository.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); onEnterApp?.("app"); }} style={{
              color: T.bg, background: T.text, fontSize: 14, padding: "13px 28px",
              borderRadius: 5, textDecoration: "none", fontWeight: 500, fontFamily: T.sans,
              textAlign: "center", letterSpacing: "-0.01em"
            }}>Get started free</a>
            <a href="#" style={{
              color: T.faint, fontSize: 13, padding: "12px 28px",
              textDecoration: "none", fontFamily: T.sans, textAlign: "center",
              border: `1px solid ${T.border}`, borderRadius: 5
            }}>Request a demo</a>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ─── FOOTER ─────────────────────────────────────────────────── */
function Footer() {
  const cols = {
    Product: ["Features","Pricing","Changelog","Roadmap"],
    Company: ["About","Blog","Careers","Contact"],
    Resources: ["Documentation","API Reference","GitHub","Status"],
    Legal: ["Privacy","Terms","Security"],
  };
  return (
    <footer style={{ borderTop: `1px solid ${T.border}`, maxWidth: 1080, margin: "0 auto", padding: "60px 40px 48px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="1" width="18" height="18" rx="4" stroke={T.accent} strokeWidth="1.2"/>
              <path d="M5 10h10M10 5v10" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ color: T.text, fontSize: 13, fontWeight: 500, fontFamily: T.sans }}>CodeScope AI</span>
          </div>
          <p style={{ fontFamily: T.sans, fontSize: 13, color: T.faint, lineHeight: 1.6, maxWidth: 220 }}>
            Google Maps for codebases. Understand any system, instantly.
          </p>
        </div>
        {Object.entries(cols).map(([heading, links]) => (
          <div key={heading}>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.faint, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>{heading}</div>
            {links.map(l => (
              <a key={l} href="#" style={{ display: "block", fontFamily: T.sans, color: T.faint, fontSize: 13, textDecoration: "none", marginBottom: 9, transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = T.dim}
                onMouseLeave={e => e.target.style.color = T.faint}
              >{l}</a>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontFamily: T.sans, fontSize: 12, color: T.faint }}>© 2026 CodeScope AI</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.faint }}>v1.0 · beta</span>
      </div>
    </footer>
  );
}

/* ─── ROOT ───────────────────────────────────────────────────── */
export default function App({ onEnterApp }) {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: T.sans }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(43,92,82,0.18); }
        @media (max-width: 860px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
      <Nav onEnterApp={onEnterApp} />
      <Hero onEnterApp={onEnterApp} />
      <Stats />
      <Divider />
      <Features />
      <Divider />
      <HowItWorks />
      <Quote />
      <AppPreview />
      <CTA onEnterApp={onEnterApp} />
      <Footer />
    </div>
  );
}
