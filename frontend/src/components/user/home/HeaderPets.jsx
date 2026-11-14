import { useEffect, useState } from 'react'
import { PeekCat, PeekDog } from '../mascots/PeekPets'

const pet =
  'h-full w-auto translate-y-[64%] transition-[translate] duration-500 ease-out group-hover/pets:translate-y-0 group-data-[up=true]/pets:translate-y-0 motion-safe:animate-ll-peek motion-reduce:transition-none'

const UP_MS = 2500

export default function HeaderPets({ className = '' }) {
  const [up, setUp] = useState(false)

  useEffect(() => {
    if (!up) return undefined
    const id = setTimeout(() => setUp(false), UP_MS)
    return () => clearTimeout(id)
  }, [up])

  return (
    <div
      aria-hidden="true"
      data-up={up}
      onClick={() => setUp((v) => !v)}
      className={`group/pets flex cursor-pointer items-end gap-2 overflow-hidden ${className}`}
    >
      <PeekCat className={`${pet} [animation-delay:0.6s]`} />
      <PeekDog className={`${pet} [animation-delay:0.9s]`} />
    </div>
  )
}
