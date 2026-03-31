import { useEffect, useRef } from "react";

// ─── types ────────────────────────────────────────────────────────────────────
interface Joints {
  hx: number; hy: number;      // head center
  sx: number; sy: number;      // shoulder (arm branch + top of torso)
  bx: number; by: number;      // hip (leg branch + bottom of torso)
  laex: number; laey: number;  // left-arm elbow
  lahx: number; lahy: number;  // left-arm hand
  raex: number; raey: number;  // right-arm elbow
  rahx: number; rahy: number;  // right-arm hand
  llkx: number; llky: number;  // left-leg knee
  llax: number; llay: number;  // left-leg ankle
  rlkx: number; rlky: number;  // right-leg knee
  rlax: number; rlay: number;  // right-leg ankle
}

const HR = 14;   // head radius
const SW = 5.5;  // stroke width
const GND = 182; // ground y

// ─── helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function lerpPose(a: Joints, b: Joints, t: number): Joints {
  const r = {} as Joints;
  for (const k of Object.keys(a) as (keyof Joints)[])
    (r as Record<string, number>)[k] = lerp(a[k], b[k], t);
  return r;
}

function drawFigure(g: SVGGElement, p: Joints, color: string) {
  const c = color, s = SW;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${s}" stroke-linecap="round" stroke-linejoin="round"/>`;
  g.innerHTML = [
    // head (open circle)
    `<circle cx="${p.hx.toFixed(1)}" cy="${p.hy.toFixed(1)}" r="${HR}" stroke="${c}" stroke-width="${s}" fill="white"/>`,
    // torso
    line(p.sx, p.sy, p.bx, p.by),
    // left arm
    line(p.sx, p.sy, p.laex, p.laey),
    line(p.laex, p.laey, p.lahx, p.lahy),
    // right arm
    line(p.sx, p.sy, p.raex, p.raey),
    line(p.raex, p.raey, p.rahx, p.rahy),
    // left leg
    line(p.bx, p.by, p.llkx, p.llky),
    line(p.llkx, p.llky, p.llax, p.llay),
    // right leg
    line(p.bx, p.by, p.rlkx, p.rlky),
    line(p.rlkx, p.rlky, p.rlax, p.rlay),
    // ground
    `<line x1="16" y1="${GND}" x2="184" y2="${GND}" stroke="#ccc" stroke-width="1.5"/>`,
  ].join("");
}

// ─── exercise definitions ─────────────────────────────────────────────────────
interface ExerciseDef {
  label: string;
  color: string;
  cycle: number;
  poseA: Joints;
  poseB: Joints;
}

// standing neutral
const STAND: Joints = {
  hx:100, hy:30, sx:100, sy:64, bx:100, by:112,
  laex:83, laey:86, lahx:78, lahy:108,
  raex:117, raey:86, rahx:122, rahy:108,
  llkx:91, llky:145, llax:87, llay:GND,
  rlkx:109, rlky:145, rlax:113, rlay:GND,
};

