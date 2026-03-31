import { useEffect, useRef } from "react";

// ─── helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── mood definitions ─────────────────────────────────────────────────────────
interface MoodDef {
  key: string;
  label: string;
  color: string;
  cycle: number;
  draw: (svg: SVGSVGElement, t: number) => void;
}

const W = 200;
const H = 200;

function makeLine(x1: number, y1: number, x2: number, y2: number, color: string, sw = 3): string {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

function makePath(d: string, color: string, sw = 3, opacity = 1): string {
  return `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

function makePolyline(points: string, color: string, sw = 3): string {
  return `<polyline points="${points}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ─── Anxious: EKG spike sweeps left-to-right ──────────────────────────────────
// The entire EKG waveform translates horizontally as if scrolling
function drawAnxious(svg: SVGSVGElement, t: number) {
  const color = "#E8B84B";
  const base = H * 0.56;

  // Offset sweeps from -W to 0 (spike moves right to left across view)
  const offsetX = lerp(-W * 0.6, W * 0.4, t);

  // EKG shape relative to local coordinate
  const pts: [number, number][] = [
    [0, base],
    [W * 0.26, base],
    [W * 0.34, H * 0.64],
    [W * 0.42, H * 0.08],
    [W * 0.51, H * 0.92],
    [W * 0.59, base],
    [W, base],
  ];

  // Translate all points by offsetX
  const translated = pts.map(([x, y]) => [x + offsetX, y] as [number, number]);

  // Build path
  const d = translated.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  // Clip via SVG clipPath
  svg.innerHTML = `
    <defs>
      <clipPath id="ekgclip">
        <rect x="10" y="0" width="${W - 20}" height="${H}"/>
      </clipPath>
    </defs>
    <g clip-path="url(#ekgclip)">
      ${makePath(d, color, 3.5)}
    </g>
    <line x1="10" y1="${base}" x2="${W - 10}" y2="${base}" stroke="${color}" stroke-width="1" opacity="0.2" stroke-dasharray="4 4"/>
  `;
}

// ─── Low: 3 fading arcs simultaneously grow tall then compress (squat) ────────
function drawLow(svg: SVGSVGElement, t: number) {
  const color = "#6366F1";
  const baseline = H * 0.74;
  const seg = W / 4;

  // Arc heights: at t=0 small, at t=1 tall
  const r1 = lerp(H * 0.08, H * 0.38, t);
  const r2 = lerp(H * 0.05, H * 0.24, t);
  const r3 = lerp(H * 0.03, H * 0.13, t);

  const arc = (x1: number, x2: number, r: number) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1.toFixed(2)},${baseline} Q ${mx.toFixed(2)},${(baseline - r * 2).toFixed(2)} ${x2.toFixed(2)},${baseline}`;
  };

  svg.innerHTML = [
    makePath(arc(0, seg, r1), color, 3.5),
    makePath(arc(seg, seg * 2, r2), color, 3.5),
    makePath(arc(seg * 2, seg * 3, r3), color, 3.5),
    makeLine(seg * 3, baseline, W, baseline, color, 3.5),
  ].join("");
}

// ─── Foggy: wave amplitude pulses from flat to full (breathing) ───────────────
function drawFoggy(svg: SVGSVGElement, t: number) {
  const color = "#5EAAB5";
  const gap = H * 0.22;
  const startY = H * 0.28;
  const maxAmp = H * 0.075;

  const amp1 = lerp(H * 0.005, maxAmp, t);
  const amp2 = lerp(H * 0.005, maxAmp * 0.9, t);
  const amp3 = lerp(H * 0.005, maxAmp * 0.75, t);

  const wavePath = (y: number, amp: number) => {
    const s = W / 4;
    return `M 0,${y} Q ${s * 0.5},${y - amp} ${s},${y} Q ${s * 1.5},${y + amp} ${s * 2},${y} Q ${s * 2.5},${y - amp} ${s * 3},${y} Q ${s * 3.5},${y + amp} ${W},${y}`;
  };

  svg.innerHTML = [
    makePath(wavePath(startY, amp1), color, 3.5, 1),
    makePath(wavePath(startY + gap, amp2), color, 3.5, 0.6),
    makePath(wavePath(startY + gap * 2, amp3), color, 3.5, 0.28),
  ].join("");
}

// ─── Restless: 5 arcs alternate tall/short left-to-right wave (running legs) ──
function drawRestless(svg: SVGSVGElement, t: number) {
  const color = "#D97706";
  const baseline = H * 0.78;
  const numArcs = 5;
  const arcW = W / numArcs;
  const maxH = H * 0.52;
  const minH = H * 0.12;

  const arcs = Array.from({ length: numArcs }, (_, i) => {
    // Phase offset per arc to create a wave
    const phaseOffset = i / numArcs;
    const localT = (t + phaseOffset) % 1;
    const raw = localT < 0.5 ? localT * 2 : (1 - localT) * 2;
    const arcH = lerp(minH, maxH, ease(raw));
    const x1 = i * arcW;
    const x2 = (i + 1) * arcW;
    const mx = (x1 + x2) / 2;
    return `M ${x1.toFixed(2)},${baseline} Q ${mx.toFixed(2)},${(baseline - arcH).toFixed(2)} ${x2.toFixed(2)},${baseline}`;
  });

  svg.innerHTML = arcs.map(d => makePath(d, color, 3.5)).join("");
}

// ─── Stressed: lines spread/compress + chevron flips (pushup) ─────────────────
function drawStressed(svg: SVGSVGElement, t: number) {
  const color = "#E11D48";
  const lx1 = W * 0.05;
  const lx2 = W * 0.95;

  // Lines: at t=0 compressed together, at t=1 spread apart
  const lineYsCompressed = [H * 0.54, H * 0.64, H * 0.72, H * 0.79];
  const lineYsSpread = [H * 0.44, H * 0.6, H * 0.74, H * 0.88];
  const lineYs = lineYsCompressed.map((yc, i) => lerp(yc, lineYsSpread[i], t));

  // Chevron: at t=0 pointing down (compressed), at t=1 pointing up (pushup up)
  const chevronTipYDown = H * 0.42;
  const chevronTipYUp = H * 0.16;
  const chevronTipY = lerp(chevronTipYDown, chevronTipYUp, t);
  const chevronWingY = lerp(H * 0.24, H * 0.28, t);

  const chevronPoints = `${(W * 0.15).toFixed(2)},${chevronWingY.toFixed(2)} ${(W * 0.5).toFixed(2)},${chevronTipY.toFixed(2)} ${(W * 0.85).toFixed(2)},${chevronWingY.toFixed(2)}`;

  svg.innerHTML = [
    makePolyline(chevronPoints, color, 3.5),
    ...lineYs.map(y => makeLine(lx1, y, lx2, y, color, 3.5)),
  ].join("");
}

// ─── Good: bell curve bounces upward and peak grows/shrinks (jump) ────────────
function drawGood(svg: SVGSVGElement, t: number) {
  const color = "#059669";

  // Baseline moves down slightly as peak grows (like a jump)
  const base = lerp(H * 0.78, H * 0.88, t);
  const peakY = lerp(H * 0.48, H * 0.06, t);

  const d = [
    `M 0,${base.toFixed(2)}`,
    `L ${(W * 0.15).toFixed(2)},${base.toFixed(2)}`,
    `Q ${(W * 0.28).toFixed(2)},${base.toFixed(2)} ${(W * 0.37).toFixed(2)},${(peakY * 1.18).toFixed(2)}`,
    `Q ${(W * 0.5).toFixed(2)},${peakY.toFixed(2)} ${(W * 0.63).toFixed(2)},${(peakY * 1.18).toFixed(2)}`,
    `Q ${(W * 0.72).toFixed(2)},${base.toFixed(2)} ${(W * 0.85).toFixed(2)},${base.toFixed(2)}`,
    `L ${W},${base.toFixed(2)}`,
  ].join(" ");

  svg.innerHTML = makePath(d, color, 3.5);
}

// ─── mood definitions ─────────────────────────────────────────────────────────
const MOODS: MoodDef[] = [
  { key: "anxious",  label: "Anxious",  color: "#E8B84B", cycle: 1200, draw: drawAnxious },
  { key: "low",      label: "Low",      color: "#6366F1", cycle: 900,  draw: drawLow },
  { key: "foggy",    label: "Foggy",    color: "#5EAAB5", cycle: 2200, draw: drawFoggy },
  { key: "restless", label: "Restless", color: "#D97706", cycle: 800,  draw: drawRestless },
  { key: "stressed", label: "Stressed", color: "#E11D48", cycle: 1000, draw: drawStressed },
  { key: "good",     label: "Good",     color: "#059669", cycle: 750,  draw: drawGood },
];

// ─── single mood cell ─────────────────────────────────────────────────────────
function MoodCell({ mood }: { mood: MoodDef }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let raf: number | null = null;
    let start: number | null = null;

    function tick(ts: number) {
      if (!start) start = ts;
      const phase = ((ts - start) % mood.cycle) / mood.cycle;
      const raw = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const t = ease(raw);
      if (svgRef.current) mood.draw(svgRef.current, t);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "#1a1a1a", borderRadius: 12, padding: "10px 8px 8px",
      border: `1px solid ${mood.color}22`,
    }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={160}
        height={160}
        style={{ display: "block" }}
      />
      <span style={{
        marginTop: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
        color: mood.color, textTransform: "uppercase", fontFamily: "monospace",
        textAlign: "center",
      }}>
        {mood.label}
      </span>
    </div>
  );
}

// ─── gallery ──────────────────────────────────────────────────────────────────
export function MoodSymbolExercise() {
  return (
    <div style={{
      minHeight: "100vh", background: "#111",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
    }}>
      <h1 style={{
        color: "#fff", fontFamily: "monospace", fontSize: 15, letterSpacing: "0.15em",
        textTransform: "uppercase", marginBottom: 24, opacity: 0.5,
      }}>
        Mood Symbol Exercise · MoodRx
      </h1>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        maxWidth: 560,
      }}>
        {MOODS.map((mood) => (
          <MoodCell key={mood.key} mood={mood} />
        ))}
      </div>
    </div>
  );
}
