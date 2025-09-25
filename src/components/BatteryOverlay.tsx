import React, { useEffect, useState, useRef } from 'react';

interface BatteryData {
  level: number;
  timestamp: string;
  charging?: boolean;
}

const fetchBattery = async (): Promise<BatteryData | null> => {
  try {
    const res = await fetch('/api/phone-battery');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

function getBatteryColor(level: number | null, charging: boolean) {
  if (charging) return '#e6b800'; // darker yellow when charging
  if (level === null) return '#bbb';
  if (level < 20) return '#ff3b30'; // red under 20
  return '#4cd964'; // green 20 and above
}

interface BatteryOverlayProps {
  pollingEnabled?: boolean;
}

export default function BatteryOverlay({ pollingEnabled = true }: BatteryOverlayProps) {
  const [battery, setBattery] = useState<BatteryData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;
    const getBattery = async () => {
      const data = await fetchBattery();
      if (mounted) setBattery(data);
    };
    if (pollingEnabled) {
      getBattery();
      intervalRef.current = setInterval(getBattery, 30000); // Poll every 1 minute
    }
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [pollingEnabled]);

  const level = battery?.level ?? null;
  const percent = level !== null ? Math.round(level) : '--';
  const charging = battery?.charging ?? false;
  const fill = level !== null ? Math.max(0, Math.min(1, level / 100)) : 0;
  const batteryWidth = 120;
  const batteryHeight = 36;
  const fillWidth = batteryWidth * fill;

  return (
    <div style={{
      borderRadius: 8,
      boxShadow: 'none',
      padding: '24px 32px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    }}>
      <svg width={batteryWidth} height={batteryHeight} viewBox={`0 0 ${batteryWidth} ${batteryHeight}`} style={{ display: 'block' }}>
        {/* Battery body */}
        <rect x="2" y="2" width={batteryWidth - 4} height={batteryHeight - 4} fill="#fff" stroke="#111" strokeWidth="3" rx="8" />
        {/* Battery fill (left to right) */}
        <rect
          x="4"
          y="4"
          width={fillWidth - 4 > 0 ? fillWidth - 4 : 0}
          height={batteryHeight - 8}
          fill={getBatteryColor(level, charging)}
          rx="6"
          style={{ transition: 'width 0.5s' }}
        />
        {/* Centered content: lightning or percent */}
        {charging ? (
          <text
            x={batteryWidth / 2}
            y={batteryHeight / 1.8}
            textAnchor="middle"
            fontSize={batteryHeight / 1.5}
            fontWeight="normal"
            fill="#ffd600"
            style={{
              dominantBaseline: 'middle',
              fontFamily: 'Inter, sans-serif',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            ⚡
          </text>
        ) : (
          <text
            x={batteryWidth / 2}
            y={batteryHeight / 1.8}
            textAnchor="middle"
            fontSize={batteryHeight / 1.7}
            fontWeight="150"
            fill="#111"
            style={{
              dominantBaseline: 'middle',
              fontFamily: 'Arial Narrow, Roboto Condensed, Helvetica Neue, sans-serif',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {percent}%
          </text>
        )}
      </svg>
    </div>
  );
} 