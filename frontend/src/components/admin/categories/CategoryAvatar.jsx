import { useState } from 'react'
import Icon from '../../common/Icon'
import { cx } from '../../backoffice/classes'

// Ảnh đại diện của danh mục; chưa có ảnh hoặc ảnh lỗi thì hiện ô ảnh trống
export default function CategoryAvatar({ src, className }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = src && failedSrc !== src

  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center overflow-hidden bg-primary-subtle text-ink-subtle',
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Icon name="image" size={18} />
      )}
    </span>
  )
}
