import { Link } from 'react-router-dom'
import Icon from '../common/Icon'
import TypeTag from '../home/TypeTag'
import { cx, focusRing } from '../moderator/classes'

export default function AttachedPost({ post, linkable }) {
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
          <span className="text-[10.5px] text-ink-subtle">
            {post.mine ? 'Bài đăng của bạn' : 'Bài đăng liên quan'}
          </span>
        </span>
        <strong className="block truncate text-small font-semibold text-ink">{post.title}</strong>
        <span className="block truncate text-[10.5px] text-ink-muted">
          {post.category} · {post.area}
        </span>
      </span>
    </>
  )

  const className = 'flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5'

  if (!linkable) return <div className={className}>{body}</div>

  return (
    <Link
      to={`/posts/${post.id}`}
      className={cx(className, 'no-underline transition-colors hover:border-primary/40', focusRing)}
    >
      {body}
      <Icon name="next" size={16} className="shrink-0 text-ink-subtle" />
    </Link>
  )
}
