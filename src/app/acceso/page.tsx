"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { DEMO_OPERADORA, getDemoCredentials } from "@/lib/demo-auth";
import { sanitizeNextPath } from "@/lib/safe-redirect";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";

const ROLES: { id: UserRole; label: string; description: string; howTo: string }[] = [
  {
    id: "operadora",
    label: "Operadora",
    description: "Carga, valida y envía el inventario de su operadora.",
    howTo: "Usuario: demo",
  },
  {
    id: "anh",
    label: "ANH",
    description: "Consulta el inventario consolidado recibido de operadoras.",
    howTo: "Usuario: funcionario",
  },
  {
    id: "admin",
    label: "Administrador",
    description: "Gestiona usuarios, edita y elimina registros con trazabilidad.",
    howTo: "Correo: johan.redondo@anh.gov.co",
  },
];

/** Fuentes de referencia contra las que VIP valida cada pozo (tema de la obertura). */
const SOURCES = [
  { key: "AVM", color: "#ff9f45" },
  { key: "SGC", color: "#4ec9b0" },
  { key: "DANE", color: "#8b8fe0" },
] as const;

/** PRNG determinista (mulberry32) para que SSR y cliente generen los mismos puntos. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dot = { cx: number; cy: number; r: number; color: string; delay: number };

function buildDots(): Dot[] {
  const rnd = mulberry32(20260408);
  const axisY = [168, 280, 392];
  const dots: Dot[] = [];
  SOURCES.forEach((src, si) => {
    const count = 17;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const cx = 150 + t * 780 + (rnd() - 0.5) * 26;
      const cy = axisY[si] + (rnd() - 0.5) * 52;
      const r = 3.2 + rnd() * 3.2;
      const delay = 0.55 + si * 0.12 + t * 1.5 + rnd() * 0.25;
      dots.push({ cx, cy, r, color: src.color, delay });
    }
  });
  return dots;
}

const AXIS_Y = [168, 280, 392];

function LoginView() {
  const { setTheme, setLocale, locale } = useAppPreferences();
  const { refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNextPath(searchParams.get("volver") ?? searchParams.get("next"));
  const roleParam = searchParams.get("role") as UserRole | null;
  const es = locale !== "en";

  const [phase, setPhase] = useState<"intro" | "form">("intro");
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [soundOn, setSoundOn] = useState(true);
  const [role, setRole] = useState<UserRole>(() =>
    roleParam && ROLES.some((r) => r.id === roleParam) ? roleParam : "operadora",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  const dots = useMemo(() => buildDots(), []);

  // La entrada es oscura por defecto (como la familia); el toggle la cambia.
  function switchMode() {
    const nextMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    setTheme(nextMode);
  }

  // Respeta reduce-motion (delay 0) y agenda el fin de la obertura.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("form"), reduce ? 0 : 3900);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("form");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /** Firma sonora sintetizada (Web Audio): breve arpegio ascendente. */
  const playSignature = useCallback(() => {
    if (!soundOn) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioRef.current ?? new Ctor();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      const master = ctx.createGain();
      master.gain.value = 0.12;
      master.connect(ctx.destination);
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        const t0 = now + i * 0.11;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.9, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.5);
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + 0.55);
      });
    } catch {
      /* autoplay bloqueado o sin soporte: silencioso */
    }
  }, [soundOn]);

  // Intenta la firma sonora al iniciar la obertura (si el navegador lo permite).
  useEffect(() => {
    if (phase === "intro") playSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skipIntro() {
    playSignature();
    setPhase("form");
  }

  async function handleEnter(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, demo: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error de autenticación");
      await refresh();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const selected = ROLES.find((r) => r.id === role)!;
  const demo = getDemoCredentials(role);

  return (
    <div className="vipx-root" data-mode={mode}>
      <style>{CSS}</style>
      <div className="vipx-grid" aria-hidden />
      <div className="vipx-glow" aria-hidden />

      {/* ---------------- Obertura ---------------- */}
      <div className={`vipx-intro ${phase === "form" ? "is-done" : ""}`} aria-hidden={phase === "form"}>
        <svg className="vipx-svg" viewBox="0 0 1080 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Validación del inventario de pozos">
          {SOURCES.map((s, i) => (
            <g key={s.key}>
              <text className="vipx-axislbl" x="120" y={AXIS_Y[i] + 4} style={{ fill: s.color }}>
                {s.key}
              </text>
              <line className="vipx-axis" x1="150" y1={AXIS_Y[i]} x2="930" y2={AXIS_Y[i]} style={{ stroke: s.color, animationDelay: `${0.15 + i * 0.12}s` }} />
            </g>
          ))}
          {dots.map((d, i) => (
            <circle
              key={i}
              className="vipx-dot"
              cx={d.cx}
              cy={d.cy}
              r={d.r}
              style={{ fill: d.color, animationDelay: `${d.delay}s`, ["--o" as string]: 0.9 }}
            />
          ))}
          <text className="vipx-tag" x="150" y="470">
            {es ? "Validando inventario contra catálogos oficiales…" : "Validating inventory against official catalogs…"}
          </text>
          <text className="vipx-uwi" x="930" y="470" textAnchor="end">
            UWI · AVM · SGC · DANE
          </text>
        </svg>

        <div className="vipx-intro-ui">
          <button type="button" className="vipx-sound" onClick={() => { setSoundOn((v) => !v); if (!soundOn) playSignature(); }} aria-label={soundOn ? "Silenciar" : "Activar sonido"} title={soundOn ? "Silenciar" : "Activar sonido"}>
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button type="button" className="vipx-skip" onClick={skipIntro}>
            {es ? "SALTAR" : "SKIP"}
          </button>
        </div>
      </div>

      {/* ---------------- Tarjeta de acceso ---------------- */}
      <div className={`vipx-stage ${phase === "form" ? "is-in" : ""}`}>
        <div className="vipx-card">
          <div className="vipx-head">
            <span className="vipx-badge" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M12 2.6c3 3.9 5.2 7 5.2 9.9A5.2 5.2 0 0 1 12 17.9a5.2 5.2 0 0 1-5.2-5.4C6.8 9.6 9 6.5 12 2.6Z" fill="#1a1a1a" />
                <path d="M9.3 12.4c0 1.5 1.2 2.7 2.7 2.7" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
              </svg>
            </span>
            <div className="vipx-head-txt">
              <h1>VIP</h1>
              <p>{es ? "Validador del Inventario de Pozos" : "Well Inventory Validator"}</p>
            </div>
          </div>

          <hr className="vipx-sep" />

          <h2 className="vipx-title">{es ? "Iniciar sesión" : "Sign in"}</h2>
          <p className="vipx-help">
            {es ? "Elija su perfil y entre. No necesita escribir nada." : "Choose your profile and enter. No typing required."}
          </p>

          <div className="vipx-roles" role="tablist" aria-label={es ? "Perfil" : "Profile"}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={role === r.id}
                className={`vipx-role ${role === r.id ? "is-sel" : ""}`}
                onClick={() => { setRole(r.id); setError(null); }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <p className="vipx-role-desc">{selected.description}</p>
          <p className="vipx-role-acct">
            {selected.howTo}
            {role === "operadora" ? <span className="vipx-dim">{DEMO_OPERADORA}</span> : null}
            <span className="vipx-dim">{es ? "Cuenta" : "Account"}: {demo.label}</span>
          </p>

          <form onSubmit={handleEnter}>
            {error && <p className="vipx-error">{error}</p>}
            <button type="submit" className="vipx-submit" disabled={loading}>
              {loading ? (es ? "Entrando…" : "Signing in…") : `${es ? "Entrar como" : "Enter as"} ${selected.label}`}
            </button>
          </form>

          <p className="vipx-note">
            {es ? "Acceso de piloto · la contraseña se resuelve en el servidor." : "Pilot access · the password is resolved on the server."}
          </p>

          <hr className="vipx-sep" />

          <div className="vipx-footer">
            <Link href="/" className="vipx-link">← {es ? "Inicio" : "Home"}</Link>
            <div className="vipx-footer-right">
              <button type="button" className="vipx-ftbtn" onClick={switchMode}>
                {mode === "dark" ? (es ? "Modo claro" : "Light mode") : (es ? "Modo oscuro" : "Dark mode")}
              </button>
              <span className="vipx-ftsep">·</span>
              <button type="button" className={`vipx-lang ${es ? "is-on" : ""}`} onClick={() => setLocale("es")}>ES</button>
              <button type="button" className={`vipx-lang ${!es ? "is-on" : ""}`} onClick={() => setLocale("en")}>EN</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.vipx-root{position:fixed;inset:0;overflow:hidden;
  --bg:#0b0f12;--panel:rgba(22,33,37,.92);--line:rgba(255,255,255,.10);--ink:#e8eef1;--muted:#9fb0b8;
  --accent:#ff8c00;--accent-ink:#1a1a1a;--field:rgba(14,21,24,.75);--grid:rgba(255,255,255,.035);--rolebg:rgba(255,255,255,.04);
  background:var(--bg);color:var(--ink);
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;}
.vipx-root[data-mode=light]{--bg:#f3f6f8;--panel:#ffffff;--line:rgba(16,36,52,.12);--ink:#1a2b3c;--muted:#5a6b7d;
  --field:#f4f7fa;--grid:rgba(16,36,52,.05);--rolebg:rgba(16,36,52,.03);}
.vipx-grid{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:46px 46px;mask-image:radial-gradient(130% 120% at 50% 40%,#000 55%,transparent 100%);}
.vipx-glow{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 50% at 100% 0%,rgba(255,140,0,.16),transparent 60%),
             radial-gradient(50% 40% at 0% 100%,rgba(78,201,176,.08),transparent 60%);}

/* Obertura */
.vipx-intro{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  opacity:1;transition:opacity .7s ease;z-index:3;}
.vipx-intro.is-done{opacity:0;pointer-events:none;}
.vipx-svg{width:min(92vw,1080px);height:auto;}
.vipx-axis{stroke-width:1.4;opacity:.5;stroke-dasharray:820;stroke-dashoffset:820;
  animation:vipx-draw 1.1s ease forwards;}
.vipx-axislbl{font-size:16px;font-weight:800;letter-spacing:.14em;opacity:0;animation:vipx-fade .6s ease forwards;}
.vipx-dot{opacity:0;transform-box:fill-box;transform-origin:center;animation:vipx-pop .55s cubic-bezier(.2,.8,.3,1) forwards;}
.vipx-tag{fill:var(--muted);font-size:15px;opacity:0;animation:vipx-fade .8s ease forwards;animation-delay:2.1s;}
.vipx-uwi{fill:var(--accent);font-size:13px;font-weight:700;letter-spacing:.16em;opacity:0;animation:vipx-fade .8s ease forwards;animation-delay:2.4s;}
@keyframes vipx-draw{to{stroke-dashoffset:0}}
@keyframes vipx-fade{to{opacity:.85}}
@keyframes vipx-pop{0%{opacity:0;transform:translateY(10px) scale(.3)}60%{opacity:var(--o)}100%{opacity:var(--o);transform:none}}
.vipx-intro-ui{position:absolute;right:26px;bottom:24px;display:flex;gap:10px;align-items:center;}
.vipx-sound{width:40px;height:40px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);
  font-size:15px;cursor:pointer;backdrop-filter:blur(8px);}
.vipx-skip{padding:9px 20px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);
  font-weight:800;letter-spacing:.14em;font-size:12px;cursor:pointer;backdrop-filter:blur(8px);}
.vipx-skip:hover,.vipx-sound:hover{border-color:var(--accent);}

/* Tarjeta */
.vipx-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;z-index:2;
  opacity:0;transform:translateY(10px) scale(.985);transition:opacity .7s ease,transform .7s ease;pointer-events:none;}
.vipx-stage.is-in{opacity:1;transform:none;pointer-events:auto;}
.vipx-card{width:100%;max-width:420px;background:var(--panel);border:1px solid var(--line);border-radius:16px;
  box-shadow:0 24px 60px rgba(0,0,0,.5);backdrop-filter:blur(10px);padding:26px 27px 21px;}
.vipx-head{display:flex;align-items:center;gap:12px;}
.vipx-badge{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;
  background:linear-gradient(145deg,#ffb04d,#ff8c00);box-shadow:0 6px 16px rgba(255,140,0,.35);flex:none;}
.vipx-head-txt h1{margin:0;font-size:22px;font-weight:800;letter-spacing:.02em;color:var(--ink);}
.vipx-head-txt p{margin:2px 0 0;font-size:12.5px;color:var(--muted);}
.vipx-sep{border:none;border-top:1px solid var(--line);margin:16px 0;}
.vipx-title{margin:0;font-size:17px;font-weight:700;color:var(--ink);}
.vipx-help{margin:6px 0 16px;font-size:13px;color:var(--muted);}
.vipx-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.vipx-role{padding:11px 6px;border-radius:10px;border:1px solid var(--line);background:var(--rolebg);color:var(--muted);
  font-weight:700;font-size:12.5px;cursor:pointer;transition:all .15s ease;}
.vipx-role:hover{border-color:var(--accent);color:var(--ink);}
.vipx-role.is-sel{border-color:var(--accent);background:rgba(255,140,0,.12);color:var(--ink);}
.vipx-role-desc{margin:14px 0 4px;font-size:13px;color:var(--muted);}
.vipx-role-acct{margin:0 0 14px;font-size:13px;font-weight:600;color:var(--ink);}
.vipx-dim{display:block;margin-top:2px;font-size:11.5px;font-weight:400;color:var(--muted);}
.vipx-submit{width:100%;padding:13px;border:none;border-radius:9px;background:var(--accent);color:var(--accent-ink);
  font-weight:800;font-size:14px;cursor:pointer;transition:filter .15s ease;}
.vipx-submit:hover{filter:brightness(1.05);}
.vipx-submit:disabled{opacity:.6;cursor:default;}
.vipx-error{margin:0 0 12px;padding:9px 12px;border-radius:9px;border:1px solid rgba(224,56,26,.4);
  background:rgba(224,56,26,.08);color:#ff9b86;font-size:13px;}
.vipx-note{margin:14px 0 0;font-size:12px;color:var(--muted);text-align:center;}
.vipx-footer{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;}
.vipx-link{color:var(--muted);text-decoration:none;}
.vipx-link:hover{color:var(--accent);}
.vipx-footer-right{display:flex;align-items:center;gap:8px;}
.vipx-ftbtn{background:none;border:none;color:var(--muted);font-weight:700;font-size:12.5px;cursor:pointer;}
.vipx-ftbtn:hover{color:var(--ink);}
.vipx-ftsep{color:var(--muted);}
.vipx-lang{background:none;border:none;color:var(--muted);font-weight:700;font-size:12.5px;cursor:pointer;padding:0 1px;}
.vipx-lang.is-on{color:var(--accent);}
@media (max-width:420px){.vipx-card{padding:22px 18px 18px;}}
`;

export default function AccesoPage() {
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#0b0f12" }} />}>
      <LoginView />
    </Suspense>
  );
}
