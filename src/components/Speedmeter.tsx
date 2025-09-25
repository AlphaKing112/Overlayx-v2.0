import React, { useEffect, useRef, useState } from 'react';

// Add Google Fonts import for Orbitron (digital font)
if (typeof window !== 'undefined') {
  const id = 'orbitron-font-link';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap';
    document.head.appendChild(link);
  }
}

interface SpeedmeterProps {
  speed: number; // in m/s
  size?: number;
  darkMode?: boolean;
}

const MAX_MPH = 90;
const TICK_INTERVAL = 10;
const TICK_COUNT = MAX_MPH / TICK_INTERVAL;
const START_ANGLE = 135;
const END_ANGLE = 405;
const ANGLE_RANGE = END_ANGLE - START_ANGLE;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

const Speedmeter: React.FC<SpeedmeterProps> = ({ speed, size = 180, darkMode = false }) => {
  // Convert m/s to mph
  const targetMph = Math.max(0, Math.min(speed * 2.23694, MAX_MPH));
  const [displayMph, setDisplayMph] = useState(targetMph);
  const [needlePercent, setNeedlePercent] = useState(targetMph / MAX_MPH);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const animate = () => {
      setDisplayMph(prev => {
        const diff = targetMph - prev;
        if (Math.abs(diff) < 0.1) return targetMph;
        return prev + diff * 0.18;
      });
      setNeedlePercent(prev => {
        const target = targetMph / MAX_MPH;
        const diff = target - prev;
        if (Math.abs(diff) < 0.01) return target;
        return prev + diff * 0.18;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetMph]);

  // Geometry
  const padding = size * 0.06;
  const stroke = size * 0.16;
  const tickLen = size * 0.13;
  const tickStroke = size * 0.025;
  const radius = (size - stroke) / 2 - padding;
  const tickRadiusOuter = radius + stroke / 2;
  const tickRadiusInner = tickRadiusOuter - tickLen;
  const mphColor = '#fff';

  // Ticks
  const ticks = [];
  for (let i = 0; i <= TICK_COUNT; i++) {
    const angle = START_ANGLE + (ANGLE_RANGE * (i / TICK_COUNT));
    const outer = polarToCartesian(size / 2, size / 2, tickRadiusOuter, angle);
    const inner = polarToCartesian(size / 2, size / 2, tickRadiusInner, angle);
    ticks.push(
      <line
        key={i}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={mphColor}
        strokeWidth={tickStroke}
        strokeLinecap="round"
        opacity={i % 2 === 0 ? 1 : 0.5}
      />
    );
    // Optional: add numbers
    if (i % 2 === 0) {
      const labelPos = polarToCartesian(size / 2, size / 2, tickRadiusInner - size * 0.09, angle);
      ticks.push(
        <text
          key={`label-${i}`}
          x={labelPos.x}
          y={labelPos.y + size * 0.025}
          textAnchor="middle"
          fontSize={size * 0.12}
          fill={mphColor}
          fontFamily="'Orbitron', 'Share Tech Mono', 'VT323', monospace"
          opacity={0.7}
        >
          {i * TICK_INTERVAL}
        </text>
      );
    }
  }

  // Needle
  const needleAngle = START_ANGLE + ANGLE_RANGE * needlePercent;
  const needleLength = radius + stroke / 2 - size * 0.04;
  const needleBase = polarToCartesian(size / 2, size / 2, size * 0.13, needleAngle + 180); // base is short, opposite direction
  const needleTip = polarToCartesian(size / 2, size / 2, needleLength, needleAngle);

  // Arc color: green (low), yellow (mid), red (high)
  let arcColor = '#22c55e';
  if (needlePercent > 0.7) arcColor = '#ef4444';
  else if (needlePercent > 0.4) arcColor = '#fde047';

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        outline: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', background: 'transparent', overflow: 'visible' }}>
        {/* Background circle with radial gradient */}
        <defs>
          <radialGradient id="speedmeter-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={darkMode ? '#222' : '#222'} stopOpacity={darkMode ? 0.95 : 0.85} />
            <stop offset="100%" stopColor={darkMode ? '#111' : '#333'} stopOpacity={1} />
          </radialGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - padding}
          fill="url(#speedmeter-bg)"
          filter="drop-shadow(0 2px 16px #0008)"
        />
        {/* Arc background (faint) */}
        <path
          d={describeArc(size / 2, size / 2, radius, START_ANGLE, END_ANGLE)}
          stroke="#222"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          opacity={0.18}
        />
        {/* Arc fill (single color) */}
        <path
          d={describeArc(size / 2, size / 2, radius, START_ANGLE, START_ANGLE + ANGLE_RANGE * needlePercent)}
          stroke={arcColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${arcColor})` }}
        />
        {/* Ticks and labels */}
        {ticks}
        {/* Needle (split/outlined) */}
        <line
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#fff"
          strokeWidth={size * 0.07}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 8px #fff)' }}
        />
        <line
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#e11d48"
          strokeWidth={size * 0.035}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 8px #e11d48)' }}
        />
        {/* Needle hub */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.055}
          fill="#fff"
          stroke="#e11d48"
          strokeWidth={size * 0.018}
          style={{ filter: 'drop-shadow(0 0 8px #fff)' }}
        />
        {/* Glossy highlight (optional) */}
        <path
          d={describeArc(size / 2, size / 2, radius + stroke / 2.2, START_ANGLE + 10, END_ANGLE - 10)}
          stroke="#fff"
          strokeWidth={stroke * 0.18}
          fill="none"
          strokeLinecap="round"
          opacity={0.18}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '72%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: size * 0.22,
            fontWeight: 800,
            color: mphColor,
            letterSpacing: 2,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: `'Orbitron', 'Share Tech Mono', 'VT323', monospace`,
            textShadow: '0 0 12px #000a',
          }}
        >
          {displayMph.toFixed(1)}
        </div>
        <div
          style={{
            fontSize: size * 0.13,
            color: '#000',
            fontWeight: 600,
            letterSpacing: 2,
            marginTop: size * 0.01,
            fontFamily: `'Orbitron', 'Share Tech Mono', 'VT323', monospace`,
            opacity: 0.85,
            textShadow: '0 0 8px #000a',
          }}
        >
          mph
        </div>
      </div>
    </div>
  );
};

export default Speedmeter; 