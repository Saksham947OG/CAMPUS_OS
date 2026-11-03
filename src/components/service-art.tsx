/* Decorative service illustrations. Each is described by the card's own text, so the drawing is hidden from assistive technology. */
const teal = '#246e65'
const clay = '#a95138'
const blue = '#456c8a'
const wash = '#f3e6b8'
const paper = '#fffefb'

function Frame({ children, tint }: { children: React.ReactNode; tint: string }) {
  return (
    <svg
      viewBox="0 0 200 96"
      className="h-24 w-full rounded-t-[inherit]"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="200" height="96" fill={tint} />
      <ellipse cx="100" cy="86" rx="70" ry="6" fill="#202c30" opacity="0.1" />
      {children}
    </svg>
  )
}

const art: Record<string, () => React.ReactNode> = {
  laundry: () => (
    <Frame tint="#dfeaf0">
      <rect
        x="62"
        y="14"
        width="76"
        height="70"
        rx="8"
        fill={paper}
        stroke={blue}
        strokeWidth="2"
      />
      <rect x="70" y="21" width="22" height="7" rx="3" fill={wash} />
      <circle cx="124" cy="25" r="3.5" fill={clay} />
      <circle cx="100" cy="54" r="22" fill="#cfe0ea" stroke={blue} strokeWidth="3" />
      <g className="float-a">
        <path
          d="M84 56 Q92 46 100 54 T116 52"
          fill="none"
          stroke={teal}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="104" cy="62" r="3" fill="#fff" opacity="0.8" />
      </g>
    </Frame>
  ),
  mess: () => (
    <Frame tint="#f3ead2">
      <rect
        x="46"
        y="12"
        width="108"
        height="66"
        rx="6"
        fill="#2d4a42"
        stroke="#8a6a3a"
        strokeWidth="4"
      />
      <text
        x="100"
        y="30"
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill={wash}
        fontFamily="serif"
      >
        Today’s menu
      </text>
      {[40, 50, 60, 70].map((y, i) => (
        <rect
          key={y}
          x="62"
          y={y - 5}
          width={i % 2 ? 62 : 74}
          height="3.5"
          rx="1.75"
          fill={paper}
          opacity="0.85"
        />
      ))}
      <g className="float-b" opacity="0.8">
        <path
          d="M30 70 q4 -8 0 -14 q-4 -6 0 -12"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </Frame>
  ),
  'chill-spot': () => (
    <Frame tint="#f1e6dd">
      <rect
        x="72"
        y="36"
        width="50"
        height="42"
        rx="6"
        fill={paper}
        stroke="#6b4a38"
        strokeWidth="3"
      />
      <path d="M122 46 q16 0 16 12 q0 12 -16 12" fill="none" stroke="#6b4a38" strokeWidth="3" />
      <rect x="72" y="36" width="50" height="10" rx="4" fill="#6b4a38" />
      <g className="float-a" opacity="0.85">
        <path
          d="M86 28 q-6 -6 0 -12"
          fill="none"
          stroke="#6b4a38"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M100 28 q-6 -6 0 -12"
          fill="none"
          stroke="#6b4a38"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M112 28 q-6 -6 0 -12"
          fill="none"
          stroke="#6b4a38"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </Frame>
  ),
  parcels: () => (
    <Frame tint="#ece6d6">
      <rect
        x="56"
        y="30"
        width="88"
        height="50"
        rx="4"
        fill="#c9a06a"
        stroke="#8a6a3a"
        strokeWidth="2.5"
      />
      <rect x="92" y="30" width="16" height="50" fill="#e1c390" />
      <rect x="62" y="44" width="26" height="20" rx="2" fill={paper} />
      {[50, 56, 62].map((y) => (
        <rect key={y} x="65" y={y - 2} width="20" height="2" rx="1" fill={blue} opacity="0.7" />
      ))}
      <g className="float-b">
        <circle cx="150" cy="24" r="8" fill={teal} />
        <path
          d="M146 24 l3 3 l5 -6"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </Frame>
  ),
}

export function ServiceArt({ id }: { id: string }) {
  return art[id]?.() ?? null
}
