import { useEffect, useRef } from "react";

export function PushupPictogram() {
  const animRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const groupRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    let start: number | null = null;
    const CYCLE = 1400; // ms per full push-up cycle

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function tick(ts: number) {
      if (!start) start = ts;
      const elapsed = (ts - start) % CYCLE;
      const phase = elapsed / CYCLE; // 0 → 1

      // Down half (0→0.5) then Up half (0.5→1)
      const raw = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const t = easeInOut(raw); // 0 = up position, 1 = down position
      tRef.current = t;

      if (groupRef.current) {
        renderFrame(groupRef.current, t);
      }
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 300 300"
        width="420"
        height="420"
        style={{ display: "block" }}
      >
        <g ref={groupRef} />
      </svg>
    </div>
  );
}

/*
  Figure anatomy (all measurements in SVG units):
  - Head: circle r=18 at (150, 50)
  - Torso: rigid rectangle, pivots at shoulders
  - Arms: two line segments elbow-wrist-ground
  - Legs: rigid, flat on ground
  Ground reference: y=200
*/
function renderFrame(g: SVGGElement, t: number) {
  // t=0: up (arms extended), t=1: down (chest near ground)
  const SW = 10; // stroke width
  const COL = "#1a1a1a";

  // Fixed geometry
  const GROUND_Y = 218;
  const FOOT_X = 218; // where feet touch ground
  const HAND_X = 80; // where hands touch ground

  // Arms: at t=0 (up), torso high; at t=1 (down), torso low
  const shoulderY_up = 128;
  const shoulderY_down = 175;
  const shoulderY = shoulderY_up + (shoulderY_down - shoulderY_up) * t;

  const shoulderX = 148;

  // Elbow: stiff, moves with shoulder
  // At up: elbow x=114, y=180; at down: elbow x=100, y=200 (nearly ground)
  const elbowX_up = 110;
  const elbowX_dn = 90;
  const elbowY_up = 175;
  const elbowY_dn = GROUND_Y - 4;
  const elbowX = elbowX_up + (elbowX_dn - elbowX_up) * t;
  const elbowY = elbowY_up + (elbowY_dn - elbowY_up) * t;

  // Head follows shoulder
  const headY = shoulderY - 38;
  const headX = shoulderX + 10;

  // Hip is fixed (rigid body assumption: feet & hands on ground)
  const hipX = 180;
  const hipY_up = 145;
  const hipY_dn = 182;
  const hipY = hipY_up + (hipY_dn - hipY_up) * t;

  // Back: line from shoulder to hip
  // Torso tilts as shoulder drops
  const torsoAngle_up = 8;
  const torsoAngle_dn = 0;
  const torsoAngle = torsoAngle_up + (torsoAngle_dn - torsoAngle_up) * t;

  // Leg: hip to knee to foot (rigid, stays flat-ish)
  const kneeX = 206;
  const kneeY_up = 190;
  const kneeY_dn = 198;
  const kneeY = kneeY_up + (kneeY_dn - kneeY_up) * t;

  const elements: string[] = [];

  // Ground line
  elements.push(
    `<line x1="30" y1="${GROUND_Y + SW / 2}" x2="270" y2="${GROUND_Y + SW / 2}" stroke="${COL}" stroke-width="${SW - 4}" stroke-linecap="square" />`
  );

  // ARM (upper arm: shoulder → elbow)
  elements.push(
    `<line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="${COL}" stroke-width="${SW}" stroke-linecap="round" />`
  );
  // ARM (forearm: elbow → hand/ground)
  elements.push(
    `<line x1="${elbowX}" y1="${elbowY}" x2="${HAND_X}" y2="${GROUND_Y}" stroke="${COL}" stroke-width="${SW}" stroke-linecap="round" />`
  );

  // TORSO (shoulder to hip)
  elements.push(
    `<line x1="${shoulderX}" y1="${shoulderY}" x2="${hipX}" y2="${hipY}" stroke="${COL}" stroke-width="${SW}" stroke-linecap="round" />`
  );

  // UPPER LEG (hip to knee)
  elements.push(
    `<line x1="${hipX}" y1="${hipY}" x2="${kneeX}" y2="${kneeY}" stroke="${COL}" stroke-width="${SW}" stroke-linecap="round" />`
  );
  // LOWER LEG (knee to foot)
  elements.push(
    `<line x1="${kneeX}" y1="${kneeY}" x2="${FOOT_X}" y2="${GROUND_Y}" stroke="${COL}" stroke-width="${SW}" stroke-linecap="round" />`
  );

  // HEAD (circle)
  elements.push(
    `<circle cx="${headX}" cy="${headY}" r="18" fill="${COL}" />`
  );

  g.innerHTML = elements.join("\n");
}
