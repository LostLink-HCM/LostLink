import { useState } from 'react'
import Icon from '../../common/Icon'
import Card from '../Card'
import { cx, focusRing } from '../classes'

const arrowClass = cx(
  'absolute top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-surface/95 text-ink shadow-[0_2px_10px_rgb(0_0_0/0.12)] transition hover:bg-surface',
  focusRing
)

export default function PostGallery({ images, title }) {
  const [index, setIndex] = useState(0)
  const many = images.length > 1
  const go = (step) => setIndex((i) => (i + step + images.length) % images.length)

  return (
    <Card
      as="section"
      aria-label="Hình ảnh bài đăng"
      aria-roledescription="carousel"
      className="overflow-hidden"
      // Dùng phím mũi tên để chuyển ảnh khi đang focus trong khung
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="relative aspect-4/3 bg-line-subtle sm:aspect-auto sm:h-80 lg:h-90">
        <img
          src={images[index]}
          alt={`${title} - ảnh ${index + 1}`}
          className="size-full object-cover"
        />
        {many && (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => go(-1)}
              className={cx(arrowClass, 'left-4')}
            >
              <Icon name="back" size={18} />
            </button>
            <button
              type="button"
              aria-label="Ảnh sau"
              onClick={() => go(1)}
              className={cx(arrowClass, 'right-4')}
            >
              <Icon name="next" size={18} />
            </button>
            <span className="absolute right-4 bottom-4 rounded-full bg-ink/70 px-3 py-1 text-tiny text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="flex gap-2.5 overflow-x-auto px-4 py-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cx(
                'h-15 w-19 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 p-0 transition',
                i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
                focusRing
              )}
            >
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
