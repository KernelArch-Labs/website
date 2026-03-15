import { useState, useEffect, useRef, useCallback } from "react";

/* ===================================================================
   KERNEL ARCH LABS -- Research Foundation Website
   Light minimalistic grey theme, real logo, working navigation.
   
   Scalability:
   - PROJECTS_DATA array: add new projects by adding objects.
   - Sections are self-contained components.
   - Future: React Router for per-project pages, deployment dashboards.
   =================================================================== */

const LOGO_B64 = "data:image/jpeg;base64,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";

const SZ_LINKEDIN = "https://www.linkedin.com/company/kernelarch-labs";

const LOGO_PATH_UNUSED = "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";

// ---- DESIGN TOKENS: LIGHT GREY THEME ----

const CLR = {
  szRed: "#c0392b",
  szRedDark: "#922b21",
  szRedLight: "#e74c3c",
  szBg: "#f2f1ef",
  szSurface: "#eaeae8",
  szCard: "#ffffff",
  szCardHover: "#fafafa",
  szTextPrimary: "#1a1a1a",
  szTextSecondary: "#5a5a5a",
  szTextDim: "#999999",
  szBorder: "#d8d8d6",
  szBorderHover: "#b0b0ae",
};

// ---- DATA ----

const PROJECTS_DATA = [
  {
    szId: "astra-runtime",
    szTitle: "Astra Runtime",
    szTag: "Systems Research",
    szVersion: "v2.0",
    szOneLiner: "Capability-based AI-augmented userspace runtime for Linux",
    szDescription:
      "A modular userspace runtime implementing microkernel architecture principles in C++23 and hand-tuned x86-64 Assembly. Unifies capability-based security, zero-copy IPC, lightweight isolation, checkpoint/restore, deterministic replay, adaptive memory management, AI-driven scheduling, and WebAssembly sandboxing into one cohesive platform.",
    szStatus: "Architecture Phase",
    vStack: ["C++23", "x86-64 ASM", "eBPF", "ONNX Runtime", "Wasmtime", "TLA+", "Coq"],
    vMetrics: [
      { szLabel: "Modules", szValue: "21" },
      { szLabel: "Engineers", szValue: "10" },
      { szLabel: "Papers Planned", szValue: "14" },
      { szLabel: "Est. LOC", szValue: "423k-643k" },
    ],
    vKeyPoints: [
      "Seven concentric defence layers for running untrusted code",
      "Sub-200ns IPC latency with cryptographic message integrity",
      "Deterministic forensic replay for post-incident analysis",
      "AI anomaly detection trained on runtime behavioural traces",
      "Formal verification of security properties in Coq and Lean 4",
    ],
    szTimeline: "30-48 months",
    szRepo: "github.com/KernelArch-Lab/astra-runtime",
  },
  {
    szId: "options-sim",
    szTitle: "Options Market-Making Simulator",
    szTag: "Quantitative Finance",
    szVersion: "v1.0",
    szOneLiner: "Full-stack market-making pipeline -- math first, code second",
    szDescription:
      "A simulator covering the entire market-making pipeline from probability foundations to a live trading tournament. Every module begins as a mathematical derivation on paper before any code is written. Covers pricing, order books, strategy, risk decomposition, and competitive evaluation.",
    szStatus: "Active Build",
    vStack: ["C++17", "Python", "React", "D3.js", "PostgreSQL", "TimescaleDB", "WebSocket"],
    vMetrics: [
      { szLabel: "Modules", szValue: "5" },
      { szLabel: "Duration", szValue: "14 weeks" },
      { szLabel: "MC Sims", szValue: "1000" },
      { szLabel: "Team", szValue: "2" },
    ],
    vKeyPoints: [
      "Black-Scholes derived from binomial model on paper first",
      "C++ lock-free matching engine at nanosecond precision",
      "Avellaneda-Stoikov optimal quoting with HJB equation",
      "P&L decomposition via Taylor expansion into Greeks",
      "Tournament bracket evaluated on Sharpe ratio, not raw P&L",
    ],
    szTimeline: "14 weeks",
    szRepo: "github.com/KernelArch-Lab/options-sim",
  },
  {
    szId: "drift",
    szTitle: "Drift",
    szTag: "AI & Interactive Systems",
    szVersion: "v0.1",
    szOneLiner: "AI-driven mobile experience built from scratch on Unity",
    szDescription:
      "A mobile-first interactive experience for iOS and Android built in Unity with a low-poly art style optimized to run on any smartphone. Combines handcrafted game systems with multi-model AI integration to create dynamic, context-aware interactions that feel alive. Designed around an offline-first philosophy where every feature works without internet and AI acts as an enhancement layer.",
    szStatus: "Early Development",
    vStack: ["Unity", "C#", "Gemini API", "Groq / Llama", "Claude API"],
    vMetrics: [
      { szLabel: "Phases", szValue: "4" },
      { szLabel: "Duration", szValue: "16 weeks" },
      { szLabel: "Target Size", szValue: "<300MB" },
      { szLabel: "Team", szValue: "2" },
    ],
    vKeyPoints: [
      "Multi-model AI architecture with tiered conversation system",
      "Persistent memory system for context-aware AI interactions",
      "Offline-first design — every feature works without internet",
      "Low-poly art style optimized for broad device compatibility",
      "Phased 16-week build: prototype, core systems, expansion, polish",
    ],
    szTimeline: "16 weeks",
    szRepo: "github.com/KernelArch-Lab/drift",
  },
];

const RESEARCH_DOMAINS = [
  { szTitle: "Systems & Runtimes", szBody: "Microkernel architectures, memory allocators, lock-free IPC, eBPF observability, and userspace isolation primitives." },
  { szTitle: "Cryptographic Engineering", szBody: "Constant-time implementations, authenticated encryption, digital signatures, and hardware-accelerated crypto via AES-NI." },
  { szTitle: "Formal Verification", szBody: "Mechanised proofs in Coq and Lean 4, TLA+ model checking, bounded verification for real codebases." },
  { szTitle: "Applied Mathematics", szBody: "Stochastic calculus, probability theory, numerical PDE solvers, Monte Carlo methods, and optimisation under uncertainty." },
  { szTitle: "Machine Learning", szBody: "Anomaly detection, adversarial robustness, predictive scheduling, and learned resource management from system traces." },
  { szTitle: "Quantitative Finance", szBody: "Options pricing, market microstructure, inventory risk, volatility modelling, and optimal execution strategies." },
  { szTitle: "AI & Interactive Systems", szBody: "Multi-model AI orchestration, persistent memory architectures, tiered conversation systems, and offline-first mobile experiences." },
];

