import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/user/Button'
import Card from '../../components/user/Card'
import Dialog from '../../components/user/Dialog'
import EmptyState from '../../components/user/EmptyState'
import { cx, focusRing } from '../../components/user/classes'
import MatchCard from '../../components/user/matches/MatchCard'
import { TYPE_LABELS } from '../../lib/user/homeFeed'
import {
  MATCH_THRESHOLDS,
  isMatchable,
  isStrongMatch,
  matchGroups,
  matchPercent,
} from '../../lib/user/matches'

const pageClass = 'mx-auto max-w-270 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'
const titleClass = 'm-0 text-title font-bold tracking-tight text-ink sm:text-heading'

// Chọn bài của tôi để xem gợi ý, chỉ hiện khi có từ hai bài trở lên
function PostPicker({ groups, current, onSelect }) {
  return (
    <div role="group" aria-label="Bài của bạn" className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {groups.map(({ post, items }) => {
        const active = post.id === current.post.id
        return (
          <button
            key={post.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(post.id)}
            className={cx(
              'flex max-w-80 shrink-0 cursor-pointer items-center gap-2 rounded-xl border py-1.5 pr-2 pl-1.5 text-caption font-medium transition-colors',
              active
                ? 'border-primary/40 bg-primary-soft text-primary'
                : 'border-line bg-surface text-ink-secondary hover:bg-surface-muted',
              focusRing
            )}
          >
            <img
              src={post.images[0]}
              alt=""
              className="h-7 w-auto shrink-0 rounded-md bg-line-subtle"
            />
            <span className="truncate">
              <span className="sr-only">{TYPE_LABELS[post.type]}: </span>
              {post.title}
            </span>
            <span className="rounded-full bg-surface px-1.5 text-micro font-bold text-ink-muted">
              {items.length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function MatchesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { posts, now, matches, respondToMatch, contactAbout, notify } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const [rejecting, setRejecting] = useState(null)

  const groups = matchGroups(posts, matches, user.username)
  const current = groups.find((group) => String(group.post.id) === params.get('post')) ?? groups[0]

  if (!current) {
    return (
      <div className={pageClass}>
        <h1 className={cx(titleClass, 'mb-5')}>Gợi ý ghép cặp</h1>
        <Card>
          <EmptyState
            icon="search"
            title="Bạn chưa có bài nào đang tìm"
            description="Khi bạn đăng bài Mất đồ hoặc Nhặt được, LostLink sẽ gợi ý các bài có thể khớp ở đây."
          />
        </Card>
      </div>
    )
  }

  const lost = current.post.type === 'lost'
  const { strong, possible } = MATCH_THRESHOLDS

  // Gợi ý mạnh lên trước, gợi ý yếu xuống dưới để người dùng xem kỹ hơn
  const sections = [
    {
      key: 'strong',
      title: 'Khả năng cao',
      hint: `Khả năng khớp từ ${matchPercent(strong)} trở lên`,
      items: current.items.filter((item) => isStrongMatch(item.match.score)),
    },
    {
      key: 'possible',
      title: 'Có thể khớp',
      hint: `Khả năng khớp từ ${matchPercent(possible)} đến dưới ${matchPercent(strong)}, hãy xem kỹ ảnh và mô tả`,
      items: current.items.filter((item) => !isStrongMatch(item.match.score)),
    },
  ].filter((section) => section.items.length)

  const confirm = ({ match, post }) => {
    // Bài đối ứng đã đóng hoặc đã trao trả thì gợi ý hết hiệu lực
    if (!isMatchable(post)) {
      respondToMatch(match.id, 'stale')
      notify('Gợi ý này không còn hiệu lực')
      return
    }
    respondToMatch(match.id, 'confirmed_one')
    // Người mất trả lời câu hỏi xác minh nếu bài có, còn lại gửi yêu cầu liên hệ
    if (lost && post.question) navigate(`/posts/${post.id}/verify`)
    else contactAbout(post)
  }

  const reject = () => {
    respondToMatch(rejecting.id, 'rejected')
    setRejecting(null)
  }

  return (
    <div className={pageClass}>
      <h1 className={titleClass}>
        {lost ? 'Có thể đây là đồ của bạn?' : 'Có thể đây là món người khác đang tìm?'}
      </h1>
      <p className="m-0 mt-1.5 mb-5 text-small leading-relaxed text-ink-muted">
        {lost ? 'Những tin nhặt được' : 'Những tin mất đồ'} gần nơi và gần lúc với bài{' '}
        <Link
          to={`/posts/${current.post.id}`}
          className={cx('rounded font-semibold text-ink hover:text-primary', focusRing)}
        >
          {current.post.title}
        </Link>{' '}
        của bạn.
      </p>

      {groups.length > 1 && (
        <PostPicker
          groups={groups}
          current={current}
          onSelect={(id) => setParams({ post: String(id) }, { replace: true })}
        />
      )}

      {sections.length ? (
        <div className="flex flex-col gap-7">
          {sections.map((section) => (
            <section key={section.key} aria-labelledby={`matches-${section.key}`}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h2 id={`matches-${section.key}`} className="m-0 text-lead font-bold text-ink">
                  {section.title}{' '}
                  <span className="font-semibold text-ink-subtle">({section.items.length})</span>
                </h2>
                <p className="m-0 text-tiny text-ink-muted">{section.hint}</p>
              </div>
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {section.items.map((item) => (
                  <li key={item.match.id}>
                    <MatchCard
                      item={item}
                      lost={lost}
                      now={now}
                      onConfirm={() => confirm(item)}
                      onReject={() => setRejecting(item.match)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="search"
            title="Chưa có gợi ý nào cho bài này"
            description="LostLink sẽ báo cho bạn ngay khi có bài phù hợp."
          />
        </Card>
      )}

      {rejecting && (
        <Dialog
          size="sm"
          title={lost ? 'Không phải đồ của bạn?' : 'Không phải món bạn nhặt được?'}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button size="lg" onClick={() => setRejecting(null)} data-autofocus>
                Giữ lại
              </Button>
              <Button variant="danger" size="lg" onClick={reject}>
                Ẩn gợi ý
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Gợi ý này sẽ bị ẩn khỏi danh sách và LostLink sẽ không gợi ý lại bài này cho bạn.
          </p>
        </Dialog>
      )}
    </div>
  )
}
