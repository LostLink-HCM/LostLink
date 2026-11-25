import Icon from '../common/Icon'
import { PeekCat, PeekDog } from './mascots/PeekPets'

const MASCOTS = { cat: PeekCat, dog: PeekDog }

const ITEMS = ['vi-tien', 'chia-khoa-xe-co', 'thiet-bi-dien-tu']

function ItemCluster() {
  return (
    <div aria-hidden="true" className="relative h-20 w-36">
      <span className="absolute inset-x-4 bottom-0 h-3 rounded-full bg-primary/10 blur-sm" />
      <img
        src={`/images/categories/${ITEMS[0]}.png`}
        alt=""
        className="absolute bottom-2 left-0 size-14 -rotate-12"
      />
      <img
        src={`/images/categories/${ITEMS[2]}.png`}
        alt=""
        className="absolute right-0 bottom-2 size-14 rotate-12"
      />
      <img
        src={`/images/categories/${ITEMS[1]}.png`}
        alt=""
        className="absolute bottom-3 left-1/2 size-16 -translate-x-1/2"
      />
    </div>
  )
}

export default function EmptyState({
  icon = 'check',
  mascot,
  items = false,
  title,
  description,
  action,
}) {
  const Mascot = MASCOTS[mascot]

  return (
    <div className="flex flex-col items-center px-5 py-14 text-center text-ink-subtle">
      {items ? (
        <ItemCluster />
      ) : Mascot ? (
        <div aria-hidden="true" className="w-28 border-b-2 border-line pt-1">
          <Mascot className="mx-auto block h-12 w-auto" />
        </div>
      ) : (
        <Icon name={icon} size={36} />
      )}
      <h3 className="mt-4 mb-2 text-lead font-semibold text-ink">{title}</h3>
      {description && <p className="m-0 max-w-sm text-caption leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
