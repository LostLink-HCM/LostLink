import { useMemo } from 'react'

function buildStars(count) {
  let seed = 20240826
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  return Array.from({ length: count }, () => {
    const along = rnd()
    const inBand = rnd() < 0.6
    const x = inBand ? along * 100 : rnd() * 100
    const y = inBand ? along * 90 - (x - 50) * 0.45 + (rnd() - 0.5) * 26 : rnd() * 100
    const size = rnd() * 2 + 0.6
    return {
      left: `${x}%`,
      top: `${Math.max(-4, Math.min(104, y))}%`,
      width: size,
      height: size,
      opacity: 0.25 + rnd() * 0.6,
      animationDuration: `${2.4 + rnd() * 4.5}s`,
      animationDelay: `${rnd() * 5}s`,
    }
  })
}

export default function Starfield({ count = 170 }) {
  const stars = useMemo(() => buildStars(count), [count])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -inset-[20%] -rotate-[24deg] scale-y-[0.42] bg-[radial-gradient(closest-side_at_50%_50%,rgba(150,180,255,.12),rgba(150,180,255,0)_70%)] blur-[18px]" />
      {stars.map((style, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(200,220,255,.5)] motion-safe:animate-ll-twinkle"
          style={style}
        />
      ))}
    </div>
  )
}
