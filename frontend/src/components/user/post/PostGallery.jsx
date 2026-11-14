import { useEffect, useRef, useState } from 'react'
import Icon from '../../common/Icon'
import Card from '../Card'
import { cx, focusRing } from '../classes'

const arrowClass = cx(
  'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-surface/95 text-ink shadow-[0_2px_10px_rgb(0_0_0/0.12)] transition hover:bg-surface',
  focusRing
)

const counterClass =
  'absolute right-4 bottom-4 z-10 rounded-full bg-ink/70 px-3 py-1 text-tiny text-white tabular-nums'

// Ảnh luôn hiện trọn (contain) dù dọc, ngang hay vuông, vì phần bị cắt có thể là chi tiết để nhận ra đồ.
// Khoảng trống hai bên lấp bằng chính ảnh đó làm mờ, khung giữ chiều cao cố định để trang không nhảy khi đổi ảnh
function FittedImage({ src, alt, className }) {
  return (
    <div className={cx('relative overflow-hidden bg-ink', className)}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full scale-110 object-cover opacity-55 blur-2xl"
      />
      <img src={src} alt={alt} className="relative size-full object-contain" />
    </div>
  )
}

// Xem ảnh toàn màn hình, vẫn chuyển ảnh được bằng nút hoặc phím mũi tên
function Lightbox({ images, index, title, onMove, onClose }) {
  const ref = useRef(null)
  const many = images.length > 1

  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={`${title} - ảnh ${index + 1} trên ${images.length}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (!many) return
        if (event.key === 'ArrowLeft') onMove(-1)
        if (event.key === 'ArrowRight') onMove(1)
      }}
      // Bấm vào vùng tối quanh ảnh thì đóng
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-0 size-full max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-ink/90 backdrop:backdrop-blur-sm"
    >
      <div
        className="relative grid size-full place-items-center p-4 sm:p-10"
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        <img
          src={images[index]}
          alt={`${title} - ảnh ${index + 1}`}
          className="max-h-[calc(100dvh-2rem)] max-w-full rounded-lg object-contain shadow-dialog sm:max-h-[calc(100dvh-5rem)]"
        />
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className={cx(arrowClass, 'top-6 right-4 translate-y-0 sm:right-6')}
        >
          <Icon name="close" size={18} />
        </button>
        {many && (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => onMove(-1)}
              className={cx(arrowClass, 'left-4 sm:left-6')}
            >
              <Icon name="back" size={18} />
            </button>
            <button
              type="button"
              aria-label="Ảnh sau"
              onClick={() => onMove(1)}
              className={cx(arrowClass, 'right-4 sm:right-6')}
            >
              <Icon name="next" size={18} />
            </button>
            <span className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-tiny text-white tabular-nums sm:bottom-6">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </dialog>
  )
}

export default function PostGallery({ images, title }) {
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
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
        if (!many || zoomed) return
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="relative">
        <button
          type="button"
          aria-label="Xem ảnh toàn màn hình"
          onClick={() => setZoomed(true)}
          className={cx('block w-full cursor-zoom-in border-0 bg-transparent p-0', focusRing)}
        >
          <FittedImage
            src={images[index]}
            alt={`${title} - ảnh ${index + 1}`}
            className="aspect-4/3 sm:aspect-auto sm:h-80 lg:h-96"
          />
        </button>
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
            <span className={counterClass}>
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
              {/* Ảnh nhỏ giữ kiểu cắt đầy ô */}
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <Lightbox
          images={images}
          index={index}
          title={title}
          onMove={go}
          onClose={() => setZoomed(false)}
        />
      )}
    </Card>
  )
}
