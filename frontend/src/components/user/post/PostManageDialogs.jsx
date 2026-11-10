import { useId, useState } from 'react'
import { changePostStatus, deletePost } from '../../../api/posts'
import Button from '../Button'
import Dialog from '../Dialog'
import Note from '../Note'
import { cx } from '../classes'

const SAVE_ERROR = 'Đã có lỗi xảy ra, vui lòng thử lại.'

const CLOSE_OPTIONS = [
  {
    value: 'closed',
    label: 'Đóng bài',
    hint: 'Không tìm thấy hoặc không cần tìm nữa. Bài được ẩn khỏi danh sách công khai.',
  },
  {
    value: 'returned',
    label: 'Đánh dấu đã trao trả',
    hint: 'Món đồ đã về với chủ. Bài còn hiện 7 ngày rồi tự ẩn.',
  },
]

// 409 (trạng thái đã đổi) báo đúng lý do, lỗi khác báo chung
const messageOf = (error) => (error.status === 409 ? error.message : SAVE_ERROR)

// Đóng bài hoặc đánh dấu đã trao trả. Lỗi gọi onFailed(error, message)
export function ClosePostDialog({ post, onClose, onDone, onFailed }) {
  const name = useId()
  const [choice, setChoice] = useState('closed')
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    setSaving(true)
    try {
      const { data } = await changePostStatus(post.id, choice)
      onDone(data.status)
    } catch (error) {
      setSaving(false)
      onFailed(error, messageOf(error))
    }
  }

  return (
    <Dialog
      title="Cập nhật trạng thái bài"
      size="sm"
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={confirm}
            disabled={saving}
            aria-busy={saving || undefined}
            data-autofocus
          >
            {saving ? 'Đang lưu…' : 'Xác nhận'}
          </Button>
        </>
      }
    >
      <p className="m-0 mb-3 text-small text-ink-secondary">
        Bài <strong className="text-ink">{post.title}</strong> sẽ không nhận thêm gợi ý ghép cặp hay
        yêu cầu liên hệ mới.
      </p>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Chọn trạng thái mới</legend>
        {CLOSE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cx(
              'flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors',
              choice === option.value
                ? 'border-primary/50 bg-primary-subtle'
                : 'border-line hover:bg-surface-muted'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="block text-small font-semibold text-ink">{option.label}</span>
              <span className="block text-caption text-ink-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  )
}

// Xoá hẳn bài, có ghép cặp hoặc hội thoại đang mở thì cảnh báo thêm
export function DeletePostDialog({ post, activeTalks = 0, onClose, onDone, onFailed }) {
  const [deleting, setDeleting] = useState(false)

  const confirm = async () => {
    setDeleting(true)
    try {
      await deletePost(post.id)
      onDone()
    } catch (error) {
      setDeleting(false)
      onFailed(error, error.status === 403 ? error.message : SAVE_ERROR)
    }
  }

  return (
    <Dialog
      title="Xóa bài đăng?"
      size="sm"
      onClose={deleting ? () => {} : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={deleting} data-autofocus>
            Hủy
          </Button>
          <Button
            variant="danger"
            onClick={confirm}
            disabled={deleting}
            aria-busy={deleting || undefined}
          >
            {deleting ? 'Đang xóa…' : 'Xóa'}
          </Button>
        </>
      }
    >
      <p className="m-0 text-small leading-relaxed text-ink-secondary">
        Bạn có chắc muốn xóa bài đăng <strong className="text-ink">{post.title}</strong>? Bài sẽ bị
        xóa hẳn và không thể khôi phục.
      </p>
      {activeTalks > 0 && (
        <Note icon="warning" tone="warning" className="mt-3">
          Xóa bài sẽ đóng các hội thoại đang trao đổi về món đồ này.
        </Note>
      )}
    </Dialog>
  )
}
