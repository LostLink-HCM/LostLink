import { useId, useState } from 'react'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_MB,
  MAX_IMAGES,
  checkImages,
} from '../../lib/user/composePost'
import Icon from '../common/Icon'
import { cx, focusRing } from './classes'

// Ảnh không bắt buộc, ảnh sai định dạng, quá 5 MB hoặc thừa bị bỏ và báo lỗi
export default function ImagePicker({
  images,
  onAdd,
  onRemove,
  title = 'Hình ảnh',
  max = MAX_IMAGES,
  cover = true,
  hint,
}) {
  const inputId = useId()
  const [rejected, setRejected] = useState([])
  const [dragging, setDragging] = useState(false)
  const full = images.length >= max

  const addFiles = (fileList) => {
    const { accepted, errors } = checkImages(Array.from(fileList), images.length, max)
    setRejected(errors)
    if (accepted.length) onAdd(accepted)
  }

  return (
    <section aria-labelledby={`${inputId}-title`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 id={`${inputId}-title`} className="m-0 text-small font-semibold text-ink">
          {title} <span className="font-normal text-ink-muted">· không bắt buộc</span>
        </h3>
        <span className="text-caption text-ink-subtle">
          {images.length}/{max}
        </span>
      </div>

      <ul className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 sm:grid-cols-5">
        {images.map((image, index) => (
          <li
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-muted"
          >
            <img
              src={image.url}
              alt={`Ảnh ${index + 1}: ${image.name}`}
              className="size-full object-cover"
            />
            {cover && index === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/75 px-2 py-0.5 text-micro font-semibold text-white">
                Ảnh bìa
              </span>
            )}
            <button
              type="button"
              aria-label={`Xoá ảnh ${index + 1}`}
              onClick={() => onRemove(image.id)}
              className={cx(
                'absolute top-1.5 right-1.5 grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-ink/70 text-white transition-colors hover:bg-ink',
                focusRing
              )}
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}

        {!full && (
          <li>
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              className={cx(
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-2 text-center text-caption transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                dragging
                  ? 'border-primary bg-primary-subtle text-primary'
                  : 'border-line-strong text-ink-muted hover:border-primary/50 hover:bg-primary-subtle hover:text-primary'
              )}
            >
              <Icon name="plus" size={20} />
              Thêm ảnh
              <input
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
                className="sr-only"
              />
            </label>
          </li>
        )}
      </ul>

      {rejected.length > 0 && (
        <ul
          role="alert"
          className="m-0 mt-2.5 flex list-none flex-col gap-1 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-caption text-danger-ink"
        >
          {rejected.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <p className="m-0 mt-2.5 text-caption leading-relaxed text-ink-muted">
        Ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa {MAX_IMAGE_MB} MB
        {cover && ', ảnh đầu tiên làm ảnh bìa'}.{hint && ` ${hint}`}
      </p>
    </section>
  )
}
