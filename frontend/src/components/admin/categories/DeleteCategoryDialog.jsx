import { incomingRelations } from '../../../lib/admin/categories'
import { ConfirmDeleteDialog } from './ui'

export default function DeleteCategoryDialog({ category, categories, onConfirm, onClose }) {
  const incoming = incomingRelations(categories, category.id)

  return (
    <ConfirmDeleteDialog
      title="Xóa danh mục"
      confirmLabel="Xóa danh mục"
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p className="m-0">
        Bạn có chắc muốn xóa danh mục <strong className="text-ink">“{category.name}”</strong>?
      </p>
      <p className="m-0">
        Thuộc tính, câu hỏi xác minh và cấu hình thuật toán của danh mục cũng sẽ bị xóa.
        {incoming.length > 0 &&
          ` Danh mục này cũng bị gỡ khỏi quan hệ của ${incoming
            .map(({ source }) => source.name)
            .join(', ')}.`}
      </p>
    </ConfirmDeleteDialog>
  )
}