const PUBLICATION_TARGETS = [
  "USENIX ATC", "EuroSys", "OSDI", "SOSP", "USENIX Security",
  "IEEE S&P", "CCS", "NDSS", "POPL", "CAV", "ISMM", "ACSAC",
  "USENIX FAST", "USENIX NSDI",
];

// Papers: add entries here as they get published. szStatus can be
// "Planned", "In Progress", "Submitted", "Accepted", "Published".
// Once published, add szPdfUrl for the download link.

const PAPERS_DATA = [
  { szId: "P1", szTitle: "Astra Runtime: A Capability-Based Userspace Microkernel in C++", szVenue: "USENIX ATC / EuroSys", szModules: "M-01, M-02, M-03", szStatus: "Planned", szAbstract: "Presents the overall architecture of a capability-based userspace runtime implementing microkernel principles in C++23 without kernel modifications.", szPdfUrl: null },
  { szId: "P2", szTitle: "Zero-Copy IPC with Cryptographic Integrity in Userspace", szVenue: "USENIX FAST", szModules: "M-03, M-21", szStatus: "Planned", szAbstract: "Demonstrates sub-200ns IPC latency with HMAC-SHA256 integrity on every message using hardware-accelerated Assembly routines.", szPdfUrl: null },
  { szId: "P3", szTitle: "Deterministic Replay Without Kernel Support", szVenue: "OSDI / SOSP", szModules: "M-04, M-05", szStatus: "Planned", szAbstract: "Enables exact byte-for-byte replay of recorded execution including all syscall results, signal delivery, and scheduling decisions for forensic analysis.", szPdfUrl: null },
  { szId: "P4", szTitle: "Learned Memory Allocation with Security Hardening", szVenue: "ISMM", szModules: "M-06, M-08, M-21", szStatus: "Planned", szAbstract: "Extends a custom slab/arena allocator with ML-driven fragmentation prediction and secure deallocation via Assembly memory wiping.", szPdfUrl: null },
  { szId: "P5", szTitle: "ML-Driven Task Scheduling in a Capability Runtime", szVenue: "EuroSys", szModules: "M-07, M-08", szStatus: "Planned", szAbstract: "A lightweight gradient-boosted model predicts optimal task placement across cores and NUMA nodes before scheduling.", szPdfUrl: null },
  { szId: "P6", szTitle: "eBPF-Based Intrusion Detection for Userspace Runtimes", szVenue: "Linux Plumbers / RAID", szModules: "M-09, M-08.3", szStatus: "Planned", szAbstract: "Zero-overhead production telemetry using eBPF programs as an intrusion detection sensor network for runtime security.", szPdfUrl: null },
  { szId: "P7", szTitle: "WASM as a First-Class Isolation Primitive", szVenue: "IEEE S&P", szModules: "M-02, M-10", szStatus: "Planned", szAbstract: "Running untrusted code as WASM modules with capability-scoped access, fuel metering, and linear memory caps.", szPdfUrl: null },
  { szId: "P8", szTitle: "Formal Verification of a Userspace Capability Model", szVenue: "POPL / CAV", szModules: "M-01, M-12", szStatus: "Planned", szAbstract: "Mechanised proofs in Coq and Lean 4 for capability confinement, revocation completeness, and non-interference.", szPdfUrl: null },
  { szId: "P9", szTitle: "A Secure Userspace TCP/IP Stack with Capability-Scoped Sockets", szVenue: "USENIX NSDI", szModules: "M-13", szStatus: "Planned", szAbstract: "Per-task virtual routing tables, built-in stateful firewall, DNS anomaly detection, and mandatory TLS 1.3 for external connections.", szPdfUrl: null },
  { szId: "P10", szTitle: "Raft-Based State Replication in a Distributed Userspace Runtime", szVenue: "USENIX ATC", szModules: "M-15, M-04", szStatus: "Planned", szAbstract: "From-scratch Raft consensus in C++ with encrypted and signed messages for coordinating distributed runtime state.", szPdfUrl: null },
  { szId: "P11", szTitle: "Cryptographic Capability Delegation Across Distributed Nodes", szVenue: "IEEE S&P / CCS", szModules: "M-18, M-15", szStatus: "Planned", szAbstract: "Ed25519-signed capability tokens with embedded permission bitmasks delegated securely across networked runtime instances.", szPdfUrl: null },
  { szId: "P12", szTitle: "Virtual Time: Deterministic Clocks for Userspace Runtimes", szVenue: "EuroSys", szModules: "M-19, M-05", szStatus: "Planned", szAbstract: "Per-task monotonic virtual clocks that can be paused, rewound, or accelerated for deterministic replay and time-dilation testing.", szPdfUrl: null },
  { szId: "P13", szTitle: "Constant-Time Assembly Primitives for Userspace Security Runtimes", szVenue: "USENIX Security / CCS", szModules: "M-21", szStatus: "Planned", szAbstract: "Hand-tuned x86-64 Assembly for AES-GCM, Ed25519, secure memory erasure, and CFI trampolines with verified timing invariance.", szPdfUrl: null },
  { szId: "P14", szTitle: "AI-Driven Anomaly Detection for Capability-Based Runtime Security", szVenue: "NDSS / ACSAC", szModules: "M-08.3, M-09", szStatus: "Planned", szAbstract: "LSTM autoencoder trained on clean execution traces detects syscall anomalies, memory corruption patterns, and DNS exfiltration.", szPdfUrl: null },
];

// ---- HOOKS ----

