import { ConfirmDeleteDialog } from './ui'
import Icon from '../../common/Icon'
import { incomingRelations } from '../../../lib/admin/categories'

export default function DeleteCategoryDialog({ category, categories, onConfirm, onClose }) {
  const affectedNames = [
    ...new Set(incomingRelations(categories, category.id).map(({ source }) => source.name)),
  ]

  return (
    <ConfirmDeleteDialog
      title="Xóa danh mục"
      confirmLabel="Xóa"
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <div className="flex items-start gap-3 text-danger-ink">
        <Icon name="warning" size={20} className="mt-0.5 shrink-0" />
        <p className="m-0 font-semibold">
          Bạn có chắc muốn xóa danh mục <strong>“{category.name}”</strong>?
        </p>
      </div>
      <p className="m-0">
        Danh mục sẽ không còn xuất hiện trong danh sách đang hoạt động
        {affectedNames.length > 0 && (
          <>
            {' '}
            và sẽ bị gỡ khỏi quan hệ của{' '}
            <strong className="text-ink">{affectedNames.join(', ')}</strong>
          </>
        )}
        . Các bài thuộc danh mục này sẽ ngừng nhận gợi ý ghép cặp mới. Gợi ý và trao đổi đã có vẫn
        được giữ lại.
      </p>
    </ConfirmDeleteDialog>
  )
}
