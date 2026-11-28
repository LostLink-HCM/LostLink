import { useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { buttonClass } from '../../components/user/buttonClass'
import { confirmMatch, listMatches, rejectMatch } from '../../api/matches'
import Button from '../../components/user/Button'
import Card from '../../components/user/Card'
import Dialog from '../../components/user/Dialog'
import EmptyState from '../../components/user/EmptyState'
import Icon from '../../components/common/Icon'
import IconButton from '../../components/user/IconButton'
import { cx } from '../../components/user/classes'
import MatchCard, { MyPostCard } from '../../components/user/matches/MatchCard'
import PostPicker from '../../components/user/matches/PostPicker'
import useMediaQuery from '../../hooks/useMediaQuery'
import { useProfileData } from '../../hooks/useProfileData'
import { toFeedPost } from '../../lib/user/homeFeed'
import { contactThreadId, findGroup, rejectedLast, sortGroups } from '../../lib/user/matches'

const pageClass = 'mx-auto max-w-360 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'
const titleClass = 'm-0 text-title font-bold tracking-tight text-ink sm:text-heading'
const ERROR_MESSAGE = 'Đã có lỗi xảy ra, vui lòng thử lại.'

// Giữ thêm đặc điểm để so sánh hai bài
const toPost = (card, now) => ({
  ...toFeedPost(card, now),
  traits: card.traits ?? [],
})

const toGroups = (data, now) =>
  (data?.groups ?? []).map((group) => ({
    post: toPost(group.post, now),
    items: group.items.map((item) => ({ match: item, post: toPost(item.post, now) })),
  }))

export default function MatchesPage() {
  const { now, claimPost, notify, refreshPendingMatches, inbox } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload } = useProfileData(listMatches)
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(null)
  // Gợi ý vừa bấm Không phải: vẫn hiện nhưng làm mờ, không tải lại
  const [rejected, setRejected] = useState(() => new Set())
  // Gợi ý vừa xác nhận (id → trạng thái), cập nhật thẻ mà không tải lại
  const [confirmed, setConfirmed] = useState(() => new Map())
  // Điện thoại: chưa chọn bài thì chỉ hiện danh sách bài, chọn bài mới hiện manh mối
  const isDesktop = useMediaQuery('(min-width: 64rem)')
  const navigate = useNavigate()
  const location = useLocation()

  if (loading) {
    return (
      <div className={pageClass}>
        <h1 className={cx(titleClass, 'mb-5')}>Manh mối</h1>
        <div className="flex flex-col gap-4" role="status" aria-label="Đang tải manh mối">
          {[0, 1].map((key) => (
            <div key={key} className="h-48 animate-pulse rounded-2xl bg-line-subtle" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className={pageClass}>
        <h1 className={cx(titleClass, 'mb-5')}>Manh mối</h1>
        <Card className="pb-8">
          <EmptyState icon="warning" title="Không thể tải manh mối, vui lòng thử lại" />
          <div className="flex justify-center">
            <Button onClick={reload}>Thử lại</Button>
          </div>
        </Card>
      </div>
    )
  }

  const groups = sortGroups(
    toGroups(data, now).map((group) => ({
      ...group,
      items: group.items
        .map((item) =>
          rejected.has(item.match.id)
            ? { ...item, match: { ...item.match, state: 'rejected', rejectedBy: 'me' } }
            : item
        )
        .map((item) =>
          confirmed.has(item.match.id)
            ? {
                ...item,
                match: { ...item.match, confirmed: true, state: confirmed.get(item.match.id) },
              }
            : item
        ),
    }))
  )
  const current = findGroup(groups, params.get('post'))

  if (!current) {
    return (
      <div className={pageClass}>
        <h1 className={cx(titleClass, 'mb-5')}>Manh mối</h1>
        <Card>
          <EmptyState
            items
            action={
              <Link to="/posts/new" className={buttonClass({ variant: 'primary', size: 'lg' })}>
                <Icon name="compose" size={16} />
                Đăng bài
              </Link>
            }
            title="Bạn chưa có bài nào đang tìm"
            description="Khi bạn đăng bài Mất đồ hoặc Nhặt được, LostLink sẽ tìm manh mối từ các bài có thể khớp và hiện ở đây."
          />
        </Card>
      </div>
    )
  }

  const lost = current.post.type === 'lost'

  // Gợi ý mạnh lên trước, gợi ý yếu xuống dưới để người dùng xem kỹ hơn.
  // Trong mỗi mục, manh mối đã bị từ chối xuống cuối
  const sections = [
    {
      key: 'strong',
      title: 'Khả năng cao',
      items: rejectedLast(current.items.filter((item) => item.match.strong)),
    },
    {
      key: 'possible',
      title: 'Có thể khớp',
      items: rejectedLast(current.items.filter((item) => !item.match.strong)),
    },
  ].filter((section) => section.items.length)

  // Ghi nhận xác nhận rồi chuyển sang trả lời câu hỏi xác minh hoặc gửi yêu cầu liên hệ
  const confirm = async ({ match }) => {
    setBusy(match.id)
    try {
      const { data: result } = await confirmMatch(match.id)
      setConfirmed((prev) => new Map(prev).set(match.id, result.state))
      refreshPendingMatches()
      await claimPost(result.post)
    } catch (err) {
      // Bài đối ứng không còn nhận gợi ý: báo và tải lại danh sách
      notify(err.status === 409 ? err.message : ERROR_MESSAGE)
      if (err.status === 409) {
        reload()
        refreshPendingMatches()
      }
    } finally {
      setBusy(null)
    }
  }

  // Đã xác nhận: mở hội thoại hoặc yêu cầu sẵn có, chưa liên hệ thì đi tiếp luồng nhận đồ
  const contact = async (item) => {
    const threadId = contactThreadId(item.match.contact)
    if (!threadId) {
      setBusy(item.match.id)
      await claimPost(item.post)
      setBusy(null)
      return
    }
    await inbox.reload().catch(() => {})
    inbox.open(threadId)
    navigate('/messages', { state: { openConversation: true } })
  }

  const reject = async () => {
    const { id } = rejecting
    setRejecting(null)
    setBusy(id)
    try {
      await rejectMatch(id)
      // Bài bớt manh mối chưa phản hồi sẽ đổi chỗ trong danh sách: giữ bài đang xem trên URL
      if (!params.get('post')) setParams({ post: String(current.post.id) }, { replace: true })
      setRejected((prev) => new Set(prev).add(id))
      refreshPendingMatches()
    } catch (err) {
      notify(err.status === 409 ? err.message : ERROR_MESSAGE)
    } finally {
      setBusy(null)
    }
  }

  const picking = groups.length > 1
  const listOnly = picking && !isDesktop && !params.get('post')

  // Máy tính đổi bài tại chỗ; điện thoại mở bài như một trang con để nút Back quay về danh sách
  const select = (id) =>
    isDesktop
      ? setParams({ post: String(id) }, { replace: true })
      : setParams({ post: String(id) }, { state: { fromList: true } })
  const backToList = () =>
    location.state?.fromList ? navigate(-1) : setParams({}, { replace: true })

  return (
    <div
      className={cx(
        pageClass,
        // Hai cột có độ rộng cố định và nằm giữa màn hình, hai mép cách đều
        picking &&
          'lg:grid lg:grid-cols-[21rem_minmax(0,50rem)] lg:items-start lg:justify-center lg:gap-8'
      )}
    >
      {listOnly && <h1 className={cx(titleClass, 'mb-4')}>Manh mối</h1>}
      {picking && (isDesktop || listOnly) && (
        <div className="lg:sticky lg:top-22">
          <PostPicker groups={groups} current={isDesktop ? current : null} onSelect={select} />
        </div>
      )}

      {!listOnly && (
        // Giới hạn chiều rộng cột manh mối để thẻ không bị kéo quá dài trên màn rộng
        <div className="mx-auto w-full max-w-200 min-w-0">
          {/* Điện thoại: nút quay lại danh sách bài giữ ở trên cùng */}
          {picking && !isDesktop && (
            <IconButton
              icon="back"
              label="Quay lại danh sách bài"
              size={36}
              className="-ml-2 mb-2 shrink-0 text-ink-secondary"
              onClick={backToList}
            />
          )}

          {/* Bài của tôi trước, câu hỏi ngay trên các manh mối để đọc liền mạch */}
          <div className="mb-6">
            <MyPostCard post={current.post} now={now} />
          </div>

          <h1 className={cx(titleClass, 'mb-5')}>
            {lost ? 'Có thể đây là đồ của bạn?' : 'Có thể đây là món người khác đang tìm?'}
          </h1>

          {sections.length ? (
            <div className="flex flex-col gap-7">
              {sections.map((section) => (
                <section key={section.key} aria-labelledby={`matches-${section.key}`}>
                  <h2
                    id={`matches-${section.key}`}
                    className="m-0 mb-3 text-lead font-bold text-ink"
                  >
                    {section.title}{' '}
                    <span className="font-semibold text-ink-subtle">({section.items.length})</span>
                  </h2>
                  <ul className="m-0 flex list-none flex-col gap-4 p-0">
                    {section.items.map((item) => (
                      <li key={item.match.id}>
                        <MatchCard
                          item={item}
                          mine={current.post}
                          lost={lost}
                          now={now}
                          busy={busy === item.match.id}
                          onConfirm={() => confirm(item)}
                          onReject={() => setRejecting(item.match)}
                          onContact={() => contact(item)}
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
                items
                title="Chưa có manh mối nào cho bài này"
                description="LostLink sẽ báo cho bạn ngay khi có bài phù hợp."
              />
            </Card>
          )}
        </div>
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
                Xác nhận không phải
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Manh mối sẽ được làm mờ ở cuối danh sách, bạn vẫn có thể xem lại. Người đăng bài kia
            cũng thấy manh mối này đã được xác nhận không phải, và LostLink sẽ không gợi ý lại bài
            này.
          </p>
        </Dialog>
      )}
    </div>
  )
}
