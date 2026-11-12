function RoundTree({ className }) {
  return (
    <svg viewBox="0 0 120 160" className={`absolute aspect-[3/4] ${className}`}>
      <path d="M53 160 V104 q0 -8 7 -8 q7 0 7 8 V160 Z" className="fill-au-trunk" />
      <path
        d="M60 116 l-16 -16 M62 110 l14 -12"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-au-trunk"
      />
      <g className="fill-au-tree-shade">
        <circle cx="60" cy="56" r="42" />
        <circle cx="30" cy="80" r="28" />
        <circle cx="90" cy="80" r="28" />
        <circle cx="60" cy="92" r="28" />
      </g>
      <g className="fill-au-tree">
        <circle cx="55" cy="52" r="37" />
        <circle cx="28" cy="74" r="22" />
        <circle cx="80" cy="68" r="24" />
      </g>
    </svg>
  )
}

function PineTree({ className }) {
  const tiers = ['M40 6 L64 50 H16 Z', 'M40 36 L70 90 H10 Z', 'M40 70 L76 132 H4 Z']
  return (
    <svg viewBox="0 0 80 160" className={`absolute aspect-[1/2] ${className}`}>
      <rect x="34" y="124" width="12" height="36" rx="3" className="fill-au-trunk" />
      {tiers.map((d) => (
        <path
          key={d}
          d={d}
          strokeWidth="7"
          strokeLinejoin="round"
          className="fill-au-tree-shade stroke-au-tree-shade"
        />
      ))}
      <path
        d="M40 6 L16 50 H40 Z M40 36 L10 90 H40 Z M40 70 L4 132 H40 Z"
        className="fill-au-tree"
      />
    </svg>
  )
}

function Bush({ className }) {
  return (
    <svg viewBox="0 0 90 48" className={`absolute aspect-[15/8] ${className}`}>
      <g className="fill-au-tree-shade">
        <circle cx="24" cy="30" r="18" />
        <circle cx="46" cy="24" r="22" />
        <circle cx="68" cy="30" r="18" />
        <rect x="6" y="30" width="80" height="18" rx="4" />
      </g>
      <g className="fill-au-tree">
        <circle cx="22" cy="28" r="14" />
        <circle cx="44" cy="22" r="17" />
      </g>
    </svg>
  )
}

const TREES = [
  { Tree: RoundTree, className: 'bottom-[92%] left-[0.5%] h-[min(210px,30vh)]' },
  { Tree: PineTree, className: 'bottom-[92%] left-[9%] h-[min(160px,23vh)]' },
  { Tree: Bush, className: 'bottom-[91%] left-[14%] h-[min(46px,7vh)]' },
  { Tree: Bush, className: 'bottom-[92%] left-[33%] h-[min(34px,5vh)]' },
  { Tree: Bush, className: 'bottom-[92%] left-[79%] h-[min(40px,6vh)]' },
  { Tree: PineTree, className: 'bottom-[92%] left-[83%] h-[min(175px,25vh)]' },
  { Tree: RoundTree, className: 'bottom-[92%] left-[89%] h-[min(225px,32vh)]' },
]

// Toạ độ theo % của dải mặt đất: [trái, trên]
const TUFTS = [
  [3, 22],
  [12, 52],
  [21, 30],
  [27, 78],
  [39, 44],
  [46, 88],
  [55, 26],
  [63, 64],
  [71, 40],
  [80, 82],
  [88, 26],
  [95, 58],
]

const FLOWERS = [
  [6, 38, '#f6c3d1'],
  [16, 70, '#fff'],
  [24, 20, '#ffd36b'],
  [34, 60, '#f6c3d1'],
  [50, 38, '#fff'],
  [58, 78, '#f6c3d1'],
  [67, 22, '#ffd36b'],
  [76, 58, '#fff'],
  [91, 42, '#f6c3d1'],
  [97, 76, '#ffd36b'],
]

export default function Ground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-(--au-horizon) bottom-0 hidden overflow-x-clip lg:block"
    >
      {TREES.map(({ Tree, className }) => (
        <Tree key={className} className={className} />
      ))}

      {/* Đồi xa */}
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path
          d="M0 5 C90 1 200 0 320 3 C460 7 560 6 680 3 C800 0 900 2 1000 5 V100 H0 Z"
          className="fill-au-hill-back"
        />
      </svg>
      {/* Bãi cỏ gần */}
      <svg
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-[34%] bottom-0 h-[66%] w-full"
      >
        <path
          d="M0 6 C150 0 330 2 500 5 C680 8 850 3 1000 1 V100 H0 Z"
          className="fill-au-hill-front"
        />
      </svg>

      {TUFTS.map(([left, top]) => (
        <svg
          key={`${left}-${top}`}
          viewBox="0 0 14 12"
          className="absolute h-3 w-3.5"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <path
            d="M2 11 l-2 -8 M7 11 V1 M12 11 l2 -7"
            fill="none"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="stroke-au-tuft"
          />
        </svg>
      ))}

      {FLOWERS.map(([left, top, color]) => (
        <svg
          key={`${left}-${top}`}
          viewBox="0 0 16 24"
          className="absolute h-6 w-4 opacity-(--au-flower-opacity)"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <path d="M8 23 V10" strokeWidth="2" strokeLinecap="round" className="stroke-au-tuft" />
          <g fill={color}>
            <circle cx="8" cy="3.5" r="3" />
            <circle cx="12.5" cy="7" r="3" />
            <circle cx="10.5" cy="12" r="3" />
            <circle cx="5.5" cy="12" r="3" />
            <circle cx="3.5" cy="7" r="3" />
          </g>
          <circle cx="8" cy="8" r="2.2" fill="#ffb347" />
        </svg>
      ))}
    </div>
  )
}
