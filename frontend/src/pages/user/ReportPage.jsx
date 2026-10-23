import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Avatar from '../../components/user/Avatar'
import BackLink from '../../components/user/BackLink'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import Card from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import ImagePicker from '../../components/user/ImagePicker'
import Note from '../../components/user/Note'
import { cx, textareaClass } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import { peerOf, postSnapshot } from '../../lib/userMessages'
import {
  DESCRIPTION_MAX,
  MAX_SCREENSHOTS,
  needsDescription,
  reasonLabel,
  reasonsFor,
  reportKey,
  validateReport,
} from '../../lib/userReports'

const pageClass = 'mx-auto max-w-160 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'
const sectionTitle = 'm-0 mb-2.5 p-0 text-body font-bold text-ink'

let nextScreenshotId = 0

// Đối tượng bị báo cáo: bài đăng (từ trang chi tiết) hoặc người dùng (từ hội thoại)
function useReportTarget() {
  const { id, threadId } = useParams()
  const { posts, chat } = useOutletContext()

  if (threadId) {
    const thread = chat.threads.find((item) => item.id === threadId)
    if (!thread) return null
    const back = { to: '/messages', label: 'Quay lại tin nhắn' }
    return {
      type: 'user',
      id: thread.peer.name,
      peer: thread.peer,
      post: thread.post,
      linkable: thread.post.id != null,
      back,
    }
  }

  const post = posts.find((item) => String(item.id) === id)
  if (!post) return null
  return {
    type: 'post',
    id: post.id,
    peer: peerOf(post),
    post: postSnapshot(post),
    linkable: true,
    back: { to: `/posts/${post.id}`, label: 'Quay lại bài đăng' },
  }
}

function Unavailable({ back, title, description }) {
  return (
    <div className={pageClass}>
      <BackLink to={back.to}>{back.label}</BackLink>
      <Card>
        <EmptyState icon="flag" title={title} description={description} />
      </Card>
    </div>
  )
}

function FieldError({ id, children }) {
  return (
    <p id={id} role="alert" className="m-0 mt-2 text-caption text-danger-ink">
      {children}
    </p>
  )
}