function useOnScreen(aOptions = {}) {
  const [bVisible, setVisible] = useState(false);
  const refEl = useRef(null);
  useEffect(() => {
    const lObs = new IntersectionObserver(
      ([lEntry]) => { if (lEntry.isIntersecting) setVisible(true); },
      { threshold: 0.08, ...aOptions }
    );
    const lNode = refEl.current;
    if (lNode) lObs.observe(lNode);
    return () => { if (lNode) lObs.unobserve(lNode); };
  }, []);
  return [refEl, bVisible];
}

function useHashRoute() {
  const [szRoute, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => {
    const fn = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return szRoute;
}

function navigateTo(szHash) {
  window.location.hash = szHash;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- PARTICLE NETWORK (light theme) ----

function ParticleNetwork() {
  const refCanvas = useRef(null);
  const refRaf = useRef(null);
  const refMouse = useRef({ fX: -9999, fY: -9999 });

  useEffect(() => {
    const lCanvas = refCanvas.current;
    if (!lCanvas) return;
    const lCtx = lCanvas.getContext("2d");
    const fnResize = () => { lCanvas.width = window.innerWidth; lCanvas.height = window.innerHeight; };
    fnResize();
    window.addEventListener("resize", fnResize);
    const fnMouse = (aEv) => { refMouse.current = { fX: aEv.clientX, fY: aEv.clientY }; };
    window.addEventListener("mousemove", fnMouse);

    const iCount = Math.min(Math.floor(window.innerWidth / 22), 60);
    const vNodes = [];
    for (let i = 0; i < iCount; i++) {
      vNodes.push({
        fX: Math.random() * lCanvas.width, fY: Math.random() * lCanvas.height,
        fVx: (Math.random() - 0.5) * 0.3, fVy: (Math.random() - 0.5) * 0.3,
        fR: Math.random() * 1.8 + 0.5, fAlpha: Math.random() * 0.25 + 0.08,
      });
    }
    const fLinkDist = 140;

    const fnDraw = () => {
      lCtx.clearRect(0, 0, lCanvas.width, lCanvas.height);
      const lM = refMouse.current;
      for (let i = 0; i < vNodes.length; i++) {
        const lN = vNodes[i];
        lN.fX += lN.fVx; lN.fY += lN.fVy;
        if (lN.fX < 0 || lN.fX > lCanvas.width) lN.fVx *= -1;
        if (lN.fY < 0 || lN.fY > lCanvas.height) lN.fVy *= -1;
        const fDmx = lM.fX - lN.fX, fDmy = lM.fY - lN.fY;
        const fDm = Math.sqrt(fDmx * fDmx + fDmy * fDmy);
        const bNear = fDm < 180;
        if (bNear) { const fF = (180 - fDm) / 180; lN.fVx -= (fDmx / fDm) * fF * 0.012; lN.fVy -= (fDmy / fDm) * fF * 0.012; }
        const fSpd = Math.sqrt(lN.fVx * lN.fVx + lN.fVy * lN.fVy);
        if (fSpd > 0.8) { lN.fVx = (lN.fVx / fSpd) * 0.8; lN.fVy = (lN.fVy / fSpd) * 0.8; }
        lCtx.beginPath();
        lCtx.arc(lN.fX, lN.fY, lN.fR, 0, Math.PI * 2);
        lCtx.fillStyle = bNear
          ? `rgba(192,57,43,${Math.min(lN.fAlpha + 0.4, 0.7)})`
          : `rgba(160,160,155,${lN.fAlpha})`;
        lCtx.fill();
        for (let j = i + 1; j < vNodes.length; j++) {
          const lO = vNodes[j];
          const fDx = lN.fX - lO.fX, fDy = lN.fY - lO.fY;
          const fD = Math.sqrt(fDx * fDx + fDy * fDy);
          if (fD < fLinkDist) {
            const fA = (1 - fD / fLinkDist) * 0.1;
            const bH = Math.sqrt((lM.fX - lN.fX) ** 2 + (lM.fY - lN.fY) ** 2) < 180 || Math.sqrt((lM.fX - lO.fX) ** 2 + (lM.fY - lO.fY) ** 2) < 180;
            lCtx.beginPath(); lCtx.moveTo(lN.fX, lN.fY); lCtx.lineTo(lO.fX, lO.fY);
            lCtx.strokeStyle = bH ? `rgba(192,57,43,${fA + 0.08})` : `rgba(170,170,165,${fA})`;
            lCtx.lineWidth = 0.6; lCtx.stroke();
          }
        }
      }
      refRaf.current = requestAnimationFrame(fnDraw);
    };
    fnDraw();
    return () => { window.removeEventListener("resize", fnResize); window.removeEventListener("mousemove", fnMouse); if (refRaf.current) cancelAnimationFrame(refRaf.current); };
  }, []);

  return <canvas ref={refCanvas} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}

// ---- REVEAL ----

function Reveal({ children, style = {}, iDelay = 0 }) {
  const [refEl, bVis] = useOnScreen();
  return (
    <div ref={refEl} style={{ opacity: bVis ? 1 : 0, transform: bVis ? "translateY(0)" : "translateY(36px)", transition: `opacity 0.7s ease ${iDelay}ms, transform 0.7s ease ${iDelay}ms`, ...style }}>
      {children}
    </div>
  );
}

// ---- GLITCH ----

function GlitchText({ szText, style = {} }) {
  const [szShow, setShow] = useState(szText);
  const refBusy = useRef(false);
  const fnGlitch = useCallback(() => {
    if (refBusy.current) return;
    refBusy.current = true;
    const szPool = "ABCDEF0123456789!@#$%&*<>{}[]";
    let iFrame = 0;
    const lInt = setInterval(() => {
      if (iFrame >= 7) { setShow(szText); refBusy.current = false; clearInterval(lInt); return; }
      setShow(szText.split("").map((c) => c === " " ? " " : Math.random() < 0.35 + iFrame * 0.09 ? c : szPool[Math.floor(Math.random() * szPool.length)]).join(""));
      iFrame++;
    }, 45);
  }, [szText]);
  return <span style={style} onMouseEnter={fnGlitch}>{szShow}</span>;
}

function Cursor() {
  return <span style={{ display: "inline-block", width: "2px", height: "0.9em", backgroundColor: CLR.szRed, marginLeft: "3px", animation: "cursorBlink 1s step-end infinite", verticalAlign: "text-bottom" }} />;
}

// ---- COUNTER ----

function AnimCounter({ szTarget, iDurationMs = 1200 }) {
  const [szDisplay, setDisplay] = useState("0");
  const [refEl, bVis] = useOnScreen();
  const refDone = useRef(false);
  useEffect(() => {
    if (!bVis || refDone.current) return;
    refDone.current = true;
    const lPure = szTarget.replace(/[^0-9]/g, "");
    if (!lPure) { setDisplay(szTarget); return; }
    const iTarget = parseInt(lPure, 10);
    const iStart = performance.now();
    const fnTick = (aNow) => {
      const fP = Math.min((aNow - iStart) / iDurationMs, 1);
      const fE = 1 - Math.pow(1 - fP, 3);
      setDisplay(szTarget.replace(lPure, String(Math.round(iTarget * fE))));
      if (fP < 1) requestAnimationFrame(fnTick);
    };
    requestAnimationFrame(fnTick);
  }, [bVis, szTarget, iDurationMs]);
  return <span ref={refEl}>{szDisplay}</span>;
}

// ---- SMOOTH SCROLL HELPER ----

function scrollTo(aHref) {
  const lEl = document.querySelector(aHref);
  if (lEl) lEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- NAV ----

function Nav() {
  const [bScrolled, setScrolled] = useState(false);
  const [bMenuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 50); window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn); }, []);

  const vLinks = [
    { szLabel: "Mission", szHref: "#mission", szType: "scroll" },
    { szLabel: "Research", szHref: "#research", szType: "scroll" },
    { szLabel: "Projects", szHref: "#projects", szType: "scroll" },
    { szLabel: "Papers", szHref: "#/papers", szType: "route" },
    { szLabel: "Collaborate", szHref: "#collaborate", szType: "scroll" },
  ];

  const fnHandleNav = (aLink) => {
    if (aLink.szType === "route") {
      navigateTo(aLink.szHref);
    } else {
      if (window.location.hash.startsWith("#/papers")) {
        window.location.hash = "#/";
        setTimeout(() => scrollTo(aLink.szHref), 100);
      } else {
        scrollTo(aLink.szHref);
      }
    }
  };

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: bScrolled ? "10px 32px" : "18px 32px",
      background: bScrolled ? "rgba(242,241,239,0.92)" : "transparent",
      backdropFilter: bScrolled ? "blur(14px)" : "none",
      borderBottom: bScrolled ? `1px solid ${CLR.szBorder}` : "1px solid transparent",
      transition: "all 0.3s ease",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => { window.location.hash = "#/"; window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        <img src="/logo.png" alt="Kernel Arch Labs" style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover" }} />
        <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "13px", fontWeight: 500, color: CLR.szTextPrimary, letterSpacing: "0.5px" }}>KERNEL ARCH LABS</span>
      </div>
      <div style={{ display: "flex", gap: "32px", alignItems: "center" }} className="nav-desktop">
        {vLinks.map((l) => (
          <a key={l.szLabel} href={l.szHref} onClick={(e) => { e.preventDefault(); fnHandleNav(l); }}
            style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szTextSecondary, textDecoration: "none", letterSpacing: "1px", textTransform: "uppercase", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.target.style.color = CLR.szRed)} onMouseLeave={(e) => (e.target.style.color = CLR.szTextSecondary)}>
            {l.szLabel}
          </a>
        ))}
      </div>
      <button className="nav-mobile-btn" onClick={() => setMenuOpen(!bMenuOpen)} style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: "8px" }}>
        <div style={{ width: "20px", height: "2px", backgroundColor: CLR.szTextPrimary, marginBottom: "5px", transition: "all 0.3s", transform: bMenuOpen ? "rotate(45deg) translateY(7px)" : "none" }} />
        <div style={{ width: "20px", height: "2px", backgroundColor: CLR.szTextPrimary, marginBottom: "5px", opacity: bMenuOpen ? 0 : 1, transition: "opacity 0.2s" }} />
        <div style={{ width: "20px", height: "2px", backgroundColor: CLR.szTextPrimary, transition: "all 0.3s", transform: bMenuOpen ? "rotate(-45deg) translateY(-7px)" : "none" }} />
      </button>
      {bMenuOpen && (
        <div style={{ position: "fixed", top: "56px", left: 0, right: 0, bottom: 0, background: "rgba(242,241,239,0.97)", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "28px", zIndex: 99 }}>
          {vLinks.map((l) => (
            <a key={l.szLabel} href={l.szHref} onClick={(e) => { e.preventDefault(); setMenuOpen(false); fnHandleNav(l); }}
              style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "16px", color: CLR.szTextSecondary, textDecoration: "none", letterSpacing: "2px", textTransform: "uppercase" }}>
              {l.szLabel}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

// ---- HERO ----

function HeroSection() {
  const [bLoaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);

  return (
    <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: "120px 24px 80px", textAlign: "center" }}>
      <div style={{ opacity: bLoaded ? 1 : 0, transform: bLoaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease 0.2s", marginBottom: "28px" }}>
        <img src="/logo.png" alt="Kernel Arch Labs" style={{ width: "80px", height: "80px", borderRadius: "14px", objectFit: "cover", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }} />
      </div>
      <div style={{ opacity: bLoaded ? 1 : 0, transform: bLoaded ? "translateY(0)" : "translateY(15px)", transition: "all 0.7s ease 0.35s", marginBottom: "20px" }}>
        <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "4px", textTransform: "uppercase", padding: "6px 16px", border: "1px solid rgba(192,57,43,0.3)", borderRadius: "2px" }}>
          Research Foundation
        </span>
      </div>
      <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(44px, 7.5vw, 88px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.05, margin: "0 0 24px", opacity: bLoaded ? 1 : 0, transform: bLoaded ? "translateY(0)" : "translateY(30px)", transition: "all 0.9s ease 0.5s", maxWidth: "850px" }}>
        <GlitchText szText="Kernel Arch Labs" />
      </h1>
      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "clamp(16px, 2vw, 20px)", color: CLR.szTextSecondary, lineHeight: 1.65, maxWidth: "600px", margin: "0 0 16px", opacity: bLoaded ? 1 : 0, transform: bLoaded ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s ease 0.7s" }}>
        We collaborate with engineers and mathematicians to research, develop, and solve real-world problems -- from operating system internals to quantitative finance.
      </p>
      <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "13px", color: CLR.szTextDim, opacity: bLoaded ? 1 : 0, transition: "opacity 1s ease 1s", marginBottom: "44px" }}>
        <span style={{ color: CLR.szRed }}>$</span> Collaborate. Contribute. Build open systems that matter.<Cursor />
      </div>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center", opacity: bLoaded ? 1 : 0, transform: bLoaded ? "translateY(0)" : "translateY(15px)", transition: "all 0.7s ease 1.2s" }}>
        <button onClick={() => scrollTo("#projects")} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", padding: "11px 26px", backgroundColor: CLR.szRed, color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer", letterSpacing: "0.5px", transition: "background 0.2s" }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = CLR.szRedDark)} onMouseLeave={(e) => (e.target.style.backgroundColor = CLR.szRed)}>
          View Projects
        </button>
        <button onClick={() => scrollTo("#collaborate")} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", padding: "11px 26px", backgroundColor: "transparent", color: CLR.szTextSecondary, border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.5px", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.target.style.borderColor = CLR.szRed; e.target.style.color = CLR.szTextPrimary; }}
          onMouseLeave={(e) => { e.target.style.borderColor = CLR.szBorder; e.target.style.color = CLR.szTextSecondary; }}>
          Join Us
        </button>
      </div>
      <div style={{ position: "absolute", bottom: "32px", opacity: bLoaded ? 0.35 : 0, transition: "opacity 1.5s ease 2s", animation: "floatY 2.5s ease-in-out infinite" }}>
        <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
          <rect x="1" y="1" width="18" height="26" rx="9" stroke={CLR.szTextDim} strokeWidth="1.5" />
          <circle cx="10" cy="8" r="2" fill={CLR.szRed}><animate attributeName="cy" values="8;18;8" dur="2.5s" repeatCount="indefinite" /></circle>
        </svg>
      </div>
    </section>
  );
}

