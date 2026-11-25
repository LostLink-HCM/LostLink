import { Link } from 'react-router-dom'

import Icon from '../../common/Icon'
import Button from '../Button'
import { cx, focusRing } from '../classes'
import { postPath } from '../../../lib/user/homeFeed'

export default function CounterpartAsk({ thread, busy, onAnswer }) {
  const ask = thread.counterpartAsk
  return (
    <section
      aria-label="Bài của bạn có phải cùng món không"
      className="border-b border-primary/20 bg-primary-soft px-4 py-3 sm:px-5"
    >
      <p className="m-0 flex items-start gap-2 text-caption leading-snug text-ink-secondary">
        <Icon name="info" size={16} className="mt-px shrink-0 text-primary" />
        <span>
          Bài <strong className="text-ink">“{ask.title}”</strong> của bạn có phải cùng món với bài{' '}
          <strong className="text-ink">“{thread.post.title}”</strong> vừa trao trả không? Đúng thì
          bài của bạn chuyển sang Đã trao trả.
        </span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
        <Button variant="primary" size="sm" disabled={busy} onClick={() => onAnswer(true)}>
          Đúng, cùng món
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onAnswer(false)}>
          Không phải
        </Button>
        <Link
          to={postPath(ask)}
          className={cx(
            'inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-caption font-semibold text-primary no-underline hover:underline',
            focusRing
          )}
        >
          Xem bài
          <Icon name="next" size={14} />
        </Link>
      </div>
    </section>
  )
}
