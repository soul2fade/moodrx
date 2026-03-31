import { useEffect, useRef } from "react";

export function PushupPictogram() {
  const rafRef = useRef<number | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    let start: number | null = null;
    const CYCLE = 1500;

    function ease(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function tick(ts: number) {
      if (!start) start = ts;
      const phase = ((ts - start) % CYCLE) / CYCLE;
      // 0→0.5: going down, 0.5→1: coming up
      const raw = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const t = ease(raw); // 0 = arms-up, 1 = arms-down
      draw(t);
      rafRef.current = requestAnimationFrame(tick);
    }

    function draw(t: number) {
      const g = gRef.current;
      if (!g) return;

      const C = "#111";
      // Limb thicknesses — fat ISO silhouette style
      const SW_torso = 72;
      const SW_limb  = 56;
      const HEAD_R   = 50;

      // Ground contacts — fixed
      const HAND_X = 118, HAND_Y = 305;
      const FOOT_X = 570, FOOT_Y = 305;

      // Animated shoulder height drives everything
      const SHLDR_X = 195;
      const SHLDR_Y = lerp(148, 222, t); // up=148, down=222

      // Head: just above and in front of shoulder
      const HEAD_X = SHLDR_X - 22;
      const HEAD_Y = SHLDR_Y - HEAD_R - 8;

      // Elbow: arm bends as body lowers
      const ELBOW_X = lerp(158, 135, t);
      const ELBOW_Y = lerp(252, 285, t);

      // Hip: tracks shoulder, slightly less range
      const HIP_X = 420;
      const HIP_Y  = lerp(168, 238, t);

      // Knee: mostly fixed, slight float
      const KNEE_X = 512;
      const KNEE_Y  = lerp(270, 283, t);

      g.innerHTML = [
        // Upper arm: shoulder → elbow
        `<line x1="${SHLDR_X}" y1="${SHLDR_Y}" x2="${ELBOW_X}" y2="${ELBOW_Y}"
               stroke="${C}" stroke-width="${SW_limb}" stroke-linecap="round"/>`,
        // Forearm: elbow → hand
        `<line x1="${ELBOW_X}" y1="${ELBOW_Y}" x2="${HAND_X}" y2="${HAND_Y}"
               stroke="${C}" stroke-width="${SW_limb}" stroke-linecap="round"/>`,
        // Torso: shoulder → hip  (fat stroke = the whole body mass)
        `<line x1="${SHLDR_X}" y1="${SHLDR_Y}" x2="${HIP_X}" y2="${HIP_Y}"
               stroke="${C}" stroke-width="${SW_torso}" stroke-linecap="round"/>`,
        // Upper leg: hip → knee
        `<line x1="${HIP_X}" y1="${HIP_Y}" x2="${KNEE_X}" y2="${KNEE_Y}"
               stroke="${C}" stroke-width="${SW_limb}" stroke-linecap="round"/>`,
        // Lower leg: knee → foot
        `<line x1="${KNEE_X}" y1="${KNEE_Y}" x2="${FOOT_X}" y2="${FOOT_Y}"
               stroke="${C}" stroke-width="${SW_limb}" stroke-linecap="round"/>`,
        // Head
        `<circle cx="${HEAD_X}" cy="${HEAD_Y}" r="${HEAD_R}" fill="${C}"/>`,
      ].join("\n");
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg
        viewBox="0 0 720 400"
        width="720"
        height="400"
        style={{ display: "block" }}
      >
        <g ref={gRef} />
      </svg>
    </div>
  );
}