// ---- MISSION ----

function MissionSection() {
  const vPillars = [
    { szNum: "01", szTitle: "First Principles", szBody: "No code until the math is solved. No abstractions until the problem is understood. We derive before we implement." },
    { szNum: "02", szTitle: "Open Collaboration", szBody: "Every contributor owns real modules, publishes real papers, and builds real skills. This is not a tutorial -- it is production infrastructure." },
    { szNum: "03", szTitle: "Publication-Ready", szBody: "Research output is a first-class goal. Projects target top-tier venues from the first commit, not as an afterthought." },
  ];
  return (
    <section id="mission" style={{ position: "relative", zIndex: 1, padding: "100px 24px", maxWidth: "1000px", margin: "0 auto" }}>
      <Reveal><div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>// What we do</div></Reveal>
      <Reveal iDelay={100}><h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(30px, 5vw, 50px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.15, margin: "0 0 28px", maxWidth: "700px" }}>Open research. Real problems. No shortcuts.</h2></Reveal>
      <Reveal iDelay={200}><p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "16px", color: CLR.szTextSecondary, lineHeight: 1.75, maxWidth: "660px", margin: "0 0 24px" }}>Kernel Arch Labs is a research foundation where engineers, mathematicians, and builders come together to tackle problems that matter. We are not a product company. We do not chase trends. Every project starts from first principles and earns its complexity through rigorous thinking.</p></Reveal>
      <Reveal iDelay={280}><p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "16px", color: CLR.szTextSecondary, lineHeight: 1.75, maxWidth: "660px", margin: "0 0 48px" }}>Our projects span operating system internals, quantitative finance, formal verification, applied machine learning, and anything else where deep technical work can produce genuine contributions.</p></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
        {vPillars.map((p, i) => (
          <Reveal key={p.szNum} iDelay={360 + i * 100}>
            <div style={{ padding: "24px 22px", borderLeft: `2px solid ${CLR.szBorder}`, transition: "border-color 0.3s", cursor: "default" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = CLR.szRed)} onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = CLR.szBorder)}>
              <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "2px" }}>{p.szNum}</span>
              <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "21px", fontWeight: 400, color: CLR.szTextPrimary, margin: "8px 0 6px" }}>{p.szTitle}</h3>
              <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.65, margin: 0 }}>{p.szBody}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---- RESEARCH ----

