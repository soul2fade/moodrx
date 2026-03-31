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
    poseA: { hx:97, hy:30, sx:97, sy:63, bx:97, by:111,
      laex:103, laey:85, lahx:107, lahy:103,   // left arm slightly back (close to body)
      raex:91,  raey:81, rahx:87,  rahy:97,    // right arm slightly forward (close to body)
      llkx:82,  llky:148, llax:73,  llay:GND,  // left leg forward
      rlkx:111, rlky:144, rlax:120, rlay:GND,  // right leg back
    },
    poseB: { hx:97, hy:30, sx:97, sy:63, bx:97, by:111,
      laex:91,  laey:81, lahx:87,  lahy:97,    // arms swapped
      raex:103, raey:85, rahx:107, rahy:103,
      llkx:111, llky:144, llax:120, llay:GND,  // legs swapped
      rlkx:82,  rlky:148, rlax:73,  rlay:GND,
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
  // 3. Push-up — body/legs are ONE collinear line at ~30° from ground
  {
    label: "Push-up", color: "#5EAAB5", cycle: 900,
    // Line A: shoulder(58,112)→ankle(172,182), slope≈30°. Hip & knee on same line.
    poseA: { hx:46, hy:99,  sx:58, sy:112, bx:121, by:151,  // torso on line
      laex:56, laey:148, lahx:53, lahy:GND,  // arm nearly straight (up)
      raex:58, raey:148, rahx:55, rahy:GND,
      llkx:152, llky:169, llax:172, llay:GND, // knee & ankle on same line
      rlkx:154, rlky:169, rlax:174, rlay:GND,
    },
    // Line B: shoulder(58,132)→ankle(172,182), shallower. Hip & knee on same line.
    poseB: { hx:46, hy:119, sx:58, sy:132, bx:121, by:160,
      laex:50, laey:158, lahx:53, lahy:GND,  // elbow bends outward (down)
      raex:52, raey:157, rahx:55, rahy:GND,
      llkx:152, llky:173, llax:172, llay:GND,
      rlkx:154, rlky:173, rlax:174, rlay:GND,
    },
  },
  // 4. Lunge — side profile, back foot stays planted, front leg lunges right
  {
    label: "Lunge", color: "#E8B84B", cycle: 1400,
    // poseA: standing, both feet near center
    poseA: { hx:108, hy:30, sx:98, sy:64, bx:98, by:112,
      laex:112, laey:86, lahx:118, lahy:103,
      raex:84,  raey:88, rahx:78,  rahy:105,
      llkx:100, llky:146, llax:102, llay:GND, // front leg (will step right)
      rlkx:96,  rlky:146, rlax:96,  rlay:GND, // back leg (foot stays at x≈96)
    },
    // poseB: deep lunge — front leg way right, back foot STAYS at x=96
    poseB: { hx:108, hy:44, sx:98, sy:78, bx:98, by:122,
      laex:116, laey:96, lahx:124, lahy:110,
      raex:80,  raey:96, rahx:72,  rahy:110,
      llkx:142, llky:148, llax:160, llay:GND, // front foot lunges right
      rlkx:82,  rlky:162, rlax:96,  rlay:GND, // back FOOT stays (x=96), knee drops
    },
  },
  // 5. Plank — forearm plank, collinear body/legs, same line as push-up
  {
    label: "Plank", color: "#D97706", cycle: 2000,
    poseA: { hx:46, hy:99, sx:58, sy:112, bx:121, by:151,  // perfectly straight
      laex:65, laey:GND, lahx:48, lahy:GND,   // forearm flat on ground
      raex:67, raey:GND, rahx:50, rahy:GND,
      llkx:152, llky:169, llax:172, llay:GND, // legs on same line
      rlkx:154, rlky:169, rlax:174, rlay:GND,
    },
    poseB: { hx:46, hy:102, sx:58, sy:114, bx:121, by:154, // slight hip sag
      laex:65, laey:GND, lahx:48, lahy:GND,
      raex:67, raey:GND, rahx:50, rahy:GND,
      llkx:152, llky:171, llax:172, llay:GND,
      rlkx:154, rlky:171, rlax:174, rlay:GND,
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
  // 7. High Knees — bent-elbow pump arms, no spinning
  {
    label: "High Knees", color: "#5EAAB5", cycle: 500,
    poseA: { hx:100, hy:28, sx:100, sy:62, bx:100, by:110,
      laex:108, laey:76, lahx:112, lahy:92,  // left elbow back, forearm down
      raex:92,  raey:72, rahx:88,  rahy:56,  // right elbow fwd, forearm up
      llkx:91,  llky:144, llax:88, llay:GND, // left leg standing
      rlkx:110, rlky:112, rlax:118, rlay:135, // right knee HIGH
    },
    poseB: { hx:100, hy:28, sx:100, sy:62, bx:100, by:110,
      laex:92,  laey:72, lahx:88,  lahy:56,  // arms swapped
      raex:108, raey:76, rahx:112, rahy:92,
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
  // 10. Shadowboxing — side profile, hands up in guard, jab extends right
  {
    label: "Shadowboxing", color: "#D97706", cycle: 600,
    poseA: { hx:106, hy:30, sx:96, sy:64, bx:96, by:113,   // head turned right (profile)
      laex:114, laey:67, lahx:130, lahy:58,  // front guard hand, slightly extended
      raex:104, raey:69, rahx:114, rahy:58,  // rear guard, compact near chin
      llkx:83, llky:148, llax:74, llay:GND,  // back leg
      rlkx:112, rlky:146, rlax:122, rlay:GND, // front leg
    },
    poseB: { hx:106, hy:30, sx:96, sy:64, bx:96, by:113,
      laex:128, laey:62, lahx:154, lahy:54,  // jab fully extended rightward
      raex:104, raey:69, rahx:114, rahy:58,  // rear guard stays compact
      llkx:83, llky:148, llax:74, llay:GND,
      rlkx:113, rlky:146, rlax:123, rlay:GND,
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
  // 12. Sprinting — side profile, knee lifts visible, arm swings like shadowboxing
  {
    label: "Sprinting", color: "#059669", cycle: 450,
    // poseA: left knee lifted high, right arm forward, right leg pushing off
    poseA: { hx:108, hy:24, sx:96, sy:58, bx:97, by:106,  // head right, lean fwd
      laex:82,  laey:70, lahx:76,  lahy:86,   // left arm back (elbow bent)
      raex:110, raey:70, rahx:118, rahy:55,   // right arm forward (elbow up)
      llkx:82,  llky:115, llax:76,  llay:138, // left knee HIGH, foot tucked
      rlkx:116, rlky:146, rlax:130, rlay:GND, // right leg on ground
    },
    // poseB: right knee lifted, left arm forward
    poseB: { hx:108, hy:24, sx:96, sy:58, bx:97, by:106,
      laex:110, laey:70, lahx:118, lahy:55,   // left arm forward
      raex:82,  raey:70, rahx:76,  rahy:86,   // right arm back
      llkx:116, llky:146, llax:130, llay:GND, // left leg on ground
      rlkx:82,  rlky:115, rlax:76,  rlay:138, // right knee HIGH
    },
  },
  // 13. Running in Place — side profile matching sprinting, upright torso
  {
    label: "Running in Place", color: "#D97706", cycle: 480,
    // poseA: left knee high, right arm forward
    poseA: { hx:108, hy:26, sx:96, sy:60, bx:97, by:108, // head right, body offset like sprint
      laex:82,  laey:72, lahx:76,  lahy:88,   // left arm back, elbow bent
      raex:110, raey:72, rahx:118, rahy:57,   // right arm forward, elbow up
      llkx:84,  llky:112, llax:78,  llay:136, // left knee HIGH, foot tucked
      rlkx:108, rlky:148, rlax:112, rlay:GND, // right foot on ground
    },
    // poseB: right knee high, left arm forward
    poseB: { hx:108, hy:26, sx:96, sy:60, bx:97, by:108,
      laex:110, laey:72, lahx:118, lahy:57,   // left arm forward
      raex:82,  raey:72, rahx:76,  rahy:88,   // right arm back
      llkx:108, llky:148, llax:112, llay:GND, // left foot on ground
      rlkx:84,  rlky:112, rlax:78,  rlay:136, // right knee HIGH
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
