import React from "react";

export function HeroGridSvg() {
  // Exact geometric curved perspective warp grid style matching SAKTTS hero
  const horizontals = [
    0, 20.4, 43.0, 68.0, 95.2, 124.8, 156.7, 190.8, 227.3, 266.1, 307.2, 350.6,
    396.3, 444.3, 494.6, 547.2, 602.1, 659.3, 718.8, 780.7, 844.8, 911.2, 980.0,
    1051.0, 1124.4, 1200.0,
  ];

  const verticalColumns = Array.from({ length: 33 }, (_, i) => {
    const x0 = -320 + i * 70;
    const curve = (i - 16) * 42;
    const points: string[] = [];
    for (let step = 0; step <= 24; step++) {
      const t = step / 24;
      const y = t * 1200;
      const x = x0 + Math.pow(t, 1.85) * curve;
      points.push(`${step === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join("");
  });

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1600 1200"
      preserveAspectRatio="xMidYMin slice"
      className="pointer-events-none absolute inset-x-0 top-0 h-[920px] w-full stroke-foreground/[0.06] dark:stroke-foreground/[0.07]"
      fill="none"
    >
      <defs>
        <radialGradient id="saktts-hero-fade" cx="50%" cy="32%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.45" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="saktts-hero-mask">
          <rect width="1600" height="1200" fill="url(#saktts-hero-fade)" />
        </mask>
      </defs>
      <g mask="url(#saktts-hero-mask)">
        {horizontals.map((y) => (
          <line key={y} x1="0" x2="1600" y1={y} y2={y} vectorEffect="non-scaling-stroke" />
        ))}
        {verticalColumns.map((d, idx) => (
          <path key={idx} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
