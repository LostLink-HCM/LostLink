import Icon from '../common/Icon'
import { PeekCat, PeekDog } from './mascots/PeekPets'

const MASCOTS = { cat: PeekCat, dog: PeekDog }

export default function EmptyState({ icon = 'check', mascot, title, description }) {
  const Mascot = MASCOTS[mascot]

  return (
    <div className="flex flex-col items-center px-5 py-14 text-center text-ink-subtle">
      {Mascot ? (
        <div aria-hidden="true" className="w-28 border-b-2 border-line pt-1">
          <Mascot className="mx-auto block h-12 w-auto" />
        </div>
      ) : (
        <Icon name={icon} size={36} />
      )}
      <h3 className="mt-4 mb-2 text-lead font-semibold text-ink">{title}</h3>
      {description && <p className="text-caption">{description}</p>}
    </div>
  )
}
