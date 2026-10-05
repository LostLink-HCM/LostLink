import { useState } from 'react'
import Button from './Button'
import Dialog from './Dialog'
import Field, { Input, Textarea } from './Field'
import { ESCALATION_ACTIONS } from '../../lib/escalations'

const SUBMIT_VARIANTS = { view: 'primary', success: 'success', danger: 'danger' }

const checkboxLabel = 'flex cursor-pointer items-start gap-2.5 text-small leading-relaxed'
const checkbox = 'mt-1 size-4 shrink-0 cursor-pointer accent-primary'
const description = 'text-small leading-relaxed text-ink-secondary'
const hint = 'text-caption leading-relaxed text-ink-muted'

export default function EscalationActionDialog({ ticket, action, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [targets, setTargets] = useState(action === 'remind' ? ['lost', 'found'] : [])
  const [offlineConfirmed, setOfflineConfirmed] = useState(false)
  const [subject, setSubject] = useState(`LostLink · Nhắc xác nhận hồ sơ #${ticket.id}`)
  const [message, setMessage] = useState(
    `Chào bạn,\n\nLostLink đang theo dõi hồ sơ #${ticket.id} – ${ticket.item}. Vui lòng kiểm tra và xác nhận “Đã trao trả” nếu đã nhận/giao lại đồ, hoặc “Không chính xác” nếu hai bài đăng không khớp.\n\nCảm ơn bạn đã hỗ trợ cộng đồng LostLink.`
  )
  const [error, setError] = useState('')
  const settings = ESCALATION_ACTIONS[action]
  const toggleTarget = (side) =>
    setTargets((previous) =>
      previous.includes(side) ? previous.filter((entry) => entry !== side) : [...previous, side]
    )
  const submit = (event) => {
    event.preventDefault()
    try {
      onSubmit({ id: ticket.id, action, reason, targets, offlineConfirmed, subject, message })
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <Dialog
      title={settings.label}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button form="escalation-action" type="submit" variant={SUBMIT_VARIANTS[settings.tone]}>
            {action === 'remind' ? 'Gửi email nhắc' : 'Xác nhận'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
        #{ticket.id} · {ticket.item}
      </p>
      <form id="escalation-action" className="flex flex-col gap-4" onSubmit={submit}>
        {action === 'returned' && (
          <div className="rounded-lg bg-primary-subtle p-3.5 text-small leading-relaxed text-primary">
            <strong>Ca A · Đã trao trả offline, quên xác nhận</strong>
            <p className="mt-1 mb-2.5">
              Xác nhận hộ cả hai bên và chuyển hai bài đăng sang “Đã trao trả”. Hồ sơ sẽ được đóng.
            </p>
            <label className={checkboxLabel}>
              <input
                type="checkbox"
                className={checkbox}
                checked={offlineConfirmed}
                onChange={(event) => setOfflineConfirmed(event.target.checked)}
              />
              Tôi đã kiểm tra căn cứ cho thấy hai bên thực sự trao trả đồ offline.
            </label>
          </div>
        )}
        {action === 'incorrect' && (
          <p className={description}>
            Xác nhận hai bài đăng không khớp, bác bỏ cặp ghép và đưa hai bài về “Đang tìm”. Những
            bài đã ẩn vẫn giữ trạng thái ẩn.
          </p>
        )}
        {action === 'verify' && (
          <p className={description}>
            Gắn nhãn “Đã xác minh” cho hồ sơ sau khi kiểm tra thông tin hai bên. Nhãn này không tự
            xác nhận việc trao trả.
          </p>
        )}
        {['remind', 'hide'].includes(action) && (
          <fieldset className="flex flex-col gap-2.5 rounded-lg border border-line px-3.5 pt-2 pb-3.5">
            <legend className="px-1 text-small font-semibold text-ink-secondary">
              {action === 'remind' ? 'Người nhận email' : 'Chọn bài đăng cần ẩn'}
            </legend>
            {['lost', 'found'].map((side) => (
              <label key={side} className={checkboxLabel}>
                <input
                  type="checkbox"
                  className={checkbox}
                  checked={targets.includes(side)}
                  disabled={action === 'hide' && ticket[side].hidden}
                  onChange={() => toggleTarget(side)}
                />
                <span className="min-w-0">
                  <strong>
                    {side === 'lost' ? 'Bên mất' : 'Bên nhặt'} · {ticket[side].name}
                  </strong>
                  <small className="block text-caption text-ink-muted [overflow-wrap:anywhere]">
                    {action === 'remind'
                      ? ticket[side].email
                      : `${ticket[side].postId} · ${ticket[side].title}${ticket[side].hidden ? ' (Đã ẩn)' : ''}`}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {action === 'remind' && (
          <>
            <Field label="Tiêu đề email">
              {(a) => (
                <Input
                  {...a}
                  value={subject}
                  maxLength={200}
                  onChange={(event) => setSubject(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Nội dung email"
              hint="Nội dung và người nhận sẽ được ghi vào nhật ký thao tác."
            >
              {(a) => (
                <Textarea
                  {...a}
                  rows={7}
                  value={message}
                  maxLength={5000}
                  onChange={(event) => setMessage(event.target.value)}
                />
              )}
            </Field>
          </>
        )}
        <Field label="Lý do / căn cứ xử lý" error={error}>
          {(a) => (
            <Textarea
              {...a}
              data-autofocus
              value={reason}
              maxLength={1500}
              placeholder={
                action === 'returned'
                  ? 'Ghi rõ căn cứ xác nhận hai bên đã giao nhận…'
                  : 'Ghi rõ thông tin đã kiểm tra và lý do thực hiện…'
              }
              onChange={(event) => {
                setReason(event.target.value)
                setError('')
              }}
            />
          )}
        </Field>
        <p className={hint}>
          Thao tác và căn cứ xử lý sẽ được ghi vào nhật ký cùng tài khoản moderator và thời gian
          thực hiện.
        </p>
      </form>
    </Dialog>
  )
}
