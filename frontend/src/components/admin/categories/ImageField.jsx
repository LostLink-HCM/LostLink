import { useId, useRef, useState } from 'react'
import Button from '../../backoffice/Button'
import Dialog from '../../backoffice/Dialog'
import { cx, focusRing } from '../../backoffice/classes'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_MB, checkImages } from '../../../lib/user/composePost'
import { uploadAdminCategoryIcon } from '../../../lib/admin/categoriesApi'
import CategoryAvatar from './CategoryAvatar'
import { labelClass } from './styles'
import { FormError } from './ui'

// Tải ảnh lên máy chủ rồi dùng URL đã lưu cho danh mục.
export default function ImageField({ label, value, onChange, onBusyChange, disabled = false }) {
  const id = useId()
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const inputRef = useRef(null)

  const pick = async (files) => {
    const { accepted, errors } = checkImages(Array.from(files).slice(0, 1), 0, 1)
    setError(errors[0] || '')
    if (!accepted[0]) return

    setUploading(true)
    onBusyChange?.(true)
    try {
      onChange(await uploadAdminCategoryIcon(accepted[0]))
    } catch (uploadError) {
      setError(uploadError.message || 'Tải ảnh lên thất bại. Vui lòng thử lại.')
    } finally {
      setUploading(false)
      onBusyChange?.(false)
    }
  }

  return (
    <div className={labelClass}>
      <span id={`${id}-label`}>{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!disabled && !uploading) void pick(event.dataTransfer.files)
          }}
          className={cx('rounded-2xl transition', dragging && 'ring-4 ring-primary-muted/50')}
        >
          <button
            type="button"
            aria-label="Xem ảnh đại diện danh mục"
            title={value ? 'Xem ảnh đại diện' : 'Danh mục chưa có ảnh đại diện'}
            disabled={!value}
            onClick={() => setPreviewOpen(true)}
            className={cx(
              'block rounded-2xl disabled:cursor-default',
              value && 'cursor-zoom-in transition hover:opacity-90',
              focusRing
            )}
          >
            <CategoryAvatar src={value} className="size-20 rounded-2xl shadow-raised" />
          </button>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            aria-labelledby={`${id}-label`}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => {
              void pick(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon="image"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? 'Đang tải ảnh…' : value ? 'Đổi ảnh' : 'Tải ảnh lên'}
            </Button>
            {value && (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || uploading}
                onClick={() => onChange('')}
              >
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
      {previewOpen && value && (
        <Dialog
          title="Ảnh đại diện danh mục"
          size="lg"
          onClose={() => setPreviewOpen(false)}
          scrollableContent
        >
          <img
            src={value}
            alt={`Ảnh đại diện danh mục: ${label}`}
            className="mx-auto max-h-[min(70dvh,720px)] max-w-full rounded-lg object-contain"
          />
        </Dialog>
      )}
    </div>
  )
}