function ResearchSection() {
  const [iHov, setHov] = useState(-1);
  return (
    <section id="research" style={{ position: "relative", zIndex: 1, padding: "100px 24px", maxWidth: "1100px", margin: "0 auto" }}>
      <Reveal><div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>// Research domains</div></Reveal>
      <Reveal iDelay={100}><h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.15, margin: "0 0 44px" }}>Where we focus</h2></Reveal>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1px", backgroundColor: CLR.szBorder, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px", overflow: "hidden" }}>
        {RESEARCH_DOMAINS.map((d, i) => {
          const iTotal = RESEARCH_DOMAINS.length;
          const iCols = 3;
          const iLastRowCount = iTotal % iCols || iCols;
          const iLastRowStart = iTotal - iLastRowCount;
          const bLastRow = i >= iLastRowStart;
          const flBasis = bLastRow ? `calc(${100 / iLastRowCount}% - ${(iLastRowCount - 1) / iLastRowCount}px)` : `calc(${100 / iCols}% - ${(iCols - 1) / iCols}px)`;
          return (
            <Reveal key={d.szTitle} iDelay={i * 70}>
              <div style={{ padding: "28px 24px", backgroundColor: iHov === i ? CLR.szCardHover : CLR.szCard, transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)", cursor: "default", minHeight: "150px", display: "flex", flexDirection: "column", flexBasis: flBasis, flexGrow: 0, flexShrink: 0, transform: iHov === i ? "translateY(-2px)" : "translateY(0)" }}
                onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)}>
                <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: iHov === i ? CLR.szRed : CLR.szTextDim, letterSpacing: "2px", marginBottom: "10px", transition: "color 0.4s" }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "19px", fontWeight: 400, color: CLR.szTextPrimary, margin: "0 0 8px" }}>{d.szTitle}</h3>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.6, margin: 0, flex: 1 }}>{d.szBody}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// ---- PROJECT CARD ----

