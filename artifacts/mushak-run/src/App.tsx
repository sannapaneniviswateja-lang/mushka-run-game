import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowUp, ChevronLeft, CircleHelp, Eye, Home, Medal, Music2, Pause, Play, RotateCcw, Settings, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

type Screen = "menu" | "tutorial" | "playing" | "paused" | "gameover" | "settings" | "hall";
type HallEntry = { score: number; laddus: number; stage: number; date: string };
type Obstacle = { id: number; x: number; gapY: number; gapSize: number };
type TrailLaddu = { id: number; x: number; y: number };
type RunState = {
  playerY: number;
  velocity: number;
  distance: number;
  score: number;
  laddus: number;
  speed: number;
  elapsed: number;
  nextObstacle: number;
  nextLaddu: number;
  stage: number;
  obstacles: Obstacle[];
  trail: TrailLaddu[];
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
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function readBool(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

function save(key: string, value: string | number | boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, String(value));
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

const flakes = seededFlakes(30);

function MushakRider({ stage = 1, className = "", style }: { stage?: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rider-sprite-shell stage-${stage} ${className}`} style={style} role="img" aria-label="Ganesha riding Mushak">
      {stage === 4 && <span className="rider-aura" aria-hidden="true" />}
      <img
        className="rider-sprite"
        src={`${import.meta.env.BASE_URL}ganesha-mushak-rider.png`}
        alt="Ganesha riding Mushak"
        draggable="false"
      />
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

function SceneDecor() {
  return <>{flakes.map((flake, index) => <span className="flake" key={index} style={{ left: flake.left, top: flake.top, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size }} />)}</>;
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

function GameScene({ run, playerY, signature, onHop }: { run: RunState; playerY: number; signature: boolean; onHop: () => void }) {
  const phase = run.elapsed % 48;
  const timeClass = phase > 34 ? "night" : phase > 23 ? "dusk" : "";
  const playerStyle = {
    bottom: `calc(12% + ${Math.min(playerY, .46) * 100}%)`,
    "--growth-scale": Math.min(1.3, 0.84 + run.laddus * 0.02),
  } as CSSProperties;
  return (
    <div className={`playfield ${timeClass}`} onPointerDown={onHop} role="application" aria-label="Mushak Run gameplay. Tap, click, or press Space to hop." data-testid="game-playfield">
      <Mountains dark={timeClass === "night"} />
      <SceneDecor />
      <div className="game-track" />
      {run.trail.map((laddu) => <div className="laddu" key={laddu.id} style={{ left: `${laddu.x * 100}%`, bottom: `calc(12% + ${laddu.y * 100}%)` }} data-testid={`laddu-${laddu.id}`} />)}
      {run.obstacles.map((obstacle) => {
        const gapBottom = obstacle.gapY - obstacle.gapSize / 2;
        const gapTop = obstacle.gapY + obstacle.gapSize / 2;
        return (
          <div className="pipe-pair" key={obstacle.id} data-testid={`obstacle-${obstacle.id}`}>
            <div className="pipe pipe-top" style={{ left: `${obstacle.x * 100}%`, height: `${Math.max(18, 88 - gapTop * 100)}%` }} />
            <div className="pipe pipe-bottom" style={{ left: `${obstacle.x * 100}%`, height: `${Math.max(14, gapBottom * 100)}%` }} />
          </div>
        );
      })}
      <MushakRider className={`runner stage-${run.stage}`} stage={run.stage} style={playerStyle} />
      <div className="tap-hint"><ArrowUp size={12} /> hop to keep the route</div>
      {signature && <div className="signature"><div className="signature-card"><div className="seal"><Sparkles size={47} /></div><strong>Maha Ganesha</strong><span>the summit remembers courage</span></div></div>}
      <div className="hud-message" key={`${run.stage}-${signature}`}>{signature ? "" : run.stage > 1 && run.elapsed < 2 ? STAGES[run.stage - 1].name : ""}</div>
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

function Results({ score, laddus, stage, best, isNewBest, onReplay, onMenu, onHall }: { score: number; laddus: number; stage: number; best: number; isNewBest: boolean; onReplay: () => void; onMenu: () => void; onHall: () => void }) {
  return (
    <main className="results-screen screen-enter">
      <section className="results-card">
        <div className="result-kicker">{isNewBest ? "A new summit mark" : "The route rests"}</div>
        <h1>{isNewBest ? "That was luminous." : "Beautiful run."}</h1>
        <div className="result-score" data-testid="text-result-score">{score.toString().padStart(4, "0")}</div>
        <div className="result-grid"><div className="result-metric"><small>Laddus</small><b data-testid="text-result-laddus">{laddus}</b></div><div className="result-metric"><small>Growth</small><b>{STAGES[stage - 1].name}</b></div><div className="result-metric"><small>Best</small><b>{best.toString().padStart(4, "0")}</b></div></div>
        <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Every hop is part of the journey. The mountains will be here when you are ready.</p>
        <div className="modal-actions" style={{ justifyContent: "center" }}><button className="primary-btn" onClick={onReplay} data-testid="button-replay"><RotateCcw size={16} /> Run it back</button><button className="text-btn" onClick={onHall} data-testid="button-results-hall"><Trophy size={15} /> Hall of fame</button><button className="text-btn" onClick={onMenu} data-testid="button-results-menu"><Home size={15} /> Menu</button></div>
      </section>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [best, setBest] = useState(() => readNumber(STORAGE.best, 0));
  const [hall, setHall] = useState<HallEntry[]>(readHall);
  const [sound, setSound] = useState(() => readBool(STORAGE.sound, true));
  const [music, setMusic] = useState(() => readBool(STORAGE.music, false));
  const [reducedMotion, setReducedMotion] = useState(() => readBool(STORAGE.reduced, false));
  const [score, setScore] = useState(0);
  const [laddus, setLaddus] = useState(0);
  const [stage, setStage] = useState(1);
  const [playerY, setPlayerY] = useState(0);
  const [signature, setSignature] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const runRef = useRef<RunState>({ playerY: 0, velocity: 0, distance: 0, score: 0, laddus: 0, speed: .2, elapsed: 0, nextObstacle: 1.3, nextLaddu: .72, stage: 1, obstacles: [], trail: [] });
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastPaintRef = useRef(0);
  const obstacleIdRef = useRef(0);
  const ladduIdRef = useRef(0);
  const toggle = (key: string, value: boolean, setter: (next: boolean) => void) => {
    const next = !value;
    setter(next);
    save(key, next);
  };

  const startGame = useCallback(() => {
    runRef.current = { playerY: 0, velocity: 0, distance: 0, score: 0, laddus: 0, speed: .2, elapsed: 0, nextObstacle: 1.3, nextLaddu: .72, stage: 1, obstacles: [], trail: [] };
    setScore(runRef.current.score);
    setLaddus(runRef.current.laddus);
    setStage(1);
    setPlayerY(0);
    setSignature(false);
    setScreen("playing");
  }, []);

  const beginFromMenu = () => {
    if (!readBool(STORAGE.tutorial, false)) setScreen("tutorial");
    else startGame();
  };

  const hop = useCallback(() => {
    if (screen === "playing") {
      const run = runRef.current;
      if (run.playerY <= .025 && run.velocity <= 0) {
        run.velocity = .06;
        if (sound && typeof window !== "undefined" && "vibrate" in navigator) navigator.vibrate(7);
      }
    } else if (screen === "paused") setScreen("playing");
  }, [screen, sound]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        hop();
      }
      if (event.code === "Escape" && screen === "playing") setScreen("paused");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hop, screen]);

  useEffect(() => {
    if (screen !== "playing") {
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
      run.playerY += run.velocity * dt;
      // Keep the arc gentle and readable instead of snapping down like a stone.
      run.velocity -= .0036 * dt;
      if (run.playerY <= 0) { run.playerY = 0; run.velocity = 0; }
      run.distance += run.speed * dt;
      run.speed = Math.min(.42, run.speed + .00012 * dt);
      run.nextObstacle -= run.speed * dt / 70;
      run.nextLaddu -= run.speed * dt / 70;
      if (run.nextObstacle <= 0) {
        const pattern = Math.floor(run.distance / 80) % 3;
        const gapY = pattern === 1 ? .5 : pattern === 2 ? .58 : .44;
        const gapSize = Math.max(.24, .3 - Math.floor(run.distance / 180) * .01);
        run.obstacles.push({ id: obstacleIdRef.current++, x: 1.05, gapY, gapSize });
        run.nextObstacle = 1.3 + ((Math.floor(run.distance) % 4) * .18);
      }
      if (run.nextLaddu <= 0) {
        const arc = Math.floor(run.distance / 50) % 3;
        run.trail.push({ id: ladduIdRef.current++, x: 1.04, y: arc === 0 ? .08 : arc === 1 ? .24 : .34 });
        run.nextLaddu = .55 + (Math.floor(run.distance) % 3) * .13;
      }
      run.obstacles.forEach((obstacle) => { obstacle.x -= run.speed * dt / 70; });
      run.trail.forEach((laddu) => { laddu.x -= run.speed * dt / 70; });
      const playerTop = run.playerY + .15;
      const obstacleHit = run.obstacles.some((obstacle) => {
        const gapBottom = obstacle.gapY - obstacle.gapSize / 2;
        const gapTop = obstacle.gapY + obstacle.gapSize / 2;
        const overlapsPlayer = obstacle.x < .28 && obstacle.x + .09 > .08;
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
      // Match the forgiving feel of a bird-style game: the laddu can touch
      // either the rider or Mushak, and its visual position uses the same
      // baseline as the physics.
      const collected = run.trail.filter((laddu) => laddu.x < .29 && laddu.x > .06 && Math.abs((run.playerY + .045) - laddu.y) < .14);
      if (collected.length) {
        run.laddus += collected.length;
        setLaddus(run.laddus);
        run.trail = run.trail.filter((laddu) => !collected.includes(laddu));
      }
      run.obstacles = run.obstacles.filter((obstacle) => obstacle.x > -.12);
      run.trail = run.trail.filter((laddu) => laddu.x > -.08);
      run.score = Math.floor(run.distance * 1.12) + run.laddus * 25;
      const newStage = run.laddus >= 20 ? 4 : run.laddus >= 12 ? 3 : run.laddus >= 5 ? 2 : 1;
      if (newStage > run.stage) {
        const was = run.stage;
        run.stage = newStage;
        setStage(newStage);
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
  }, [screen, reducedMotion]);

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

  if (screen === "menu") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><Menu best={best} sound={sound} onSound={() => toggle(STORAGE.sound, sound, setSound)} onStart={beginFromMenu} onSettings={() => setScreen("settings")} onHall={() => setScreen("hall")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "tutorial") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><Tutorial sound={sound} onSound={() => toggle(STORAGE.sound, sound, setSound)} onBegin={() => { save(STORAGE.tutorial, true); startGame(); }} onBack={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "settings") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><SettingsPage {...settingsProps} onBack={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "hall") return <QueryClientProvider client={queryClient}><TooltipProvider><div className="mushak-app"><HallOfFame entries={hall} best={best} sound={sound} onSound={() => toggle(STORAGE.sound, sound, setSound)} onBack={() => setScreen("menu")} /></div><Toaster /></TooltipProvider></QueryClientProvider>;
  if (screen === "gameover") return <Results score={runRef.current.score} laddus={runRef.current.laddus} stage={runRef.current.stage} best={best} isNewBest={isNewBest} onReplay={() => startGame()} onMenu={() => setScreen("menu")} onHall={() => setScreen("hall")} />;
  return (
    <div className="mushak-app">
      <div className="game-wrap screen-enter">
        <div className="game-topbar">
          <div className="game-score"><strong data-testid="text-live-score">{score.toString().padStart(4, "0")}</strong><span>route score</span></div>
          <div className="score-pills"><div className="score-pill"><small>Laddus</small><b data-testid="text-live-laddus">{laddus.toString().padStart(2, "0")}</b></div><div className="score-pill"><small>Growth</small><b data-testid="text-live-stage">{stage}/4</b></div><button className="icon-btn" onClick={() => setScreen(screen === "playing" ? "paused" : "playing")} aria-label={screen === "playing" ? "Pause game" : "Resume game"} data-testid="button-pause"><Pause size={17} /></button></div>
        </div>
        <StageRail current={stage} score={score} />
        <GameScene run={displayedRun} playerY={playerY} signature={signature} onHop={hop} />
        {screen === "paused" && <div className="pause-overlay"><div className="pause-card"><div className="eyebrow">The route can wait</div><h2>Breath in the snow.</h2><p>Your run is paused exactly where you left it. Return when the next hop feels right.</p><div className="modal-actions"><button className="primary-btn" onClick={() => setScreen("playing")} data-testid="button-resume"><Play size={16} fill="currentColor" /> Continue run</button><button className="text-btn" onClick={() => setScreen("menu")} data-testid="button-quit-run"><Home size={15} /> Quit to menu</button></div></div></div>}
      </div>
    </div>
  );
}

export default function RootApp() {
  return <App />;
}