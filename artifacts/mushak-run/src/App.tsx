'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowUp, ChevronLeft, CircleHelp, Eye, Home, Medal, Music2, Pause, Play, RotateCcw, Settings, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

type Screen = "intro" | "menu" | "tutorial" | "playing" | "paused" | "gameover" | "settings" | "hall";
type HallEntry = { score: number; laddus: number; stage: number; date: string };
type Obstacle = { id: number; x: number; gapY: number; gapSize: number };
type TrailLaddu = { id: number; x: number; y: number };
type LadduEffect = { id: number; x: number; y: number; life: number };
type RunState = {
  playerY: number;
  velocity: number;
  distance: number;
  score: number;
  laddus: number;
  speed: number;
  elapsed: number;
  liftTime: number;
  growthScale: number;
  growthTarget: number;
  nextObstacle: number;
  nextLaddu: number;
  stage: number;
  obstacles: Obstacle[];
  trail: TrailLaddu[];
  effects: LadduEffect[];
};

const STAGES = [
  { name: "Bal Ganesha", detail: "The first brave hop", color: "#5c9fc4" },
  { name: "Happy Ganesha", detail: "Snowline strength", color: "#3a83b0" },
  { name: "Laddu Lover", detail: "The route opens wide", color: "#276c99" },
  { name: "Maha Ganesha", detail: "A radiant summit arrival", color: "#164f78" },
];
const STORAGE = {
  best: "mushak-run-best",
  hall: "mushak-run-hall",
  tutorial: "mushak-run-tutorial",
  sound: "mushak-run-sound",
  music: "mushak-run-music",
  reduced: "mushak-run-reduced-motion",
};

function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const item = window.localStorage.getItem(key);
    if (item === null) return fallback;
    const value = Number(item);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readBool(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function save(key: string, value: string | number | boolean) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Ignore quota/access errors in private mode
    }
  }
}

function readHall(): HallEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE.hall) ?? "[]") as HallEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function seededFlakes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: `${(i * 37 + 8) % 97}%`,
    top: `${(i * 23 + 7) % 74}%`,
    delay: `${-((i % 9) * 0.72)}s`,
    duration: `${6.5 + (i % 6) * 0.8}s`,
    size: `${2 + (i % 3)}px`,
  }));
}

