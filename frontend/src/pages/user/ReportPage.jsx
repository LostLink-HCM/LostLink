import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { getPostReport, reportPost } from '../../api/posts'
import { getUserReport, reportUser } from '../../api/users'
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
import { useBack, useProfileData } from '../../hooks/useProfileData'
import { postPath } from '../../lib/user/homeFeed'
import { profilePath } from '../../lib/user/profiles'
import {
  DESCRIPTION_MAX,
  MAX_SCREENSHOTS,
  needsDescription,
  reasonLabel,
  reasonsFor,
  reportKey,
  validateReport,
} from '../../lib/user/reports'

const pageClass = 'mx-auto max-w-160 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'
const sectionTitle = 'm-0 mb-2.5 p-0 text-body font-bold text-ink'
const FAILED = 'Đã có lỗi xảy ra, vui lòng thử lại.'

let nextScreenshotId = 0

const peerOf = (name) => ({ name, initials: name.slice(0, 2).toUpperCase() })

// Lỗi khi tải đối tượng: không có, báo cáo chính mình hoặc lỗi mạng
const LOAD_ERRORS = {
  CANNOT_REPORT_SELF: { title: 'Bạn không thể báo cáo chính mình' },
  CANNOT_REPORT_OWN_POST: {
    title: 'Bạn không thể báo cáo bài đăng của mình',
    description: 'Nếu bài có sai sót, hãy sửa hoặc gỡ bài ở trang quản lý bài đăng.',
  },
}
const NOT_FOUND = {
  title: 'Không tìm thấy nội dung cần báo cáo',
  description: 'Bài đăng hoặc người dùng không tồn tại hoặc đã bị ẩn.',
}