function ProjectCard({ aProject, iIdx }) {
  const [bExpanded, setExpanded] = useState(false);
  const [bHov, setHov] = useState(false);
  return (
    <Reveal iDelay={iIdx * 140}>
      <div style={{ border: `1px solid ${bHov ? CLR.szBorderHover : CLR.szBorder}`, backgroundColor: CLR.szCard, transition: "all 0.3s", borderRadius: "4px", overflow: "hidden", boxShadow: bHov ? "0 2px 16px rgba(0,0,0,0.04)" : "none" }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${CLR.szBorder}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
              <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "24px", fontWeight: 400, color: CLR.szTextPrimary, margin: 0 }}>{aProject.szTitle}</h3>
              <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, border: "1px solid rgba(192,57,43,0.3)", padding: "2px 8px", borderRadius: "2px", letterSpacing: "1px" }}>{aProject.szTag}</span>
            </div>
            <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "13.5px", color: CLR.szTextSecondary, margin: 0 }}>{aProject.szOneLiner}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1px" }}>{aProject.szVersion}</span>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: aProject.szStatus === "Active Build" ? "#27ae60" : "#f39c12" }} />
            <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim }}>{aProject.szStatus}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${aProject.vMetrics.length}, 1fr)`, borderBottom: `1px solid ${CLR.szBorder}` }}>
          {aProject.vMetrics.map((m, i) => (
            <div key={m.szLabel} style={{ padding: "16px 18px", borderRight: i < aProject.vMetrics.length - 1 ? `1px solid ${CLR.szBorder}` : "none", textAlign: "center" }}>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "22px", color: CLR.szTextPrimary }}><AnimCounter szTarget={m.szValue} /></div>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "9px", color: CLR.szTextDim, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "3px" }}>{m.szLabel}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 26px", borderBottom: `1px solid ${CLR.szBorder}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {aProject.vStack.map((t) => (
              <span key={t} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextSecondary, padding: "3px 9px", border: `1px solid ${CLR.szBorder}`, borderRadius: "2px", letterSpacing: "0.5px" }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ padding: "18px 26px" }}>
          <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "13.5px", color: CLR.szTextSecondary, lineHeight: 1.7, margin: "0 0 14px" }}>{aProject.szDescription}</p>
          <button onClick={() => setExpanded(!bExpanded)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "1px", padding: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            {bExpanded ? "- COLLAPSE" : "+ KEY HIGHLIGHTS"}
          </button>
          {bExpanded && (
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${CLR.szBorder}` }}>
              {aProject.vKeyPoints.map((pt, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, marginTop: "3px", flexShrink: 0 }}>{">"}</span>
                  <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.55 }}>{pt}</span>
                </div>
              ))}
              <div style={{ marginTop: "14px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1px" }}>TIMELINE: {aProject.szTimeline}</span>
                <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1px" }}>REPO: {aProject.szRepo}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

// ---- PROJECTS SECTION ----

function ProjectsSection() {
  return (
    <section id="projects" style={{ position: "relative", zIndex: 1, padding: "100px 24px", maxWidth: "1000px", margin: "0 auto" }}>
      <Reveal><div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>// Active projects</div></Reveal>
      <Reveal iDelay={100}><h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.15, margin: "0 0 10px" }}>What we are building</h2></Reveal>
      <Reveal iDelay={140}><p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "14.5px", color: CLR.szTextSecondary, lineHeight: 1.6, margin: "0 0 44px", maxWidth: "540px" }}>Each project is a long-term research effort with real deliverables, real papers, and real contributors. New projects are proposed through an open RFC process.</p></Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        {PROJECTS_DATA.map((p, i) => <ProjectCard key={p.szId} aProject={p} iIdx={i} />)}
      </div>
      <Reveal iDelay={380}>
        <div style={{ marginTop: "22px", border: `1px dashed ${CLR.szBorder}`, padding: "28px", textAlign: "center", borderRadius: "4px" }}>
          <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", color: CLR.szTextDim, letterSpacing: "1px" }}>+ MORE PROJECTS COMING -- PROPOSE VIA RFC</span>
        </div>
      </Reveal>
    </section>
  );
}

// ---- PUBLICATIONS ----

function PublicationsSection() {
  return (
    <section id="publications" style={{ position: "relative", zIndex: 1, padding: "80px 24px 100px", maxWidth: "1000px", margin: "0 auto" }}>
      <Reveal><div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>// Publications</div></Reveal>
      <Reveal iDelay={100}><h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.15, margin: "0 0 10px" }}>Built to publish</h2></Reveal>
      <Reveal iDelay={140}><p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "14.5px", color: CLR.szTextSecondary, lineHeight: 1.6, margin: "0 0 36px", maxWidth: "540px" }}>Every project is designed with publication as a first-class deliverable. We target top-tier systems, security, and applied mathematics venues.</p></Reveal>
      <Reveal iDelay={220}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "36px" }}>
          {PUBLICATION_TARGETS.map((v) => (
            <span key={v} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, padding: "5px 11px", border: `1px solid ${CLR.szBorder}`, borderRadius: "2px", letterSpacing: "0.8px", transition: "all 0.2s", cursor: "default" }}
              onMouseEnter={(e) => { e.target.style.borderColor = CLR.szRed; e.target.style.color = CLR.szRed; }}
              onMouseLeave={(e) => { e.target.style.borderColor = CLR.szBorder; e.target.style.color = CLR.szTextDim; }}>
              {v}
            </span>
          ))}
        </div>
      </Reveal>
      <Reveal iDelay={320}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", backgroundColor: CLR.szBorder, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px", overflow: "hidden" }}>
          {[{ szVal: "14", szLabel: "Papers Planned" }, { szVal: "14", szLabel: "Target Venues" }, { szVal: "3", szLabel: "Active Projects" }, { szVal: "12", szLabel: "Contributors" }].map((s) => (
            <div key={s.szLabel} style={{ padding: "22px 18px", backgroundColor: CLR.szCard, textAlign: "center" }}>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "30px", color: CLR.szTextPrimary }}><AnimCounter szTarget={s.szVal} /></div>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "9px", color: CLR.szTextDim, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "5px" }}>{s.szLabel}</div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal iDelay={400}>
        <div style={{ marginTop: "28px", textAlign: "center" }}>
          <button onClick={() => navigateTo("#/papers")} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", padding: "11px 26px", backgroundColor: "transparent", color: CLR.szTextSecondary, border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.5px", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.target.style.borderColor = CLR.szRed; e.target.style.color = CLR.szTextPrimary; }}
            onMouseLeave={(e) => { e.target.style.borderColor = CLR.szBorder; e.target.style.color = CLR.szTextSecondary; }}>
            View All 14 Planned Papers &rarr;
          </button>
        </div>
      </Reveal>
    </section>
  );
}

// ---- COLLABORATE ----

function CollaborateSection() {
  const vItems = [
    { szTitle: "Propose a project", szBody: "Submit an RFC with problem statement, research goals, and timeline. If it passes review, it becomes an official lab project." },
    { szTitle: "Join existing work", szBody: "Pick an unclaimed module on any active project. You get full ownership -- design, implementation, testing, publication." },
    { szTitle: "Peer review", szBody: "Review PRs, audit security models, challenge assumptions. Critical feedback is as valuable as code contributions." },
  ];
  return (
    <section id="collaborate" style={{ position: "relative", zIndex: 1, padding: "80px 24px 120px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
      <Reveal><div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>// Get involved</div></Reveal>
      <Reveal iDelay={100}><h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.15, margin: "0 0 18px" }}>We build in the open.<br /><span style={{ color: CLR.szRed }}>Join us.</span></h2></Reveal>
      <Reveal iDelay={180}><p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, margin: "0 auto 36px", maxWidth: "520px" }}>If you are an engineer, a mathematician, a researcher, or just someone who cares about building things that work at a deep level -- we want to hear from you.</p></Reveal>
      <Reveal iDelay={260}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "44px", textAlign: "left" }}>
          {vItems.map((item) => (
            <div key={item.szTitle} style={{ padding: "22px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px", transition: "border-color 0.3s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = CLR.szBorderHover)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = CLR.szBorder)}>
              <h4 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "17px", fontWeight: 400, color: CLR.szTextPrimary, margin: "0 0 6px" }}>{item.szTitle}</h4>
              <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "12.5px", color: CLR.szTextSecondary, lineHeight: 1.6, margin: 0 }}>{item.szBody}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal iDelay={360}>
        <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "13px", color: CLR.szTextDim, padding: "18px 20px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szSurface, textAlign: "left", lineHeight: 1.8, borderRadius: "4px" }}>
          <span style={{ color: CLR.szRed }}>$</span> git clone github.com/KernelArch-Lab<br />
          <span style={{ color: CLR.szRed }}>$</span> cd astra-runtime && cat CONTRIBUTING.md<br />
          <span style={{ color: CLR.szTextDim }}># or reach out: reachout@kernelarch.com</span><br />
          <span style={{ color: CLR.szTextDim }}># follow us: linkedin.com/company/kernelarch-labs</span>
        </div>
      </Reveal>
    </section>
  );
}

// ---- FOOTER ----

function Footer() {
  return (
    <footer style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${CLR.szBorder}`, padding: "36px 24px", maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => { window.location.hash = "#/"; window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        <img src="/logo.png" alt="Kernel Arch Labs" style={{ width: "28px", height: "28px", borderRadius: "5px", objectFit: "cover" }} />
        <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szTextDim, letterSpacing: "0.5px" }}>KERNEL ARCH LABS</span>
      </div>
      <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "0.5px" }}>
        Open Source &middot; Research Foundation &middot; 2026
      </div>
      <div style={{ display: "flex", gap: "18px" }}>
        {[{ szLabel: "GitHub", szHref: "https://github.com/KernelArch-Lab" }, { szLabel: "LinkedIn", szHref: SZ_LINKEDIN }, { szLabel: "Papers", szHref: "#/papers" }, { szLabel: "Contact", szHref: "#collaborate" }].map((lnk) => (
          <a key={lnk.szLabel} href={lnk.szHref} target={lnk.szHref.startsWith("http") ? "_blank" : undefined} rel={lnk.szHref.startsWith("http") ? "noopener noreferrer" : undefined} onClick={(e) => { if (lnk.szHref === "#/papers") { e.preventDefault(); navigateTo("#/papers"); } else if (lnk.szHref.startsWith("#") && !lnk.szHref.startsWith("#/")) { e.preventDefault(); if (window.location.hash.startsWith("#/papers")) { window.location.hash = "#/"; setTimeout(() => scrollTo(lnk.szHref), 100); } else { scrollTo(lnk.szHref); } } }}
            style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, textDecoration: "none", letterSpacing: "1px", textTransform: "uppercase", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.target.style.color = CLR.szRed)} onMouseLeave={(e) => (e.target.style.color = CLR.szTextDim)}>
            {lnk.szLabel}
          </a>
        ))}
      </div>
    </footer>
  );
}

