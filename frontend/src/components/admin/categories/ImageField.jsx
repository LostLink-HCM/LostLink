import { useId, useRef, useState } from 'react'
import Button from '../../backoffice/Button'
import { cx } from '../../backoffice/classes'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_MB, checkImages } from '../../../lib/user/composePost'
import CategoryAvatar from './CategoryAvatar'
import { labelClass } from './styles'
import { FormError } from './ui'

// Chọn một ảnh, tạm thời chỉ xem trước trên máy như ảnh ở form đăng bài
export default function ImageField({ label, value, onChange }) {
  const id = useId()
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const pick = (files) => {
    const { accepted, errors } = checkImages(Array.from(files).slice(0, 1), 0, 1)
    setError(errors[0] || '')
    if (accepted[0]) onChange(URL.createObjectURL(accepted[0]))
  }

  return (
    <div className={labelClass}>
      <span id={`${id}-label`}>{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <label
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            pick(event.dataTransfer.files)
          }}
          className={cx(
            'cursor-pointer rounded-2xl transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
            dragging && 'ring-4 ring-primary-muted/50'
          )}
        >
          <CategoryAvatar src={value} className="size-20 rounded-2xl shadow-raised" />
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            aria-labelledby={`${id}-label`}
            className="sr-only"
            onChange={(event) => {
              pick(event.target.files)
              event.target.value = ''
            }}
          />
        </label>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon="image" onClick={() => inputRef.current?.click()}>
              {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange('')}>
                Xóa ảnh
              </Button>
            )}
          </div>
          <small className="text-caption font-normal text-ink-muted">
            JPG, PNG hoặc WEBP, tối đa {MAX_IMAGE_MB} MB
          </small>
        </div>
      </div>
      {error && <FormError>{error}</FormError>}
    </div>
  )
}