const flakes = seededFlakes(68);
const snowballs = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 29 + 11) % 94}%`,
  top: `${10 + ((i * 17) % 42)}%`,
  delay: `${-((i % 7) * 1.15)}s`,
  duration: `${5.5 + (i % 5) * .7}s`,
  size: `${4 + (i % 3) * 2}px`,
}));

function getPoleScale(growthScale: number) {
  return 1 + Math.min(1, Math.max(0, (growthScale - .84) / .84)) * .28;
}

function MushakRider({ stage = 1, className = "", style }: { stage?: number; className?: string; style?: CSSProperties }) {
  const spriteMap: Record<number, string> = {
    1: "/ganesha-stage-1.png",
    2: "/ganesha-stage-2.png",
    3: "/ganesha-stage-3.png",
    4: "/ganesha-mushak-rider.png",
  };
  const spriteSrc = spriteMap[stage] || spriteMap[1];

  return (
    <div className={`rider-sprite-shell stage-${stage} ${className}`} style={style} role="img" aria-label={`Ganesha Stage ${stage}`}>
      <span className="rider-bob">
        <span className="rider-motion">
          {stage >= 3 && <span className={`rider-aura ${stage === 4 ? "maha-aura" : "lover-aura"}`} aria-hidden="true" />}
          <div className="rider-composite">
            <img
              key={`ganesha-stage-${stage}`}
              className={`rider-sprite sprite-stage-${stage}`}
              src={spriteSrc}
              alt={`Ganesha Stage ${stage}`}
              draggable="false"
            />
            {(stage === 1 || stage === 2 || stage === 3) && (
              <img
                className="mushak-real-mount"
                src="/mushak-mount.png"
                alt="Mushak the mouse mount"
                draggable="false"
              />
            )}
          </div>
        </span>
      </span>
    </div>
  );
}

function Mountains({ dark = false }: { dark?: boolean }) {
  return (
    <>
      <div className="sun" />
      <div className="mountain back" />
      <div className="mountain" />
      <div className="snowcaps" />
      <div className="foreground-slope" />
      {!dark && <div className="path-line" />}
    </>
  );
}

function SceneDecor({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return <>
    {flakes.map((flake, index) => <span className={`flake ${reducedMotion ? "reduced-snow" : ""}`} key={`flake-${index}`} style={{ left: flake.left, top: flake.top, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size }} />)}
    {snowballs.map((ball, index) => <span className={`snowball ${reducedMotion ? "reduced-snow" : ""}`} key={`snowball-${index}`} style={{ left: ball.left, top: ball.top, animationDelay: ball.delay, animationDuration: ball.duration, width: ball.size, height: ball.size }} aria-hidden="true" />)}
  </>;
}

function Topbar({ onSettings, onHall, sound, onSound, compact = false }: { onSettings: () => void; onHall: () => void; sound: boolean; onSound: () => void; compact?: boolean }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => window.location.reload()} aria-label="Return to Mushak Run menu" data-testid="button-brand">
        <span className="brand-mark">MR</span>
        <span className="brand-copy"><strong>MUSHAK RUN</strong><small>Ganesha's laddu chase</small></span>
      </button>
      <nav className="utility-nav" aria-label="Game navigation">
        {!compact && <button className="text-btn" onClick={onHall} data-testid="button-hall-nav"><Trophy size={15} /> Hall of fame</button>}
        <button className="icon-btn" onClick={onSound} aria-label={sound ? "Mute sound" : "Enable sound"} data-testid="button-sound">{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button className="icon-btn" onClick={onSettings} aria-label="Open settings" data-testid="button-settings"><Settings size={17} /></button>
      </nav>
    </header>
  );
}

function StageRail({ current, score }: { current: number; score: number }) {
  return (
    <div className="stage-rail" aria-label="Growth stages">
      {STAGES.map((stage, index) => (
        <div className={`stage-node ${index + 1 <= current ? "active" : ""}`} key={stage.name}>
          <span style={{ background: index + 1 <= current ? stage.color : undefined }}>{index + 1}</span>
          <small>{stage.name}</small>
          {index < STAGES.length - 1 && <i className={index + 1 < current ? "filled" : ""} />}
        </div>
      ))}
      <span className="stage-score">RUN {score.toString().padStart(4, "0")}</span>
    </div>
  );
}

function IntroSplash({ onStart }: { onStart: () => void }) {
  return (
    <main className="intro-splash-screen screen-enter">
      <div className="intro-video-backdrop">
        <video
          src="/intro-video.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="intro-bg-video"
        />
        <div className="intro-overlay-gradient" />
      </div>
      
      <div className="intro-content-card">
        <div className="eyebrow intro-badge">
          ✨ Welcome to Himalayan Mount Run ✨
        </div>
        <h1 className="hero-title intro-title">
          Mushak Run
          <br />
          <em>Ganesha's Adventure</em>
        </h1>
        <p className="hero-copy intro-desc">
          Fly through snowy mountain gates, collect glowing laddus, and evolve through 4 divine forms!
        </p>

        <button
          className="primary-btn intro-start-btn"
          onClick={onStart}
          data-testid="button-start-intro"
        >
          <Play size={20} fill="currentColor" />
          START THE GAME
        </button>
      </div>
    </main>
  );
}

function Menu({ best, sound, onSound, onStart, onSettings, onHall }: { best: number; sound: boolean; onSound: () => void; onStart: () => void; onSettings: () => void; onHall: () => void }) {
  return (
    <main className="app-shell screen-enter">
      <Topbar onSettings={onSettings} onHall={onHall} sound={sound} onSound={onSound} />
      <section className="game-menu">
        <div>
          <div className="eyebrow">A one-button mountain story</div>
          <h1 className="hero-title">Run.<br /><em>Grow.</em><br />Glow.</h1>
          <p className="hero-copy">Guide <strong>Ganesha and Mushak</strong> through a hand-painted Himalayan dawn. Fly through the snowy mountain gates, collect every glowing laddu, and climb toward the summit.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onStart} data-testid="button-start-run"><Play size={17} fill="currentColor" /> Begin the chase</button>
          </div>
          <div className="sub-actions">
            <div className="mini-stat"><Medal size={16} /><span>Best score<strong data-testid="text-best-score">{best.toString().padStart(4, "0")}</strong></span></div>
            <div className="mini-stat"><CircleHelp size={16} /><span>Controls<strong>Tap / Space / Up</strong></span></div>
          </div>
        </div>
        <div className="scene-card" aria-label="Animated Himalayan attract scene">
          <div className="scene-label"><span /> now crossing the snowline</div>
          <Mountains />
          <SceneDecor />
          <div className="demo-laddu" />
          <div className="demo-laddu two" />
          <MushakRider className="demo-rider" stage={2} />
        </div>
      </section>
      <footer className="menu-foot"><span>Four growth stages <strong>·</strong> one joyful route</span><span>LOCAL RUN <strong>READY</strong></span></footer>
    </main>
  );
}

function Tutorial({ onBegin, onBack, sound, onSound }: { onBegin: () => void; onBack: () => void; sound: boolean; onSound: () => void }) {
  return (
    <main className="app-shell screen-enter">
      <Topbar onSettings={onBack} onHall={onBack} sound={sound} onSound={onSound} compact />
      <section className="tutorial-card">
        <div className="tutorial-art"><Mountains /><MushakRider className="runner" stage={1} /></div>
        <div className="eyebrow">First run · 20 seconds</div>
        <h1>One hop.<br />Many little wonders.</h1>
        <p>Tap anywhere, click the route, or press <span className="keycap">Space</span><span className="keycap">↑</span>. Thread the snowy gates. Every laddu helps you grow.</p>
        <button className="primary-btn" onClick={onBegin} data-testid="button-tutorial-begin"><ArrowUp size={17} /> I'm ready</button>
        <button className="text-btn" onClick={onBack} data-testid="button-tutorial-back" style={{ marginLeft: 10 }}><ChevronLeft size={15} /> Back</button>
      </section>
    </main>
  );
}

type CheerEvent = {
  stage: number;
  stageName: string;
  badge: string;
  cheerMessage: string;
  subtitle: string;
  color: string;
};

function GameScene({ run, playerY, signature, countdown, onHop, reducedMotion, levelCheer }: { run: RunState; playerY: number; signature: boolean; countdown: number | null; onHop: () => void; reducedMotion: boolean; levelCheer: CheerEvent | null }) {
  const phase = run.elapsed % 48;
  const timeClass = phase > 34 ? "night" : phase > 23 ? "dusk" : "";
  const tilt = Math.max(-18, Math.min(18, -run.velocity * 5200));
  const poleScale = getPoleScale(run.growthScale);
  const playerStyle = {
    bottom: `calc(12% + ${Math.min(playerY, .68) * 100}%)`,
    "--growth-scale": run.growthScale,
    "--tilt": `${tilt}deg`,
    "--squash-y": run.velocity > .0005 ? 1.05 : run.velocity < -.0005 ? .95 : 1,
  } as CSSProperties;
  return (
    <div className={`playfield ${timeClass}`} onPointerDown={onHop} role="application" aria-label="Mushak Run gameplay. Tap, click, or press Space to hop." data-testid="game-playfield">
      <Mountains dark={timeClass === "night"} />
      <SceneDecor reducedMotion={reducedMotion} />
      <div className="snow-ground snow-ground-back" aria-hidden="true" />
      <div className="snow-ground snow-ground-front" aria-hidden="true" />
      <div className="game-track" />
      {run.trail.map((laddu) => <div className="laddu" key={laddu.id} style={{ left: `${laddu.x * 100}%`, bottom: `calc(12% + ${laddu.y * 100}%)` }} data-testid={`laddu-${laddu.id}`} />)}
      {run.effects.map((effect) => (
        <div className="laddu-effect" key={effect.id} style={{ left: `${effect.x * 100}%`, bottom: `calc(12% + ${effect.y * 100}%)` }} aria-hidden="true">
          <span className="laddu-popup">+1 Laddu</span>
          <span className="sparkle-dot sparkle-one" />
          <span className="sparkle-dot sparkle-two" />
          <span className="sparkle-dot sparkle-three" />
          <span className="sparkle-dot sparkle-four" />
        </div>
      ))}
      {run.obstacles.map((obstacle) => {
        // Automatically adjust gap size based on Ganesha's size so player never gets stuck
        const dynamicBonus = Math.max(0, (run.growthScale - 0.84) * 0.15);
        const effectiveGapSize = obstacle.gapSize + dynamicBonus;
        const gapBottom = obstacle.gapY - effectiveGapSize / 2;
        const gapTop = obstacle.gapY + effectiveGapSize / 2;
        return (
          <div className="pipe-pair" key={obstacle.id} data-testid={`obstacle-${obstacle.id}`}>
            <div className="pipe pipe-top" style={{ left: `${obstacle.x * 100}%`, height: `${Math.max(10, 88 - gapTop * 100)}%`, "--pole-scale": poleScale } as CSSProperties}><span className="pipe-snow" /></div>
            <div className="pipe pipe-bottom" style={{ left: `${obstacle.x * 100}%`, height: `${Math.max(10, gapBottom * 100)}%`, "--pole-scale": poleScale } as CSSProperties}><span className="pipe-snow" /></div>
          </div>
        );
      })}
      <MushakRider className={`runner stage-${run.stage}`} stage={run.stage} style={playerStyle} />
      <div className="tap-hint"><ArrowUp size={12} /> hop to keep the route</div>
      {countdown !== null && <div className="countdown-overlay" aria-live="assertive"><strong>{countdown}</strong><span>get ready</span></div>}
      
      {/* ─── Level Passed Cheer Banner Animation ─── */}
      {levelCheer && (
        <div className="level-cheer-banner" key={`cheer-${levelCheer.stage}`} aria-live="polite">
          <div className="cheer-sparkles">
            <Sparkles className="cheer-icon left" size={22} />
            <Sparkles className="cheer-icon right" size={22} />
          </div>
          <div className="cheer-badge" style={{ backgroundColor: levelCheer.color }}>
            <Trophy size={13} /> {levelCheer.badge}
          </div>
          <div className="cheer-title">{levelCheer.stageName}</div>
          <div className="cheer-subtitle">{levelCheer.cheerMessage}</div>
          <div className="cheer-confetti-container">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className={`cheer-confetti confetti-${i % 4}`} style={{ left: `${i * 8 + 4}%`, animationDelay: `${(i % 4) * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {signature && <div className="signature"><div className="signature-card"><div className="seal"><Sparkles size={47} /></div><strong>Maha Ganesha</strong><span>the summit remembers courage</span></div></div>}
      <div className="hud-message" key={`${run.stage}-${signature}`}>{signature || levelCheer ? "" : run.stage > 1 && run.elapsed < 2 ? STAGES[run.stage - 1].name : ""}</div>
    </div>
  );
}