// ---- GLOBAL STYLES ----

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;1,8..60,400&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body { background-color: ${CLR.szBg}; color: ${CLR.szTextPrimary}; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
      ::selection { background: rgba(192,57,43,0.2); color: ${CLR.szTextPrimary}; }
      @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
      @media (max-width: 768px) {
        .nav-desktop { display: none !important; }
        .nav-mobile-btn { display: block !important; }
      }
    `}</style>
  );
}

// ---- PAPERS PAGE ----

function PapersPage() {
  const [szFilter, setFilter] = useState("All");
  const iPublished = PAPERS_DATA.filter((p) => p.szStatus === "Published").length;

  const vStatuses = ["All", ...new Set(PAPERS_DATA.map((p) => p.szStatus))];
  const vFiltered = szFilter === "All" ? PAPERS_DATA : PAPERS_DATA.filter((p) => p.szStatus === szFilter);

  const mStatusColor = {
    "Planned": { szBg: "rgba(243,156,18,0.1)", szText: "#f39c12", szBorder: "rgba(243,156,18,0.25)" },
    "In Progress": { szBg: "rgba(41,128,185,0.1)", szText: "#2980b9", szBorder: "rgba(41,128,185,0.25)" },
    "Submitted": { szBg: "rgba(142,68,173,0.1)", szText: "#8e44ad", szBorder: "rgba(142,68,173,0.25)" },
    "Accepted": { szBg: "rgba(39,174,96,0.1)", szText: "#27ae60", szBorder: "rgba(39,174,96,0.25)" },
    "Published": { szBg: "rgba(39,174,96,0.15)", szText: "#1e8449", szBorder: "rgba(39,174,96,0.35)" },
  };

  return (
    <section style={{ position: "relative", zIndex: 1, padding: "120px 24px 100px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Back link */}
      <button onClick={() => { window.location.hash = "#/"; }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szTextDim, letterSpacing: "1px", padding: "0 0 32px", display: "flex", alignItems: "center", gap: "6px" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = CLR.szRed)} onMouseLeave={(e) => (e.currentTarget.style.color = CLR.szTextDim)}>
        &larr; BACK TO HOME
      </button>

      {/* Header */}
      <Reveal>
        <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "14px" }}>
          // Research Papers
        </div>
      </Reveal>
      <Reveal iDelay={80}>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(32px, 5vw, 50px)", fontWeight: 400, color: CLR.szTextPrimary, lineHeight: 1.15, margin: "0 0 14px" }}>
          Publications
        </h1>
      </Reveal>
      <Reveal iDelay={140}>
        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "16px", color: CLR.szTextSecondary, lineHeight: 1.7, margin: "0 0 12px", maxWidth: "600px" }}>
          {iPublished > 0
            ? `${iPublished} of ${PAPERS_DATA.length} papers published so far. Each paper maps directly to modules in our active projects.`
            : `We have ${PAPERS_DATA.length} papers planned across our active projects. None have been published yet -- we are in the architecture and early implementation phase. This page will be updated as papers move through the pipeline.`
          }
        </p>
      </Reveal>

      {/* Stats row */}
      <Reveal iDelay={180}>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "36px", paddingBottom: "28px", borderBottom: `1px solid ${CLR.szBorder}` }}>
          {[
            { szVal: String(PAPERS_DATA.length), szLabel: "Total Papers" },
            { szVal: String(iPublished), szLabel: "Published" },
            { szVal: String(PAPERS_DATA.length - iPublished), szLabel: "In Pipeline" },
            { szVal: String(PUBLICATION_TARGETS.length), szLabel: "Target Venues" },
          ].map((s) => (
            <div key={s.szLabel} style={{ minWidth: "80px" }}>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "28px", color: CLR.szTextPrimary }}>{s.szVal}</div>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "9px", color: CLR.szTextDim, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "2px" }}>{s.szLabel}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Filter tabs */}
      <Reveal iDelay={220}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "28px" }}>
          {vStatuses.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px",
                padding: "5px 14px", border: `1px solid ${szFilter === s ? CLR.szRed : CLR.szBorder}`,
                borderRadius: "2px", letterSpacing: "0.8px", cursor: "pointer",
                backgroundColor: szFilter === s ? CLR.szRed : "transparent",
                color: szFilter === s ? "#fff" : CLR.szTextDim,
                transition: "all 0.2s",
              }}>
              {s}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Paper cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {vFiltered.map((lPaper, iIdx) => {
          const lColors = mStatusColor[lPaper.szStatus] || mStatusColor["Planned"];
          return (
            <Reveal key={lPaper.szId} iDelay={iIdx * 60}>
              <div style={{ border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px", padding: "24px 26px", transition: "border-color 0.3s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = CLR.szBorderHover)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = CLR.szBorder)}>
                {/* Top row: ID + status + venue */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1px", fontWeight: 500 }}>
                    {lPaper.szId}
                  </span>
                  <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "9px", padding: "2px 8px", borderRadius: "2px", letterSpacing: "0.5px", backgroundColor: lColors.szBg, color: lColors.szText, border: `1px solid ${lColors.szBorder}` }}>
                    {lPaper.szStatus}
                  </span>
                  <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "9px", color: CLR.szTextDim, letterSpacing: "0.5px" }}>
                    {lPaper.szVenue}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "19px", fontWeight: 400, color: CLR.szTextPrimary, margin: "0 0 8px", lineHeight: 1.35 }}>
                  {lPaper.szTitle}
                </h3>

                {/* Abstract */}
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.6, margin: "0 0 12px" }}>
                  {lPaper.szAbstract}
                </p>

                {/* Bottom row: modules + PDF link */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "0.5px" }}>
                    Modules: {lPaper.szModules}
                  </span>
                  {lPaper.szPdfUrl ? (
                    <a href={lPaper.szPdfUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, textDecoration: "none", letterSpacing: "0.5px" }}>
                      DOWNLOAD PDF &darr;
                    </a>
                  ) : (
                    <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, fontStyle: "italic" }}>
                      Not yet available
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Target venues */}
      <Reveal iDelay={300}>
        <div style={{ marginTop: "48px", paddingTop: "28px", borderTop: `1px solid ${CLR.szBorder}` }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>
            Target Venues
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {PUBLICATION_TARGETS.map((v) => (
              <span key={v} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, padding: "4px 10px", border: `1px solid ${CLR.szBorder}`, borderRadius: "2px", letterSpacing: "0.7px" }}>
                {v}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---- HOME PAGE ----

function HomePage() {
  return (
    <>
      <HeroSection />
      <MissionSection />
      <ResearchSection />
      <ProjectsSection />
      <PublicationsSection />
      <CollaborateSection />
    </>
  );
}

// ---- MAIN ----

export default function KernelArchLabs() {
  const szRoute = useHashRoute();
  const bPapersPage = szRoute === "#/papers";

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <GlobalStyles />
      <ParticleNetwork />
      <Nav />
      {bPapersPage ? <PapersPage /> : <HomePage />}
      <Footer />
    </div>
  );
}
