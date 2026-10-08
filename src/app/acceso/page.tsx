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

/** PRNG determinista (mulberry32) para estrellas iguales en SSR y cliente. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; delay: number; dur: number };

function buildStars(): Star[] {
  const rnd = mulberry32(73219);
  const stars: Star[] = [];
  for (let i = 0; i < 48; i++) {
    stars.push({
      x: rnd() * 100,
      y: rnd() * 56, // franja superior del cielo
      r: 1 + rnd() * 1.8,
      delay: rnd() * 3,
      dur: 2.4 + rnd() * 2.8,
    });
  }
  return stars;
}

/** Balancín de extracción (pump jack) — animación SVG original. */
function PumpJack({ es }: { es: boolean }) {
  return (
    <svg className="vipx-svg" viewBox="0 0 1080 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label={es ? "Balancín de extracción de petróleo al amanecer" : "Oil pump jack at sunrise"}>
      <defs>
        <radialGradient id="pjSun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7da" />
          <stop offset="38%" stopColor="#ffcf6b" />
          <stop offset="72%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pjHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8c00" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sol naciente (detrás de todo) */}
      <g className="pj-sun">
        <circle cx="540" cy="332" r="215" fill="url(#pjHalo)" />
        <circle cx="540" cy="332" r="96" fill="url(#pjSun)" />
        <line className="pj-sunline" x1="150" y1="470" x2="930" y2="470" />
      </g>

      {/* Cerros/derricks lejanos para profundidad */}
      <g className="pj-far">
        <path d="M120 470 l34 -46 34 46 Z" />
        <path d="M190 470 l26 -34 26 34 Z" />
        <path d="M910 470 l40 -54 40 54 Z" />
        <path d="M968 470 l28 -38 28 38 Z" />
      </g>

      {/* Suelo */}
      <line className="pj-ground" x1="80" y1="470" x2="1000" y2="470" />
      <rect className="pj-skid" x="300" y="454" width="470" height="16" rx="3" />

      {/* Base del motor + caja de engranajes */}
      <rect className="pj-steel" x="752" y="372" width="76" height="82" rx="5" />
      <rect className="pj-steel2" x="690" y="420" width="56" height="34" rx="5" />

      {/* Poste maestro (A-frame) */}
      <path className="pj-strut" d="M553 250 L500 454 M553 250 L606 454 M525 362 L581 362" />

      {/* Contrapeso + manivela (gira) */}
      <circle className="pj-hub" cx="790" cy="380" r="9" />
      <g className="pj-crank">
        <rect className="pj-arm" x="782" y="332" width="16" height="96" rx="8" />
        <circle className="pj-weight" cx="790" cy="332" r="22" />
        <circle className="pj-weight" cx="790" cy="428" r="22" />
        <circle className="pj-pin" cx="790" cy="332" r="5.5" />
      </g>

      {/* Boca de pozo + varilla pulida (bombea) */}
      <rect className="pj-steel" x="286" y="430" width="28" height="34" rx="2" />
      <g className="pj-rod">
        <rect className="pj-bar" x="284" y="344" width="32" height="9" rx="2" />
        <rect className="pj-polish" x="296" y="348" width="8" height="104" rx="3" />
        <path className="pj-bridle" d="M292 322 L300 348 M308 322 L300 348" />
      </g>
      <circle className="pj-drip" cx="300" cy="458" r="3.4" />

      {/* Viga viajera (cabecea) con cabeza de caballo y biela */}
      <g className="pj-beam">
        <rect className="pj-steel" x="300" y="243" width="508" height="14" rx="7" />
        <path className="pj-head" d="M336 243 L300 243 A38 38 0 0 0 286 300 A46 46 0 0 0 318 324 L326 312 A40 40 0 0 1 300 258 L336 258 Z" />
        <line className="pj-pitman" x1="796" y1="252" x2="790" y2="350" />
      </g>

      {/* Texto */}
      <text className="vipx-tag" x="540" y="520" textAnchor="middle">
        {es ? "Inventario nacional de pozos · validación y UWI fiscalizado" : "National well inventory · validation & official UWI"}
      </text>
    </svg>
  );
}