function Unavailable({ back, title, description, onRetry }) {
  return (
    <div className={pageClass}>
      <BackLink {...back}>{back.label}</BackLink>
      <Card>
        <EmptyState icon="flag" title={title} description={description} />
        {onRetry && (
          <div className="flex justify-center pb-6">
            <Button onClick={onRetry}>Thử lại</Button>
          </div>
        )}
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

// Báo cáo vi phạm: người bị báo cáo không biết ai đã báo.
// Bài đăng, người dùng đi qua API; báo cáo từ hội thoại còn dùng dữ liệu mẫu
export default function ReportPage() {
  const { threadId } = useParams()
  return threadId ? <ThreadReport threadId={threadId} /> : <ApiReport />
}

function ApiReport() {
  const { id, username } = useParams()
  const { blockUser: lockChat, notify } = useOutletContext()
  const back = useBack()
  const load = useCallback(
    () => (username ? getUserReport(username) : getPostReport(id)),
    [id, username]
  )
  const { data, error, loading, reload } = useProfileData(load)
  const [sent, setSent] = useState(null)

  if (loading) {
    return (
      <div className={pageClass}>
        <Card className="h-80 animate-pulse" aria-busy="true" />
      </div>
    )
  }
  if (error) {
    const known = error.status === 404 ? NOT_FOUND : LOAD_ERRORS[error.code]
    return (
      <Unavailable
        back={{ onClick: back, label: 'Quay lại' }}
        {...(known ?? { title: 'Không thể tải trang báo cáo, vui lòng thử lại', onRetry: reload })}
      />
    )
  }

  const { target: info } = data
  const target = username
    ? {
        type: 'user',
        peer: peerOf(info.username),
        post: null,
        canBlock: !data.blocked,
        back: { to: profilePath(info.username), label: 'Quay lại trang cá nhân' },
      }
    : {
        type: 'post',
        peer: peerOf(info.owner.username),
        post: { ...info, image: info.coverImage },
        postLink: postPath(info),
        back: { to: postPath(info), label: 'Quay lại bài đăng' },
      }
  const saved = data.report && { ...data.report, block: data.blocked }

  const submit = async ({ reason, description, screenshots, block }) => {
    const form = new FormData()
    form.append('data', JSON.stringify({ reason, description, ...(username && { block }) }))
    screenshots.forEach((file) => form.append('screenshots', file))
    try {
      const res = await (username ? reportUser(username, form) : reportPost(id, form))
      if (res.data.blocked) lockChat(target.peer.name)
      setSent({ ...res.data.report, block: res.data.blocked })
      notify('Đã gửi báo cáo cho LostLink.')
    } catch (err) {
      // Đã gửi ở tab khác: tải lại để hiện báo cáo cũ
      if (err.code === 'ALREADY_REPORTED') reload()
      else throw err
    }
  }

  return <ReportView target={target} sent={sent ?? saved} onSubmit={submit} />
}

function ThreadReport({ threadId }) {
  const { chat, reports, submitReport, notify } = useOutletContext()
  const thread = chat.threads.find((item) => item.id === threadId)
  if (!thread) {
    return <Unavailable back={{ to: '/messages', label: 'Quay lại tin nhắn' }} {...NOT_FOUND} />
  }

  const target = {
    type: 'user',
    id: thread.peer.name,
    peer: thread.peer,
    post: thread.post,
    canBlock: true,
    back: { to: '/messages', label: 'Quay lại tin nhắn' },
  }

  const submit = async ({ screenshots, ...report }) => {
    submitReport(target, { ...report, screenshots: screenshots.map((file) => file.name) })
    notify('Đã gửi báo cáo cho LostLink.')
  }

  return <ReportView target={target} sent={reports[reportKey(target)]} onSubmit={submit} />
}

function ReportView({ target, sent, onSubmit }) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [screenshots, setScreenshots] = useState([])
  const [block, setBlock] = useState(true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  const { type, peer, post, back } = target
  const isUser = type === 'user'
  const required = needsDescription(reason)

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

  const submit = async (event) => {
    event.preventDefault()
    const problems = validateReport({ reason, description })
    setErrors(problems)
    setFormError('')
    if (problems.reason) return
    if (problems.description) {
      descriptionRef.current.focus()
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        reason,
        description: description.trim(),
        screenshots: screenshots.map((image) => image.file),
        block: isUser && target.canBlock && block,
      })
    } catch (err) {
      // Lỗi theo trường hiện dưới trường đó; quá tần suất và lỗi khác hiện cuối form
      if (err.status === 422 && err.details.length) setErrors(err.fieldErrors)
      else setFormError(err.status && err.status < 500 ? err.message : FAILED)
    } finally {
      setSubmitting(false)
    }
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
                {!isUser
                  ? 'Báo cáo bài đăng của người này'
                  : post
                    ? 'Báo cáo người bạn đang trò chuyện'
                    : 'Báo cáo tài khoản này'}
              </span>
            </div>
          </div>
          {post && (
            <AttachedPost
              post={post}
              linkable={Boolean(target.postLink) || post.id != null}
              to={target.postLink}
            />
          )}
        </div>

        {sent ? (
          <>
            <Note icon="check" tone="success">
              <strong className="block text-small text-success">
                LostLink đã nhận được báo cáo của bạn
              </strong>
              {reasonLabel(sent.reason)}
              {sent.description && <span className="mt-1 block italic">“{sent.description}”</span>}
              {isUser && sent.block && <span className="mt-1 block">Bạn đã chặn {peer.name}.</span>}
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

            <div>
              <ImagePicker
                title="Ảnh chụp màn hình"
                max={MAX_SCREENSHOTS}
                cover={false}
                images={screenshots}
                onAdd={addScreenshots}
                onRemove={removeScreenshot}
              />
              {errors.screenshots && (
                <FieldError id="report-screenshots-error">{errors.screenshots}</FieldError>
              )}
            </div>

            {isUser && target.canBlock && (
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

            {formError && (
              <div role="alert">
                <Note icon="warning" tone="danger">
                  {formError}
                </Note>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Link to={back.to} className={buttonClass({ size: 'xl' })}>
                {back.label}
              </Link>
              <Button
                type="submit"
                variant="danger"
                size="xl"
                className="sm:ml-auto"
                disabled={submitting}
              >
                {submitting ? 'Đang gửi…' : 'Gửi cho LostLink'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