// Báo cáo vi phạm (UC05): người bị báo cáo không biết ai đã báo
export default function ReportPage() {
  const { user } = useAuth()
  const { reports, submitReport, notify } = useOutletContext()
  const target = useReportTarget()

  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [screenshots, setScreenshots] = useState([])
  const [block, setBlock] = useState(true)
  const [errors, setErrors] = useState({})
  const descriptionRef = useRef(null)

  // Thu hồi URL xem trước của ảnh khi rời trang
  const screenshotsRef = useRef(screenshots)
  useEffect(() => {
    screenshotsRef.current = screenshots
  }, [screenshots])
  useEffect(
    () => () => screenshotsRef.current.forEach((image) => URL.revokeObjectURL(image.url)),
    []
  )

  if (!target) {
    return (
      <Unavailable
        back={{ to: '/', label: 'Về trang chủ' }}
        title="Không tìm thấy nội dung cần báo cáo"
        description="Bài đăng hoặc cuộc trò chuyện không tồn tại hoặc đã bị ẩn."
      />
    )
  }

  if (target.peer.name === user.username) {
    return (
      <Unavailable
        back={target.back}
        title="Bạn không thể báo cáo bài đăng của mình"
        description="Nếu bài có sai sót, hãy sửa hoặc gỡ bài ở trang quản lý bài đăng."
      />
    )
  }

  const { type, peer, post, back } = target
  const isUser = type === 'user'
  const required = needsDescription(reason)
  const sent = reports[reportKey(target)]

  const addScreenshots = (files) =>
    setScreenshots((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `shot-${(nextScreenshotId += 1)}`,
        url: URL.createObjectURL(file),
        name: file.name,
        file,
      })),
    ])

  const removeScreenshot = (id) => {
    const image = screenshots.find((item) => item.id === id)
    if (image) URL.revokeObjectURL(image.url)
    setScreenshots((prev) => prev.filter((item) => item.id !== id))
  }

  const submit = (event) => {
    event.preventDefault()
    const problems = validateReport({ reason, description })
    setErrors(problems)
    if (problems.reason) return
    if (problems.description) {
      descriptionRef.current.focus()
      return
    }
    submitReport(target, {
      reason,
      description: description.trim(),
      screenshots: screenshots.map((image) => image.name),
      block: isUser && block,
    })
    notify('Đã gửi báo cáo cho LostLink.')
  }

  return (
    <div className={pageClass}>
      <BackLink to={back.to}>{back.label}</BackLink>

      <Card className="p-5 sm:p-6">
        <h1 className="m-0 text-title font-bold tracking-tight text-ink">
          Kể cho LostLink chuyện gì đang xảy ra
        </h1>
        <p className="m-0 mt-1 mb-4 text-caption leading-relaxed text-ink-muted">
          Bạn không cần chắc chắn tuyệt đối. Cứ nói những gì bạn thấy, người của LostLink sẽ xem
          giúp bạn.
        </p>

        <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-line bg-surface-muted p-3">
          <div className="flex items-center gap-3 px-1">
            <Avatar initials={peer.initials} />
            <div className="min-w-0">
              <strong className="block truncate text-small font-semibold text-ink">
                {peer.name}
              </strong>
              <span className="block text-tiny text-ink-muted">
                {isUser ? 'Báo cáo người bạn đang trò chuyện' : 'Báo cáo bài đăng của người này'}
              </span>
            </div>
          </div>
          <AttachedPost post={post} linkable={target.linkable} />
        </div>

        {sent ? (
          <>
            <Note icon="check" tone="success">
              <strong className="block text-small text-success">
                LostLink đã nhận được báo cáo của bạn
              </strong>
              {reasonLabel(sent.reason)}
              {sent.description && <span className="mt-1 block italic">“{sent.description}”</span>}
              {sent.block && <span className="mt-1 block">Bạn đã chặn {peer.name}.</span>}
            </Note>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
              <Link to={back.to} className={buttonClass({ size: 'xl' })}>
                {back.label}
              </Link>
              <Link
                to="/"
                className={buttonClass({
                  variant: 'primary',
                  size: 'xl',
                  className: 'sm:ml-auto',
                })}
              >
                Về trang chủ
              </Link>
            </div>
          </>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-5">
            <fieldset
              className="m-0 border-0 p-0"
              aria-describedby={errors.reason ? 'report-reason-error' : undefined}
            >
              <legend className={sectionTitle}>Chuyện gần nhất với điều bạn gặp</legend>
              <div className="flex flex-col gap-2.5">
                {reasonsFor(type).map((item) => (
                  <label
                    key={item.value}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 transition-colors hover:border-primary/30',
                      'has-checked:border-primary/50 has-checked:bg-primary-subtle has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus'
                    )}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={item.value}
                      checked={reason === item.value}
                      onChange={() => {
                        setReason(item.value)
                        setErrors({})
                      }}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1 text-small font-semibold text-ink">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
              {errors.reason && <FieldError id="report-reason-error">{errors.reason}</FieldError>}
            </fieldset>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor="report-description" className="text-body font-bold text-ink">
                  {required ? (
                    <>
                      Kể thêm chuyện bạn gặp <span className="text-danger">*</span>
                    </>
                  ) : (
                    'Kể thêm nếu bạn muốn'
                  )}
                </label>
                <span className="text-caption text-ink-subtle">
                  {description.length}/{DESCRIPTION_MAX}
                </span>
              </div>
              <textarea
                ref={descriptionRef}
                id="report-description"
                rows={4}
                required={required}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'report-description-error' : undefined}
                maxLength={DESCRIPTION_MAX}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setErrors((prev) => ({ ...prev, description: '' }))
                }}
                placeholder="Ví dụ: bạn ấy nói phải chuyển 500.000đ trước mới cho gặp…"
                className={textareaClass}
              />
              {errors.description && (
                <FieldError id="report-description-error">{errors.description}</FieldError>
              )}
            </div>

            <ImagePicker
              title="Ảnh chụp màn hình"
              max={MAX_SCREENSHOTS}
              cover={false}
              images={screenshots}
              onAdd={addScreenshots}
              onRemove={removeScreenshot}
            />

            {isUser && (
              <label className="flex cursor-pointer items-center gap-2.5 text-small text-ink-secondary">
                <input
                  type="checkbox"
                  checked={block}
                  onChange={(event) => setBlock(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Chặn {peer.name} và ẩn tin của họ khỏi trang chủ của bạn
              </label>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Link to={back.to} className={buttonClass({ size: 'xl' })}>
                {back.label}
              </Link>
              <Button type="submit" variant="danger" size="xl" className="sm:ml-auto">
                Gửi cho LostLink
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