const EXERCISES: ExerciseDef[] = [
  // 1. Walking
  {
    label: "Walking", color: "#E8B84B", cycle: 700,
    poseA: { hx:96, hy:30, sx:96, sy:63, bx:96, by:111,
      laex:108, laey:82, lahx:116, lahy:100,   // left arm swings back
      raex:80,  raey:78, rahx:70,  rahy:94,    // right arm swings forward
      llkx:80,  llky:148, llax:70,  llay:GND,  // left leg forward
      rlkx:112, rlky:145, rlax:122, rlay:GND,  // right leg back
    },
    poseB: { hx:96, hy:30, sx:96, sy:63, bx:96, by:111,
      laex:80,  laey:78, lahx:70,  lahy:94,    // arms swapped
      raex:108, raey:82, rahx:116, rahy:100,
      llkx:112, llky:145, llax:122, llay:GND,  // legs swapped
      rlkx:80,  rlky:148, rlax:70,  rlay:GND,
    },
  },
  // 2. Squat
  {
    label: "Squat", color: "#6366F1", cycle: 900,
    poseA: STAND,
    poseB: { hx:100, hy:72, sx:100, sy:100, bx:100, by:130,
      laex:80,  laey:114, lahx:65,  lahy:106,  // arms forward
      raex:120, raey:114, rahx:135, rahy:106,
      llkx:80,  llky:155, llax:80,  llay:GND,  // knees wide
      rlkx:120, rlky:155, rlax:120, rlay:GND,
    },
  },
  // 3. Push-up (side view, horizontal — use modified viewBox coords)
  {
    label: "Push-up", color: "#5EAAB5", cycle: 900,
    poseA: { hx:50, hy:96, sx:72, sy:114, bx:148, by:124,
      laex:72,  laey:144, lahx:62,  lahy:GND,
      raex:74,  raey:142, rahx:66,  rahy:GND,
      llkx:132, llky:136, llax:168, llay:GND,
      rlkx:134, rlky:136, rlax:170, rlay:GND,
    },
    poseB: { hx:50, hy:116, sx:72, sy:132, bx:148, by:132,
      laex:70,  laey:154, lahx:62,  lahy:GND,
      raex:72,  raey:152, rahx:66,  rahy:GND,
      llkx:132, llky:144, llax:168, llay:GND,
      rlkx:134, rlky:144, rlax:170, rlay:GND,
    },
  },
  // 4. Lunge
  {
    label: "Lunge", color: "#E8B84B", cycle: 900,
    poseA: { hx:100, hy:30, sx:100, sy:64, bx:100, by:112,
      laex:84, laey:86, lahx:78, lahy:108,
      raex:116, raey:86, rahx:122, rahy:108,
      llkx:78, llky:146, llax:68, llay:GND,   // front leg
      rlkx:122, rlky:160, rlax:132, rlay:GND, // back knee low
    },
    poseB: { hx:100, hy:30, sx:100, sy:64, bx:100, by:112,
      laex:84, laey:86, lahx:78, lahy:108,
      raex:116, raey:86, rahx:122, rahy:108,
      llkx:78, llky:160, llax:68, llay:GND,   // swapped
      rlkx:122, rlky:146, rlax:132, rlay:GND,
    },
  },
  // 5. Plank
  {
    label: "Plank", color: "#D97706", cycle: 1800,
    poseA: { hx:48, hy:95, sx:70, sy:112, bx:150, by:120,
      laex:70, laey:140, lahx:60, lahy:GND,
      raex:72, raey:138, rahx:64, rahy:GND,
      llkx:135, llky:132, llax:168, llay:GND,
      rlkx:137, rlky:132, rlax:170, rlay:GND,
    },
    poseB: { hx:48, hy:97, sx:70, sy:114, bx:150, by:122,
      laex:70, laey:140, lahx:60, lahy:GND,
      raex:72, raey:138, rahx:64, rahy:GND,
      llkx:135, llky:134, llax:168, llay:GND,
      rlkx:137, rlky:134, rlax:170, rlay:GND,
    },
  },
  // 6. Jumping Jacks
  {
    label: "Jumping Jacks", color: "#059669", cycle: 600,
    poseA: { hx:100, hy:30, sx:100, sy:64, bx:100, by:112,
      laex:83, laey:90, lahx:82, lahy:115,   // arms down by side
      raex:117, raey:90, rahx:118, rahy:115,
      llkx:95, llky:147, llax:93, llay:GND,  // feet together
      rlkx:105, rlky:147, rlax:107, rlay:GND,
    },
    poseB: { hx:100, hy:30, sx:100, sy:64, bx:100, by:112,
      laex:76, laey:46, lahx:60, lahy:28,    // arms up & out
      raex:124, raey:46, rahx:140, rahy:28,
      llkx:82, llky:150, llax:72, llay:GND,  // feet wide
      rlkx:118, rlky:150, rlax:128, rlay:GND,
    },
  },
  // 7. High Knees
  {
    label: "High Knees", color: "#5EAAB5", cycle: 500,
    poseA: { hx:100, hy:28, sx:100, sy:62, bx:100, by:110,
      laex:118, laey:78, lahx:126, lahy:96,  // left arm back
      raex:78,  raey:74, rahx:70,  rahy:90,  // right arm forward
      llkx:91,  llky:144, llax:88, llay:GND, // left leg standing
      rlkx:110, rlky:112, rlax:118, rlay:135, // right knee HIGH
    },
    poseB: { hx:100, hy:28, sx:100, sy:62, bx:100, by:110,
      laex:78,  laey:74, lahx:70,  lahy:90,  // arms swapped
      raex:118, raey:78, rahx:126, rahy:96,
      llkx:90,  llky:112, llax:82, llay:135, // left knee HIGH
      rlkx:109, rlky:144, rlax:112, rlay:GND,
    },
  },
  // 8. Burpee (squat → plank)
  {
    label: "Burpee", color: "#6366F1", cycle: 1200,
    poseA: { hx:100, hy:72, sx:100, sy:100, bx:100, by:130,
      laex:80, laey:114, lahx:65, lahy:106,
      raex:120, raey:114, rahx:135, rahy:106,
      llkx:80, llky:155, llax:80, llay:GND,
      rlkx:120, rlky:155, rlax:120, rlay:GND,
    },
    poseB: { hx:50, hy:96, sx:72, sy:114, bx:148, by:124,
      laex:72, laey:144, lahx:62, lahy:GND,
      raex:74, raey:142, rahx:66, rahy:GND,
      llkx:132, llky:136, llax:168, llay:GND,
      rlkx:134, rlky:136, rlax:170, rlay:GND,
    },
  },
  // 9. Mountain Climbers
  {
    label: "Mtn Climbers", color: "#5EAAB5", cycle: 500,
    poseA: { hx:50, hy:92, sx:72, sy:110, bx:148, by:120,
      laex:72, laey:138, lahx:62, lahy:GND,
      raex:74, raey:136, rahx:66, rahy:GND,
      llkx:102, llky:122, llax:110, llay:146, // left knee pulled in
      rlkx:136, rlky:134, rlax:168, rlay:GND, // right leg extended
    },
    poseB: { hx:50, hy:92, sx:72, sy:110, bx:148, by:120,
      laex:72, laey:138, lahx:62, lahy:GND,
      raex:74, raey:136, rahx:66, rahy:GND,
      llkx:136, llky:134, llax:168, llay:GND, // left extended
      rlkx:102, rlky:122, rlax:110, rlay:146, // right knee in
    },
  },
  // 10. Shadowboxing
  {
    label: "Shadowboxing", color: "#D97706", cycle: 600,
    poseA: { hx:98, hy:30, sx:98, sy:64, bx:98, by:112,
      laex:112, laey:68, lahx:134, lahy:56,  // left jab extended
      raex:110, raey:76, rahx:116, rahy:62,  // right guard
      llkx:86, llky:146, llax:78, llay:GND,  // fighting stance
      rlkx:112, rlky:142, rlax:118, rlay:GND,
    },
    poseB: { hx:98, hy:30, sx:98, sy:64, bx:98, by:112,
      laex:86, laey:76, lahx:80, lahy:62,    // left guard
      raex:82, raey:68, rahx:62, rahy:56,    // right jab extended
      llkx:112, llky:142, llax:118, llay:GND,
      rlkx:86, rlky:146, rlax:78, rlay:GND,
    },
  },
  // 11. Jump Squat
  {
    label: "Jump Squat", color: "#E11D48", cycle: 900,
    poseA: { hx:100, hy:72, sx:100, sy:100, bx:100, by:130,
      laex:80, laey:114, lahx:65, lahy:106,
      raex:120, raey:114, rahx:135, rahy:106,
      llkx:80, llky:155, llax:80, llay:GND,
      rlkx:120, rlky:155, rlax:120, rlay:GND,
    },
    poseB: { hx:100, hy:18, sx:100, sy:50, bx:100, by:96,   // in the air
      laex:82, laey:38, lahx:78, lahy:20,    // arms up
      raex:118, raey:38, rahx:122, rahy:20,
      llkx:88, llky:126, llax:84, llay:152,  // slightly tucked
      rlkx:112, rlky:126, rlax:116, rlay:152,
    },
  },
  // 12. Sprinting
  {
    label: "Sprinting", color: "#059669", cycle: 500,
    poseA: { hx:90, hy:26, sx:88, sy:60, bx:90, by:108,
      laex:104, laey:44, lahx:110, lahy:28,  // arm pump back
      raex:66,  raey:46, rahx:58,  rahy:30,  // arm pump forward
      llkx:76,  llky:148, llax:62,  llay:GND, // big stride forward
      rlkx:112, rlky:142, rlax:126, rlay:GND, // big stride back
    },
    poseB: { hx:90, hy:26, sx:88, sy:60, bx:90, by:108,
      laex:66,  laey:46, lahx:58,  lahy:30,
      raex:104, raey:44, rahx:110, rahy:28,
      llkx:112, llky:142, llax:126, llay:GND,
      rlkx:76,  rlky:148, rlax:62,  rlay:GND,
    },
  },
  // 13. Running in Place
  {
    label: "Running in Place", color: "#D97706", cycle: 500,
    poseA: { hx:100, hy:28, sx:100, sy:62, bx:100, by:110,
      laex:116, laey:74, lahx:122, lahy:56,  // arms pump
      raex:80,  raey:70, rahx:74,  rahy:52,
      llkx:90,  llky:144, llax:87, llay:GND, // left on ground
      rlkx:110, rlky:110, rlax:116, rlay:132, // right knee high
    },
    poseB: { hx:100, hy:28, sx:100, sy:62, bx:100, by:110,
      laex:80,  laey:70, lahx:74,  lahy:52,
      raex:116, raey:74, rahx:122, rahy:56,
      llkx:90,  llky:110, llax:84,  llay:132, // left knee high
      rlkx:110, rlky:144, rlax:113, rlay:GND,
    },
  },
  // 14. Yoga (Warrior II)
  {
    label: "Yoga", color: "#6366F1", cycle: 2500,
    poseA: { hx:100, hy:30, sx:100, sy:64, bx:100, by:114,
      laex:62,  laey:66, lahx:40,  lahy:66,  // arms wide / T-shape
      raex:138, raey:66, rahx:160, rahy:66,
      llkx:74,  llky:150, llax:66,  llay:GND,  // front knee bent
      rlkx:132, rlky:148, rlax:142, rlay:GND,  // back leg straight
    },
    poseB: { hx:100, hy:32, sx:100, sy:66, bx:100, by:116,
      laex:62,  laey:68, lahx:40,  lahy:68,
      raex:138, raey:68, rahx:160, rahy:68,
      llkx:74,  llky:150, llax:66,  llay:GND,
      rlkx:132, rlky:148, rlax:142, rlay:GND,
    },
  },
];

