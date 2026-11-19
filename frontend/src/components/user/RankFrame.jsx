import Avatar from './Avatar'
import { cx } from './classes'

// Ba tông sáng, giữa, tối của vàng, bạc, đồng cho top 3; hạng 4 trở đi dùng thép xám
const MEDALS = {
  1: { light: '#fff1b8', mid: '#f5c542', dark: '#b7791f', ink: '#5c4100' },
  2: { light: '#f8fafc', mid: '#c9d1dc', dark: '#7d8a9c', ink: '#3a4352' },
  3: { light: '#f8d3b4', mid: '#e0a274', dark: '#9a5426', ink: '#5a2e0e' },
}
const STEEL = { light: '#eef2f6', mid: '#aab4c3', dark: '#6b7789', ink: '#334155' }

const metalRing = (metal) =>
  `conic-gradient(from 210deg, ${metal.light}, ${metal.mid}, ${metal.dark}, ${metal.mid}, ${metal.light}, ${metal.mid}, ${metal.dark}, ${metal.light})`

// Vòng nguyệt quế vàng cho hạng 1: hai nhành lá mọc từ dưới lên ôm hai bên ảnh.
// Toạ độ trong khung 48x48, tâm ảnh ở (24, 24); góc tính theo chiều kim đồng hồ từ hướng 3 giờ
const polar = (deg, r) => {
  const rad = (deg * Math.PI) / 180
  return [24 + r * Math.cos(rad), 24 + r * Math.sin(rad)]
}
// Mỗi đốt hai lá: một chĩa xiên ra ngoài, một áp vào trong
const LAUREL_LEAVES = [74, 54, 34, 14, -6, -26].flatMap((deg) => {
  const [ox, oy] = polar(deg, 23.4)
  const [ix, iy] = polar(deg - 6, 20.4)
  return [
    { key: `o${deg}`, x: ox, y: oy, rotate: deg - 40 },
    { key: `i${deg}`, x: ix, y: iy, rotate: deg - 120 },
  ]
})
const [stemX1, stemY1] = polar(86, 21.6)
const [stemX2, stemY2] = polar(-30, 21.6)

function Laurel({ metal }) {
  const branch = (
    <>
      <path
        d={`M${stemX1} ${stemY1}A21.6 21.6 0 0 0 ${stemX2} ${stemY2}`}
        fill="none"
        stroke={metal.dark}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      {LAUREL_LEAVES.map(({ key, x, y, rotate }) => (
        <ellipse
          key={key}
          cx={x}
          cy={y}
          rx="3.4"
          ry="1.6"
          fill={metal.mid}
          stroke={metal.dark}
          strokeWidth="0.5"
          transform={`rotate(${rotate} ${x} ${y})`}
        />
      ))}
    </>
  )
  return (
    // Lá ngoài cùng nhô quá khung 48px một chút nên để overflow visible
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      overflow="visible"
      className="absolute inset-0 size-full"
    >
      {branch}
      <g transform="matrix(-1 0 0 1 48 0)">{branch}</g>
    </svg>
  )
}

// Hạng 2: viền răng cưa như huy hiệu, 20 vấu tròn nhô ra ngoài khung bạc
const SCALLOP_PATH = (() => {
  const count = 20
  const radius = 19.6
  const bump = radius * Math.sin(Math.PI / count)
  const points = Array.from({ length: count }, (_, i) => polar((i * 360) / count, radius))
  return (
    `M${points[0][0]} ${points[0][1]}` +
    points
      .map((_, i) => {
        const [x, y] = points[(i + 1) % count]
        return `A${bump} ${bump} 0 0 1 ${x} ${y}`
      })
      .join('') +
    'Z'
  )
})()

function Scallop({ metal }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 size-full">
      <path d={SCALLOP_PATH} fill={metal.mid} stroke={metal.dark} strokeWidth="0.6" />
    </svg>
  )
}

// Hạng 3: vòng hạt đồng bao ngoài khung tròn
const BEADS = Array.from({ length: 18 }, (_, i) => polar((i * 360) / 18, 21.9))

function Beads({ metal }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 size-full">
      {BEADS.map(([x, y]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="1.2"
          fill={metal.mid}
          stroke={metal.dark}
          strokeWidth="0.45"
        />
      ))}
    </svg>
  )
}

// Hoạ tiết riêng bao ngoài khung cho từng hạng top 3
const ORNAMENTS = { 1: Laurel, 2: Scallop, 3: Beads }

// Khung ảnh đại diện theo hạng bảng vinh danh trong quý, dùng ở bảng vinh danh và trang cá nhân.
// Cùng cỡ ảnh và cùng khung tròn kim loại, khác nhau ở hoạ tiết bên ngoài: hạng 1 nguyệt quế vàng,
// hạng 2 răng cưa bạc, hạng 3 vòng hạt đồng, từ hạng 4 chỉ có vòng thép. Top 3 có vệt sáng chạy vòng.
// Mọi kích thước tính theo --u (1px = ô 48px, ảnh 32px); unitClass đổi --u để phóng to cả khung.
// showRank: huy hiệu số hạng nhỏ ở góc dưới ảnh
export default function RankFrame({
  rank,
  name,
  initials,
  src,
  showRank = false,
  unitClass = '[--u:1px]',
  className,
}) {
  const medal = MEDALS[rank]
  const metal = medal ?? STEEL
  const Ornament = ORNAMENTS[rank]
  return (
    <span
      className={cx(
        'relative grid size-[calc(var(--u)*48)] shrink-0 place-items-center',
        unitClass,
        className
      )}
    >
      {Ornament && <Ornament metal={metal} />}
      <span
        className="relative rounded-full p-[calc(var(--u)*3)]"
        style={{
          background: metalRing(metal),
          boxShadow: medal
            ? `0 0 calc(var(--u) * 10) calc(var(--u) * -1) ${metal.mid}, 0 calc(var(--u) * 2) calc(var(--u) * 6) calc(var(--u) * -3) ${metal.dark}`
            : undefined,
        }}
      >
        {medal && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[conic-gradient(transparent_0_62%,rgb(255_255_255/0.95)_74%,transparent_86%)] motion-safe:animate-[spin_3.2s_linear_infinite]"
            // Ba khung không chớp cùng lúc
            style={{ animationDelay: `${-rank * 1.1}s` }}
          />
        )}
        <Avatar
          name={name}
          initials={initials}
          src={src}
          size="fluid"
          tone="neutral"
          className="relative size-[calc(var(--u)*32)] text-[calc(var(--u)*10.5)] ring-[length:calc(var(--u)*2)] ring-surface"
        />
        {showRank && (
          <span
            className="absolute -right-1 -bottom-0.5 grid size-4 place-items-center rounded-full text-[8.5px] leading-none font-bold ring-2 ring-surface"
            style={{
              background: `linear-gradient(135deg, ${metal.light}, ${metal.mid} 55%, ${metal.dark})`,
              color: metal.ink,
            }}
          >
            <span className="sr-only">Hạng </span>
            {rank}
          </span>
        )}
      </span>
    </span>
  )
}
