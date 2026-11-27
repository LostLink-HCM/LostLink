import { useState } from 'react'
import { Link } from 'react-router-dom'

import Icon from '../../common/Icon'
import Button from '../Button'
import { cx, focusRing } from '../classes'
import { postPath } from '../../../lib/user/homeFeed'

const linkClass = cx(
  'inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-caption font-semibold text-primary no-underline hover:underline',
  focusRing
)

// Sau trao trả: hỏi bài nào của mình cùng món. Một bài thì Đúng/Không, nhiều bài thì chọn một hoặc
// bỏ qua. onAnswer(same, postId)
export default function CounterpartAsk({ thread, busy, onAnswer }) {
  const options = thread.counterpartAsk
  const [picked, setPicked] = useState(null)
  const single = options.length === 1

  return (
    <section
      aria-label="Bài của bạn có phải cùng món không"
      className="border-b border-primary/20 bg-primary-soft px-4 py-3 sm:px-5"
    >
      <p className="m-0 flex items-start gap-2 text-caption leading-snug text-ink-secondary">
        <Icon name="info" size={16} className="mt-px shrink-0 text-primary" />
        {single ? (
          <span>
            Bài <strong className="text-ink">“{options[0].title}”</strong> của bạn có phải cùng món
            với bài <strong className="text-ink">“{thread.post.title}”</strong> vừa trao trả không?
            Đúng thì bài của bạn chuyển sang Đã trao trả.
          </span>
        ) : (
          <span>
            Bạn có bài nào cùng món với bài{' '}
            <strong className="text-ink">“{thread.post.title}”</strong> vừa trao trả không? Chọn bài
            đó để chuyển sang Đã trao trả, hoặc bỏ qua nếu không có.
          </span>
        )}
      </p>

      {!single && (
        <fieldset className="m-0 mt-2.5 flex flex-col gap-1.5 border-0 p-0 pl-6">
          <legend className="sr-only">Chọn bài cùng món</legend>
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-caption font-semibold text-ink has-checked:border-primary has-checked:bg-primary-faint">
                <input
                  type="radio"
                  name={`counterpart-${thread.id}`}
                  value={option.id}
                  checked={picked === option.id}
                  onChange={() => setPicked(option.id)}
                  className="accent-primary"
                />
                <span className="truncate">{option.title}</span>
              </label>
              <Link to={postPath(option)} className={linkClass}>
                Xem bài
                <Icon name="next" size={14} />
              </Link>
            </div>
          ))}
        </fieldset>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
        {single ? (
          <>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => onAnswer(true)}>
              Đúng, cùng món
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => onAnswer(false)}>
              Không phải
            </Button>
            <Link to={postPath(options[0])} className={linkClass}>
              Xem bài
              <Icon name="next" size={14} />
            </Link>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !picked}
              onClick={() => onAnswer(true, picked)}
            >
              Đúng, bài này cùng món
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => onAnswer(false)}>
              Bỏ qua
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
