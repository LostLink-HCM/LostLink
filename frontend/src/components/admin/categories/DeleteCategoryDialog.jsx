import { ConfirmDeleteDialog } from './ui'

export default function DeleteCategoryDialog({ category, onConfirm, onClose }) {
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
        Danh mục sẽ không còn xuất hiện trong các danh sách đang hoạt động. Bài đăng cũ vẫn giữ
        nguyên liên kết với danh mục này.
      </p>
    </ConfirmDeleteDialog>
  )
}