function SettingsPage({ sound, music, reducedMotion, onSound, onMusic, onReducedMotion, onBack }: { sound: boolean; music: boolean; reducedMotion: boolean; onSound: () => void; onMusic: () => void; onReducedMotion: () => void; onBack: () => void }) {
  const rows = [
    { label: "Sound effects", detail: "A tiny chime when a laddu lands.", value: sound, action: onSound, icon: Volume2, test: "toggle-sound" },
    { label: "Mountain music", detail: "The route stays playable in silence.", value: music, action: onMusic, icon: Music2, test: "toggle-music" },
    { label: "Reduced motion", detail: "Tames snowfall, shimmer, and screen transitions.", value: reducedMotion, action: onReducedMotion, icon: Eye, test: "toggle-reduced-motion" },
  ];
  return (
    <main className="app-shell screen-enter">
      <Topbar onSettings={onBack} onHall={() => undefined} sound={sound} onSound={onSound} compact />
      <section className="settings-page">
        <button className="text-btn" onClick={onBack} data-testid="button-settings-back"><ChevronLeft size={15} /> Back to menu</button>
        <h1>Make it yours.</h1>
        <p>Small choices for a comfortable, joyful run.</p>
        <div className="settings-list">
          {rows.map((row) => {
            const Icon = row.icon;
            return <div className="setting-row" key={row.label}><span style={{ display: "flex", alignItems: "center", gap: 13 }}><Icon size={19} color="hsl(var(--primary))" /><span><strong>{row.label}</strong><small>{row.detail}</small></span></span><button className={`switch ${row.value ? "on" : ""}`} onClick={row.action} aria-pressed={row.value} aria-label={`${row.label}: ${row.value ? "on" : "off"}`} data-testid={row.test}><span /></button></div>;
          })}
        </div>
        <div className="empty-state">Your runs, best score, and hall of fame stay on this device only.</div>
      </section>
    </main>
  );
}