function AccesoView() {
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
  const stars = useMemo(() => buildStars(), []);

  // La entrada es oscura por defecto (como la familia); el toggle la cambia.
  function switchMode() {
    const nextMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    setTheme(nextMode);
  }

  // Respeta reduce-motion (delay 0) y agenda el fin de la obertura.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("form"), reduce ? 0 : 5200);
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
      <div className="vipx-sky" aria-hidden />
      <div className="vipx-sky-dawn" aria-hidden />
      <div className="vipx-stars" aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            className="vipx-star"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.r}px`, height: `${s.r}px`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
          />
        ))}
      </div>
      <div className="vipx-grid" aria-hidden />
      <div className="vipx-glow" aria-hidden />

      {/* ---------------- Obertura: balancín de extracción ---------------- */}
      <div className={`vipx-intro ${phase === "form" ? "is-done" : ""}`} aria-hidden={phase === "form"}>
        <PumpJack es={es} />
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
            <Link href="/presentacion" className="vipx-link">{es ? "Conocer el sistema" : "About the system"}</Link>
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
  --steel:#1b232a;--steel2:#232d35;--edge:#55636d;
  background:var(--bg);color:var(--ink);
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;}
.vipx-root[data-mode=light]{--bg:#eef2f5;--panel:#ffffff;--line:rgba(16,36,52,.12);--ink:#1a2b3c;--muted:#5a6b7d;
  --field:#f4f7fa;--grid:rgba(16,36,52,.05);--rolebg:rgba(16,36,52,.03);--steel:#2a333b;--steel2:#333d45;--edge:#8795a0;}
.vipx-sky,.vipx-sky-dawn{position:absolute;inset:0;pointer-events:none;}
/* Cielo nocturno (base, antes del amanecer) */
.vipx-sky{background:linear-gradient(to bottom,
  #04060d 0%,#06080f 34%,#090b17 58%,#0c0e1c 78%,#0b0e16 90%,#090c11 100%);}
/* Cielo de amanecer: se funde encima a medida que sale el sol */
.vipx-sky-dawn{opacity:0;animation:pj-skydawn 5.2s ease-out forwards;
  background:linear-gradient(to bottom,
    #070b14 0%,#0a1120 24%,#171a30 44%,#3f2730 58%,#7c3f24 70%,#c06a28 79%,#e08a34 84%,#3a1d10 90%,#0b0f12 100%);}
@keyframes pj-skydawn{0%{opacity:0}45%{opacity:.5}100%{opacity:1}}
/* Estrellas (titilan de noche y se desvanecen al amanecer) */
.vipx-stars{position:absolute;inset:0;pointer-events:none;animation:pj-starfade 5.2s ease-out forwards;}
.vipx-star{position:absolute;border-radius:50%;background:#fff;box-shadow:0 0 3px rgba(255,255,255,.8);
  animation:pj-twinkle 3s ease-in-out infinite;will-change:opacity;}
.vipx-root[data-mode=light] .vipx-stars{display:none;}
@keyframes pj-starfade{0%{opacity:.95}50%{opacity:.6}100%{opacity:0}}
@keyframes pj-twinkle{0%,100%{opacity:.25}50%{opacity:.9}}
.vipx-root[data-mode=light] .vipx-sky{
  background:linear-gradient(to bottom,#dde6ee 0%,#e8eef3 60%,#eef2f5 100%);}
.vipx-root[data-mode=light] .vipx-sky-dawn{
  background:linear-gradient(to bottom,#e6edf3 0%,#eef3f7 48%,#ffe6c6 82%,#f6ead9 90%,#eef2f5 100%);}
.vipx-grid{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:46px 46px;mask-image:radial-gradient(130% 120% at 50% 40%,#000 55%,transparent 100%);}
.vipx-glow{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 46% at 50% 60%,rgba(255,150,40,.12),transparent 70%);}

/* Obertura */
.vipx-intro{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  opacity:1;transition:opacity .7s ease;z-index:3;}
.vipx-intro.is-done{opacity:0;pointer-events:none;}
.vipx-svg{width:min(94vw,1080px);height:auto;}

/* Balancín */
.pj-ground{stroke:var(--edge);stroke-width:1.2;opacity:.5;}
.pj-far{fill:var(--edge);opacity:.14;}
.pj-skid,.pj-steel{fill:var(--steel);stroke:var(--edge);stroke-width:1.2;}
.pj-steel2{fill:var(--steel2);stroke:var(--edge);stroke-width:1.2;}
.pj-strut{stroke:var(--edge);stroke-width:7;stroke-linecap:round;fill:none;}
.pj-head{fill:var(--steel);stroke:var(--accent);stroke-width:2;}
.pj-pitman{stroke:var(--edge);stroke-width:7;stroke-linecap:round;}
.pj-arm{fill:var(--steel2);stroke:var(--edge);stroke-width:1.2;}
.pj-weight{fill:var(--accent);stroke:#1a1a1a;stroke-width:1.5;}
.pj-pin{fill:#1a1a1a;}
.pj-hub{fill:var(--edge);}
.pj-bar{fill:var(--edge);}
.pj-polish{fill:var(--accent);}
.pj-bridle{stroke:var(--edge);stroke-width:2.2;}
.pj-drip{fill:var(--accent);opacity:0;animation:pj-drip 3.4s ease-in infinite;animation-delay:1.1s;}

.pj-beam{transform-box:view-box;transform-origin:553px 250px;animation:pj-rock 3.4s ease-in-out infinite;}
.pj-crank{transform-box:view-box;transform-origin:790px 380px;animation:pj-spin 3.4s linear infinite;}
.pj-rod{animation:pj-bob 3.4s ease-in-out infinite;}
@keyframes pj-rock{0%,100%{transform:rotate(-5.5deg)}50%{transform:rotate(5.5deg)}}
@keyframes pj-spin{to{transform:rotate(360deg)}}
@keyframes pj-bob{0%,100%{transform:translateY(16px)}50%{transform:translateY(-12px)}}
@keyframes pj-drip{0%{opacity:0;transform:translateY(0)}6%{opacity:.9}100%{opacity:0;transform:translateY(70px)}}

/* Sol naciente */
.pj-sun{opacity:0;animation:pj-sunrise 5.2s ease-out forwards;}
.pj-sunline{stroke:#ff8c00;stroke-width:2;opacity:.22;}
@keyframes pj-sunrise{0%{opacity:0;transform:translateY(165px)}40%{opacity:.65}100%{opacity:1;transform:translateY(0)}}

.vipx-tag{fill:var(--muted);font-size:15px;letter-spacing:.02em;opacity:0;animation:vipx-fade 1s ease forwards;animation-delay:.8s;}
@keyframes vipx-fade{to{opacity:.85}}

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
@media (prefers-reduced-motion: reduce){.pj-beam,.pj-crank,.pj-rod,.pj-drip,.vipx-tag,.vipx-star{animation:none;}.pj-sun,.vipx-sky-dawn{animation:none;opacity:1;transform:none;}.vipx-stars{animation:none;opacity:0;}}
@media (max-width:420px){.vipx-card{padding:22px 18px 18px;}}
`;

export default function AccesoPage() {
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#0b0f12" }} />}>
      <AccesoView />
    </Suspense>
  );
}