// ─── single exercise cell ─────────────────────────────────────────────────────
function ExerciseCell({ ex }: { ex: ExerciseDef }) {
  const gRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    let raf: number | null = null;
    let start: number | null = null;

    function tick(ts: number) {
      if (!start) start = ts;
      const phase = ((ts - start) % ex.cycle) / ex.cycle;
      const raw = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const t = ease(raw);
      if (gRef.current) drawFigure(gRef.current, lerpPose(ex.poseA, ex.poseB, t), ex.color);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "#1a1a1a", borderRadius: 12, padding: "10px 8px 8px",
      border: `1px solid ${ex.color}22`,
    }}>
      <svg viewBox="0 0 200 200" width={160} height={160} style={{ display: "block" }}>
        <g ref={gRef} />
      </svg>
      <span style={{
        marginTop: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
        color: ex.color, textTransform: "uppercase", fontFamily: "monospace",
        textAlign: "center",
      }}>
        {ex.label}
      </span>
    </div>
  );
}

// ─── gallery ──────────────────────────────────────────────────────────────────
export function PushupPictogram() {
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
        Exercise Animations · MoodRx
      </h1>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 12,
        maxWidth: 900,
      }}>
        {EXERCISES.map((ex) => (
          <ExerciseCell key={ex.label} ex={ex} />
        ))}
      </div>
    </div>
  );
}