function HallOfFame({ entries, best, sound, onSound, onBack }: { entries: HallEntry[]; best: number; sound: boolean; onSound: () => void; onBack: () => void }) {
  return (
    <main className="app-shell screen-enter">
      <Topbar onSettings={onBack} onHall={onBack} sound={sound} onSound={onSound} compact />
      <section className="settings-page">
        <button className="text-btn" onClick={onBack} data-testid="button-hall-back"><ChevronLeft size={15} /> Back to menu</button>
        <h1>Hall of fame.</h1>
        <p>The five brightest local runs. No account, no cloud, just a little friendly rivalry.</p>
        <div className="hall-list">
          {entries.length === 0 ? <div className="empty-state" data-testid="empty-hall">Your first summit is waiting.</div> : entries.map((entry, index) => <div className="hall-row" key={`${entry.date}-${index}`} data-testid={`hall-row-${index}`}><span className="hall-rank">{index + 1}</span><span><b>{entry.stage === 4 ? "Summit keeper" : "Trail seeker"}</b><small>{entry.date} · {entry.laddus} laddus · stage {entry.stage}</small></span><strong>{entry.score.toString().padStart(4, "0")}</strong></div>)}
        </div>
        <div className="empty-state" style={{ marginTop: 12 }}>Current best <strong data-testid="hall-best-score">{best.toString().padStart(4, "0")}</strong></div>
      </section>
    </main>
  );
}

