import { useState } from 'react'
import { cx } from './classes'

const sizes = {
  xs: 'size-6 text-micro',
  sm: 'size-8 text-micro',
  md: 'size-9 text-tiny',
  lg: 'size-10.5 text-caption',
  xl: 'size-11 text-small',
  '2xl': 'size-20 text-heading sm:size-24',
  fluid: '',
}

const tones = {
  primary: 'bg-primary-soft text-primary',
  neutral: 'bg-line-subtle text-ink-secondary',
}

export default function Avatar({ name, initials, src, size = 'lg', tone = 'primary', className }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = src && failedSrc !== src

  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center overflow-hidden rounded-full font-bold',
        sizes[size],
        tones[tone],
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        (initials ?? name.slice(0, 2).toUpperCase())
      )}
    </span>
  )
}
