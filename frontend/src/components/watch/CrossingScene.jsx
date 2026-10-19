/*
  Animated top view of the level crossing for the dashboard watch panel.
  - Barrier arms follow `barrier` ('open' | 'closed'): they come down once the
    petugas confirms the closure and rise again when the crossing is safe.
  - Crossing lamps flash alternately: amber in SIAGA, red while the barrier
    must be closed.
  - The train waits in the distance (SIAGA), passes (TUTUP) or leaves
    (MENUNGGU AMAN).
  - While TUTUP is unconfirmed, a dashed "ghost" arm shows where the barrier
    must go.
  Colors are fixed (camera-like night view) so the scene reads the same in
  light and dark themes.
*/

const RAIL_Y = 118;
const PIVOT_L = { x: 236, y: 196 }; // south post, arm points east
const PIVOT_R = { x: 404, y: 40 }; // north post, arm points west
const ARM_LEN = 150;

function Arm({ pivot, dir, down, ghost }) {
  // dir 1: arm extends to the right, -1: to the left. Up = rotated 80° away from the road.
  const angle = down ? 0 : -80 * dir;
  const x2 = pivot.x + ARM_LEN * dir;
  const stripes = Array.from({ length: 5 }, (_, i) => pivot.x + dir * (18 + i * 28));
  return (
    <g
      className={ghost ? '' : 'maw-barrier-arm'}
      style={{ transform: `rotate(${ghost ? 0 : angle}deg)`, transformOrigin: `${pivot.x}px ${pivot.y}px`, transformBox: 'view-box' }}
      opacity={ghost ? 0.55 : 1}
    >
      {ghost ? (
        <line x1={pivot.x} y1={pivot.y} x2={x2} y2={pivot.y} stroke="#F87171" strokeWidth="6" strokeDasharray="8 7" strokeLinecap="round" />
      ) : (
        <>
          <line x1={pivot.x} y1={pivot.y} x2={x2} y2={pivot.y} stroke="#F8FAFC" strokeWidth="8" strokeLinecap="round" />
          {stripes.map((x) => (
            <line key={x} x1={x} y1={pivot.y} x2={x + 12 * dir} y2={pivot.y} stroke="#DC2626" strokeWidth="8" />
          ))}
        </>
      )}
    </g>
  );
}

function Post({ x, y, lamps, lampColor }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill="#334155" stroke="#94A3B8" strokeWidth="2" />
      <g transform={`translate(${x - 18}, ${y - 34})`}>
        <rect width="36" height="16" rx="8" fill="#111827" stroke="#475569" />
        <circle cx="9" cy="8" r="5.5" fill={lamps ? lampColor : '#374151'} className={lamps ? 'maw-lamp-a' : ''} />
        <circle cx="27" cy="8" r="5.5" fill={lamps ? lampColor : '#374151'} className={lamps ? 'maw-lamp-b' : ''} />
      </g>
    </g>
  );
}

function Train({ motion }) {
  const cars = [0, 1, 2];
  return (
    <g className={motion} style={{ transformBox: 'view-box' }}>
      {cars.map((i) => (
        <g key={i} transform={`translate(${i * 172}, ${RAIL_Y - 22})`}>
          <rect width="164" height="44" rx={i === 2 ? 18 : 6} fill={i === 2 ? '#F58220' : '#1D4ED8'} stroke="#0F172A" strokeWidth="2" />
          {[18, 52, 86, 120].map((wx) => (
            <rect key={wx} x={wx} y="10" width="22" height="14" rx="2" fill="#BFDBFE" opacity="0.9" />
          ))}
          {i === 2 && <circle cx="156" cy="22" r="4" fill="#FEF08A" />}
        </g>
      ))}
    </g>
  );
}

export default function CrossingScene({ state, barrier, fault }) {
  const closing = state === 'TUTUP' || state === 'MENUNGGU_AMAN';
  const lamps = closing || state === 'SIAGA';
  const lampColor = state === 'SIAGA' ? '#FBBF24' : '#EF4444';
  const down = barrier === 'closed';
  const ghost = state === 'TUTUP' && !down;
  const train = state === 'TUTUP' ? 'maw-train-pass' : state === 'MENUNGGU_AMAN' ? 'maw-train-leave' : state === 'SIAGA' ? 'maw-train-wait' : null;

  return (
    <svg viewBox="0 0 640 240" className="w-full h-full" role="img" aria-label={`Crossing view: ${state}, barrier ${barrier}`}>
      <defs>
        <pattern id="maw-unknown-stripes" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="16" fill="rgba(148,163,184,0.18)" />
        </pattern>
        <clipPath id="maw-scene-clip"><rect width="640" height="240" rx="8" /></clipPath>
      </defs>
      <g clipPath="url(#maw-scene-clip)">
        {/* Ground and road */}
        <rect width="640" height="240" fill="#0B1220" />
        <rect x="250" width="140" height="240" fill="#1F2937" />
        {[12, 52, 172, 212].map((y) => (
          <rect key={y} x="317" y={y} width="6" height="22" fill="#E5E7EB" opacity="0.7" />
        ))}
        {/* Track: sleepers then rails */}
        {Array.from({ length: 27 }, (_, i) => (
          <rect key={i} x={i * 24} y={RAIL_Y - 18} width="10" height="36" fill="#57534E" />
        ))}
        <rect x="0" y={RAIL_Y - 12} width="640" height="4" fill="#CBD5E1" />
        <rect x="0" y={RAIL_Y + 8} width="640" height="4" fill="#CBD5E1" />
        {/* Stop lines */}
        <rect x="250" y="170" width="70" height="4" fill="#F8FAFC" opacity="0.8" />
        <rect x="320" y="64" width="70" height="4" fill="#F8FAFC" opacity="0.8" />

        {train && <Train motion={train} />}

        {ghost && <Arm pivot={PIVOT_L} dir={1} ghost />}
        {ghost && <Arm pivot={PIVOT_R} dir={-1} ghost />}
        <Arm pivot={PIVOT_L} dir={1} down={down} />
        <Arm pivot={PIVOT_R} dir={-1} down={down} />
        <Post x={PIVOT_L.x} y={PIVOT_L.y} lamps={lamps} lampColor={lampColor} />
        <Post x={PIVOT_R.x} y={PIVOT_R.y} lamps={lamps} lampColor={lampColor} />

        {state === 'CEK_MANUAL' && (
          <g>
            <rect width="640" height="240" fill="url(#maw-unknown-stripes)" />
            <rect width="640" height="240" fill="#0B1220" opacity="0.45" />
            <text x="320" y={fault ? 116 : 128} textAnchor="middle" fill="#E2E8F0" fontSize="22" fontFamily="Space Grotesk, sans-serif" fontWeight="700">
              {fault ? 'DEVICE DISCONNECTED' : 'NO RELIABLE SENSOR DATA'}
            </text>
            {fault && (
              <text x="320" y="146" textAnchor="middle" fill="#FCA5A5" fontSize="15" fontFamily="IBM Plex Mono, monospace">
                {fault}
              </text>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