function Results({ score, laddus, stage, growthScale, best, isNewBest, onReplay, onMenu, onHall }: { score: number; laddus: number; stage: number; growthScale: number; best: number; isNewBest: boolean; onReplay: () => void; onMenu: () => void; onHall: () => void }) {
  return (
    <main className="results-screen screen-enter">
      <section className="results-card">
        <div className="result-kicker">{isNewBest ? "A new summit mark" : "The route rests"}</div>
        <h1>{isNewBest ? "That was luminous." : "Beautiful run."}</h1>
        <div className="result-score" data-testid="text-result-score">{score.toString().padStart(4, "0")}</div>
        <div className="result-grid"><div className="result-metric"><small>Laddus</small><b data-testid="text-result-laddus">{laddus}</b></div><div className="result-metric"><small>Final size</small><b>{Math.round((growthScale / .84) * 100)}%</b></div><div className="result-metric"><small>Best</small><b>{best.toString().padStart(4, "0")}</b></div></div>
        <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Every hop is part of the journey. The mountains will be here when you are ready.</p>
        <div className="modal-actions" style={{ justifyContent: "center" }}><button className="primary-btn" onClick={onReplay} data-testid="button-replay"><RotateCcw size={16} /> Run it back</button><button className="text-btn" onClick={onHall} data-testid="button-results-hall"><Trophy size={15} /> Hall of fame</button><button className="text-btn" onClick={onMenu} data-testid="button-results-menu"><Home size={15} /> Menu</button></div>
      </section>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [best, setBest] = useState(() => readNumber(STORAGE.best, 0));
  const [hall, setHall] = useState<HallEntry[]>(readHall);
  const [sound, setSound] = useState(() => readBool(STORAGE.sound, true));
  const [music, setMusic] = useState(() => readBool(STORAGE.music, false));
  const [reducedMotion, setReducedMotion] = useState(() => readBool(STORAGE.reduced, false));
  const [score, setScore] = useState(0);
  const [laddus, setLaddus] = useState(0);
  const [stage, setStage] = useState(1);
  const [playerY, setPlayerY] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [signature, setSignature] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [levelCheer, setLevelCheer] = useState<CheerEvent | null>(null);
  const cheerTimeoutRef = useRef<number | null>(null);
  const runRef = useRef<RunState>({ playerY: .36, velocity: 0, distance: 0, score: 0, laddus: 0, speed: .24, elapsed: 0, liftTime: 0, growthScale: .84, growthTarget: .84, nextObstacle: .72, nextLaddu: .72, stage: 1, obstacles: [], trail: [], effects: [] });
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastPaintRef = useRef(0);
  const obstacleIdRef = useRef(0);
  const ladduIdRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const toggle = (key: string, value: boolean, setter: (next: boolean) => void) => {
    const next = !value;
    setter(next);
    save(key, next);
  };

  const startGame = useCallback(() => {
    if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current);
    setLevelCheer(null);
    runRef.current = {
      playerY: .36,
      velocity: 0,
      distance: 0,
      score: 0,
      laddus: 0,
      speed: .24,
      elapsed: 0,
      liftTime: 0,
      growthScale: .84,
      growthTarget: .84,
      nextObstacle: .72,
      nextLaddu: .72,
      stage: 1,
      obstacles: [{ id: obstacleIdRef.current++, x: .74, gapY: .5, gapSize: .34 }],
      trail: [{ id: ladduIdRef.current++, x: .68, y: .42 }],
      effects: [],
    };
    setScore(runRef.current.score);
    setLaddus(runRef.current.laddus);
    setStage(1);
    setPlayerY(.36);
    setCountdown(4);
    setSignature(false);
    setScreen("playing");
  }, []);

  const playLadduChime = useCallback(() => {
    if (!sound || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(990, now + .12);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.08, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + .17);
  }, [sound]);

  const playLevelUpFanfare = useCallback(() => {
    if (!sound || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }
    const now = context.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C major victory arpeggio
    chord.forEach((freq, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.0001, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.32);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.34);
    });
  }, [sound]);

  const beginFromMenu = () => {
    if (!readBool(STORAGE.tutorial, false)) setScreen("tutorial");
    else startGame();
  };

  const hop = useCallback(() => {
    if (screen === "playing" && countdown === null) {
      const run = runRef.current;
      run.velocity = Math.max(run.velocity, .00145);
      run.liftTime = .24;
      if (sound && typeof window !== "undefined" && "vibrate" in navigator) navigator.vibrate(7);
    } else if (screen === "paused") setScreen("playing");
  }, [countdown, screen, sound]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
        event.preventDefault();
        if (screen === "playing") {
          hop();
        } else if (screen === "menu") {
          beginFromMenu();
        } else if (screen === "tutorial") {
          save(STORAGE.tutorial, true);
          startGame();
        } else if (screen === "gameover") {
          startGame();
        } else if (screen === "paused") {
          setScreen("playing");
        }
      } else if (event.code === "Enter") {
        if (screen === "menu") {
          beginFromMenu();
        } else if (screen === "tutorial") {
          save(STORAGE.tutorial, true);
          startGame();
        } else if (screen === "gameover") {
          startGame();
        } else if (screen === "paused") {
          setScreen("playing");
        }
      }
      if (event.code === "Escape" && screen === "playing") {
        setScreen("paused");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hop, screen, startGame]);

  useEffect(() => {
    if (screen !== "playing" || countdown === null) return;
    const timer = window.setTimeout(() => {
      setCountdown((current) => current !== null && current > 1 ? current - 1 : null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, screen]);

  useEffect(() => {
    if (screen !== "playing" || countdown !== null) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const run = runRef.current;
      const dt = Math.min(34, now - lastFrameRef.current) / 16.67;
      lastFrameRef.current = now;
      run.elapsed += dt / 60;
      const growthEase = 1 - Math.pow(.05, dt / 18);
      run.growthScale += (run.growthTarget - run.growthScale) * growthEase;
      run.effects = run.effects
        .map((effect) => ({ ...effect, life: effect.life - dt / 60 }))
        .filter((effect) => effect.life > 0);
      if (run.liftTime > 0) {
        run.velocity += .00008 * dt;
        run.liftTime = Math.max(0, run.liftTime - dt / 60);
      }
      run.playerY += run.velocity * dt;
      run.velocity -= .00006 * dt;
      if (run.playerY <= 0) { run.playerY = 0; run.velocity = 0; }
      if (run.playerY >= .72) { run.playerY = .72; run.velocity = Math.min(0, run.velocity); }
      run.distance += run.speed * dt;
      run.nextObstacle -= run.speed * dt / 70;
      run.nextLaddu -= run.speed * dt / 70;
      
      // Dynamic pole gap adjusts automatically with Ganesha's growing size
      if (run.nextObstacle <= 0) {
        const pattern = Math.floor(run.distance / 80) % 3;
        const gapY = pattern === 1 ? .5 : pattern === 2 ? .58 : .44;
        const baseGap = Math.max(.28, .34 - Math.floor(run.distance / 200) * .008);
        const growthAdjustment = Math.max(0, (run.growthScale - 0.84) * 0.22);
        const gapSize = baseGap + growthAdjustment;
        run.obstacles.push({ id: obstacleIdRef.current++, x: 1.05, gapY, gapSize });
        run.nextObstacle = .72 + ((Math.floor(run.distance) % 2) * .08);
      }
      if (run.nextLaddu <= 0) {
        const arc = Math.floor(run.distance / 50) % 3;
        run.trail.push({ id: ladduIdRef.current++, x: 1.04, y: arc === 0 ? .38 : arc === 1 ? .45 : .52 });
        run.nextLaddu = .55 + (Math.floor(run.distance) % 3) * .13;
      }
      run.obstacles.forEach((obstacle) => { obstacle.x -= run.speed * dt / 70; });
      run.trail.forEach((laddu) => { laddu.x -= run.speed * dt / 70; });
      
      const riderScale = Math.min(1.2, run.growthScale / .84);
      const playerHeight = 0.13 * riderScale;
      const playerTop = run.playerY + playerHeight;
      const playerLeft = .41 - (riderScale - 1) * .01;
      const playerRight = .59 + (riderScale - 1) * .01;
      const poleWidth = .085 * getPoleScale(run.growthScale);
      
      const obstacleHit = run.obstacles.some((obstacle) => {
        const dynamicBonus = Math.max(0, (run.growthScale - 0.84) * 0.15);
        const effectiveGap = obstacle.gapSize + dynamicBonus;
        const gapBottom = obstacle.gapY - effectiveGap / 2;
        const gapTop = obstacle.gapY + effectiveGap / 2;
        const overlapsPlayer = obstacle.x < playerRight && obstacle.x + poleWidth > playerLeft;
        return overlapsPlayer && (playerTop > gapTop || run.playerY < gapBottom);
      });
      if (obstacleHit) {
        const finalScore = Math.floor(run.distance * 1.12) + run.laddus * 25;
        run.score = finalScore;
        setScore(finalScore);
        setStage(run.stage);
        setScreen("gameover");
        return;
      }
      
      const collected = run.trail.filter((laddu) => laddu.x < .66 && laddu.x > .36 && Math.abs((run.playerY + .05) - laddu.y) < .18);
      if (collected.length) {
        run.laddus += collected.length;
        setLaddus(run.laddus);
        run.trail = run.trail.filter((laddu) => !collected.includes(laddu));
        collected.forEach(() => {
          run.growthTarget = Math.min(1.68, run.growthTarget * 1.07);
          run.effects.push({ id: ladduIdRef.current++, x: .49, y: Math.min(.7, run.playerY + .15), life: .6 });
          playLadduChime();
        });
      }
      run.obstacles = run.obstacles.filter((obstacle) => obstacle.x > -.12);
      run.trail = run.trail.filter((laddu) => laddu.x > -.08);
      run.score = Math.floor(run.distance * 1.12) + run.laddus * 25;
      
      const newStage = run.laddus >= 20 ? 4 : run.laddus >= 12 ? 3 : run.laddus >= 5 ? 2 : 1;
      if (newStage > run.stage) {
        const was = run.stage;
        run.stage = newStage;
        setStage(newStage);
        
        // Trigger Cheering Level Passed Animation & Fanfare for all level advancements
        const stageInfo = STAGES[newStage - 1];
        const cheers = [
          "",
          "🎉 Great Hop! Snowline strength unlocked! 🎉",
          "⚡ Joyful Speed! Golden laddu aura radiating! ⚡",
          "🌟 Divine Summit Master! The mountains bow to you! 🌟",
        ];
        const cheerItem: CheerEvent = {
          stage: newStage,
          stageName: stageInfo.name,
          badge: `STAGE ${newStage} CLEARED!`,
          cheerMessage: cheers[newStage - 1] || "✨ Magnificent Run! Keep soaring! ✨",
          subtitle: stageInfo.detail,
          color: stageInfo.color,
        };
        setLevelCheer(cheerItem);
        playLevelUpFanfare();
        if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current);
        cheerTimeoutRef.current = window.setTimeout(() => {
          setLevelCheer(null);
        }, 2800);

        if (newStage === 4 && was < 4) {
          setSignature(true);
          window.setTimeout(() => setSignature(false), reducedMotion ? 1200 : 4300);
        }
      }
      if (now - lastPaintRef.current >= 24) {
        lastPaintRef.current = now;
        setPlayerY(run.playerY);
        setScore(run.score);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [countdown, playLadduChime, playLevelUpFanfare, screen, reducedMotion]);

  useEffect(() => {
    if (screen !== "gameover") return;
    const current = runRef.current;
    const finalScore = current.score;
    const newBest = finalScore > best;
    setIsNewBest(newBest);
    if (newBest) { setBest(finalScore); save(STORAGE.best, finalScore); }
    const entry: HallEntry = { score: finalScore, laddus: current.laddus, stage: current.stage, date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
    const updated = [...hall, entry].sort((a, b) => b.score - a.score).slice(0, 5);
    setHall(updated);
    save(STORAGE.hall, JSON.stringify(updated));
  }, [screen]);

  const displayedRun = useMemo(() => runRef.current, [screen, score, laddus, stage, playerY]);
  const settingsProps = { sound, music, reducedMotion, onSound: () => toggle(STORAGE.sound, sound, setSound), onMusic: () => toggle(STORAGE.music, music, setMusic), onReducedMotion: () => toggle(STORAGE.reduced, reducedMotion, setReducedMotion) };

  if (screen === "intro") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><IntroSplash onStart={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "menu") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><Menu best={best} sound={sound} onSound={() => toggle(STORAGE.sound, sound, setSound)} onStart={beginFromMenu} onSettings={() => setScreen("settings")} onHall={() => setScreen("hall")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "tutorial") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><Tutorial sound={sound} onSound={() => toggle(STORAGE.sound, sound, setSound)} onBegin={() => { save(STORAGE.tutorial, true); startGame(); }} onBack={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "settings") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><SettingsPage {...settingsProps} onBack={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "hall") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><HallOfFame entries={hall} best={best} sound={sound} onSound={() => toggle(STORAGE.sound, sound, setSound)} onBack={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "gameover") return <Results score={runRef.current.score} laddus={runRef.current.laddus} stage={runRef.current.stage} growthScale={runRef.current.growthScale} best={best} isNewBest={isNewBest} onReplay={() => startGame()} onMenu={() => setScreen("menu")} onHall={() => setScreen("hall")} />;
  return (
    <div className="mushak-app">
      <div className="game-wrap screen-enter">
        <div className="game-topbar">
          <div className="game-score"><strong data-testid="text-live-score">{score.toString().padStart(4, "0")}</strong><span>route score</span></div>
          <div className="score-pills"><div className="score-pill"><small>Laddus</small><b data-testid="text-live-laddus">{laddus.toString().padStart(2, "0")}</b></div><div className="score-pill"><small>Growth</small><b data-testid="text-live-stage">{stage}/4</b></div><button className="icon-btn" onClick={() => setScreen(screen === "playing" ? "paused" : "playing")} aria-label={screen === "playing" ? "Pause game" : "Resume game"} data-testid="button-pause"><Pause size={17} /></button></div>
        </div>
        <StageRail current={stage} score={score} />
        <GameScene run={displayedRun} playerY={playerY} signature={signature} countdown={countdown} onHop={hop} reducedMotion={reducedMotion} levelCheer={levelCheer} />
        {screen === "paused" && <div className="pause-overlay"><div className="pause-card"><div className="eyebrow">The route can wait</div><h2>Breath in the snow.</h2><p>Your run is paused exactly where you left it. Return when the next hop feels right.</p><div className="modal-actions"><button className="primary-btn" onClick={() => setScreen("playing")} data-testid="button-resume"><Play size={16} fill="currentColor" /> Continue run</button><button className="text-btn" onClick={() => setScreen("menu")} data-testid="button-quit-run"><Home size={15} /> Quit to menu</button></div></div></div>}
      </div>
    </div>
  );
}

export default function RootApp() {
  return <App />;
}