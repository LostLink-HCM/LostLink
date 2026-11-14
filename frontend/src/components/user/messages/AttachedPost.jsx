import { Link } from 'react-router-dom'
import Icon from '../../common/Icon'
import TypeTag from '../home/TypeTag'
import { cx, focusRing } from '../classes'

// Bài đính kèm của hội thoại; bài đã bị xoá (post null) thì báo không còn tồn tại.
// to: đường dẫn bài thật, mặc định là trang bài mẫu /posts/:id
export default function AttachedPost({ post, linkable, to }) {
  if (!post) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface-muted p-2.5 text-small text-ink-muted">
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-line-subtle">
          <Icon name="trash" size={18} />
        </span>
        Bài đăng không tồn tại hoặc đã bị người đăng xoá.
      </div>
    )
  }

  const body = (
    <>
      <img
        src={post.image}
        alt=""
        className="size-14 shrink-0 rounded-lg bg-line-subtle object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="mb-1 flex items-center gap-2">
          <TypeTag type={post.type} />
          <span className="text-tiny text-ink-subtle">
            {post.mine ? 'Bài đăng của bạn' : 'Bài đăng liên quan'}
          </span>
        </span>
        <strong className="block truncate text-small font-semibold text-ink">{post.title}</strong>
        <span className="block truncate text-tiny text-ink-muted">
          {post.category} · {post.area}
        </span>
      </span>
    </>
  )

  const className = 'flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5'

  if (!linkable) return <div className={className}>{body}</div>

  return (
    <Link
      to={to ?? `/posts/${post.id}`}
      className={cx(className, 'no-underline transition-colors hover:border-primary/40', focusRing)}
    >
      {body}
      <Icon name="next" size={16} className="shrink-0 text-ink-subtle" />
    </Link>
  )
}
