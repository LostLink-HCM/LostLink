import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../../components/backoffice/Button'
import { cx } from '../../components/backoffice/classes'
import Dialog from '../../components/backoffice/Dialog'
import IconButton from '../../components/backoffice/IconButton'
import Icon from '../../components/common/Icon'
import {
  DEFAULT_SETTINGS,
  WEIGHT_FIELDS,
  readSettings,
  saveSettings,
  validateSettings,
  weightTotal,
} from '../../lib/adminSettings'
import {
  cloneQuickReplies,
  QUICK_REPLY_TEXT_LIMIT,
  saveQuickReplies,
  validateQuickReplies,
} from '../../lib/quickReplies'

const weightTones = {
  wLocation: 'bg-[#3976bd]',
  wTime: 'bg-[#299687]',
  wCategory: 'bg-[#8a73ba]',
  wDescription: 'bg-[#bb8c38]',
  wImage: 'bg-[#bd7086]',
}

const cardTones = {
  blue: {
    accent: 'border-t-[#3976bd]',
    tint: 'from-[#edf3fc]',
    icon: 'border border-[#d5e0ec] bg-white text-[#3976bd]',
  },
  amber: {
    accent: 'border-t-[#b4852e]',
    tint: 'from-[#fcf6e9]',
    icon: 'border border-[#e4d5b8] bg-white text-[#a67a2d]',
  },
}

function SettingsCard({ id, icon, title, description, children, tone = 'blue', className }) {
  const colors = cardTones[tone]

  return (
    <section
      className={cx(
        'min-w-0 overflow-hidden rounded-[10px] border border-[#b4c6db] border-t-[3px] bg-surface shadow-[0_3px_10px_#16233a08]',
        colors.accent,
        className
      )}
      aria-labelledby={id}
    >
      <header
        className={cx(
          'flex items-center gap-3 border-b border-[#d5e0ec] bg-linear-to-br to-white px-6 py-5 max-sm:gap-2.5 max-sm:px-[17px] max-sm:py-[17px]',
          colors.tint
        )}
      >
        <span
          className={cx('grid size-[43px] shrink-0 place-items-center rounded-[9px]', colors.icon)}
        >
          <Icon name={icon} size={21} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="mb-1 text-title font-[650] text-ink max-sm:text-lead">
            {title}
          </h2>
          <p className="text-body leading-relaxed text-ink-muted">{description}</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-0 px-6 py-[22px] max-sm:px-[17px] max-sm:py-[18px]">
        {children}
      </div>
    </section>
  )
}

function SettingField({
  name,
  label,
  hint,
  unit,
  value,
  error,
  onChange,
  onBlur,
  options,
  min,
  max,
}) {
  const id = `setting-${name}`

  return (
    <div className="mb-[22px] flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold text-ink-secondary">
        {label}
      </label>
      <div
        className={cx(
          'flex min-h-[45px] items-center overflow-hidden rounded-[7px] border border-[#b7c8dc] bg-[#fcfdff] transition focus-within:border-[#3976bd] focus-within:ring-3 focus-within:ring-[#3976bd]/10',
          error &&
            'border-[#c75c70] bg-[#fffafb] focus-within:border-[#c75c70] focus-within:ring-[#c75c70]/10'
        )}
      >
        {options ? (
          <select
            id={id}
            name={name}
            value={value}
            onChange={(event) => onChange(name, event.target.value)}
            onBlur={() => onBlur(name)}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
            required
            className="min-h-[43px] w-full min-w-0 cursor-pointer border-0 bg-transparent px-3 py-2 text-base font-semibold text-ink outline-none"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option} ngày
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              id={id}
              name={name}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step="1"
              value={value}
              onChange={(event) => onChange(name, event.target.value)}
              onBlur={() => onBlur(name)}
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
              required
              className="min-h-[43px] min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-base font-semibold text-ink outline-none"
            />
            <span
              className="shrink-0 border-l border-[#dce5ef] px-3 text-small text-ink-muted"
              aria-hidden="true"
            >
              {unit}
            </span>
          </>
        )}
      </div>
      <p id={`${id}-hint`} className="text-small leading-[1.65] text-ink-muted">
        {hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-small leading-relaxed text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function SettingsNotice({ notice }) {
  if (!notice) return null

  const styles = {
    error: 'border-danger-soft bg-danger-soft/50 text-danger-ink',
    success: 'border-success-soft bg-success-soft text-success',
    info: 'border-primary-soft bg-primary-subtle text-primary',
  }
  const icons = { error: 'warning', success: 'check', info: 'info' }

  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-body leading-relaxed',
        styles[notice.type]
      )}
      role={notice.type === 'error' ? 'alert' : 'status'}
    >
      <Icon name={icons[notice.type]} size={18} />
      <span>{notice.text}</span>
    </div>
  )
}

function WeightTrack({ values }) {
  return (
    <div
      className="mt-4 mb-3 flex h-[9px] w-full gap-0.5 overflow-hidden rounded-[5px] bg-[#edf2f8]"
      role="img"
      aria-label="Biểu đồ phân bổ trọng số"
    >
      {WEIGHT_FIELDS.map(({ key }) => {
        const value = Math.max(0, Math.min(100, Number(values[key]) || 0))

        return Array.from({ length: 100 }, (_, index) => (
          <span
            key={`${key}-${index}`}
            className={cx(
              'h-full min-w-0 flex-1',
              index < value ? weightTones[key] : 'bg-line-subtle'
            )}
          />
        ))
      })}
    </div>
  )
}

function WeightField({ field, value, error, weightError, submitted, touched, onChange, onBlur }) {
  const { key, label, symbol } = field
  const id = `setting-${key}`
  const visibleError = (submitted || touched[key]) && error

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-x-4 gap-y-1 border-b border-[#e0e8f1] py-3 last:border-b-0">
      <label
        htmlFor={id}
        className="flex min-w-0 items-center gap-[11px] text-[15px] font-semibold text-ink-secondary"
      >
        <span className={cx('size-[9px] shrink-0 rounded-[3px]', weightTones[key])} />
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          <small className="mt-0.5 block text-caption font-normal text-ink-muted">{symbol}</small>
        </span>
      </label>
      <div>
        <div
          className={cx(
            'flex min-h-[45px] items-center overflow-hidden rounded-[7px] border border-[#b7c8dc] bg-[#fcfdff] transition focus-within:border-[#3976bd] focus-within:ring-3 focus-within:ring-[#3976bd]/10',
            visibleError &&
              'border-[#c75c70] bg-[#fffafb] focus-within:border-[#c75c70] focus-within:ring-[#c75c70]/10'
          )}
        >
          <input
            id={id}
            name={key}
            type="number"
            inputMode="numeric"
            min="0"
            max="100"
            step="1"
            value={value}
            onChange={(event) => onChange(key, event.target.value)}
            onBlur={() => onBlur(key)}
            aria-label={`Trọng số ${label.toLocaleLowerCase('vi')}`}
            aria-invalid={Boolean((visibleError || weightError) && (submitted || touched[key]))}
            aria-describedby={`${visibleError ? `setting-${key}-error ` : ''}settings-weight-help${weightError ? ' settings-weight-error' : ''}`}
            required
            className="min-h-[43px] min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-right text-base font-semibold text-ink outline-none"
          />
          <span
            className="border-l border-[#dce5ef] px-3 text-small text-ink-muted"
            aria-hidden="true"
          >
            %
          </span>
        </div>
        {visibleError && (
          <p id={`setting-${key}-error`} className="mt-1 text-caption text-danger-ink" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

const quickReplyGroups = [
  { key: 'user', label: 'Người dùng' },
  { key: 'internal', label: 'Nội bộ' },
]

function createQuickReplyId(group) {
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `${group}-${randomId}`
}

function QuickReplyManager({ value, onChange, error }) {
  const [activeGroup, setActiveGroup] = useState('user')
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionError, setActionError] = useState('')
  const replies = value?.[activeGroup] || []

  const updateGroup = (nextReplies) => {
    onChange({ ...value, [activeGroup]: nextReplies })
    setActionError('')
  }

  const hasDuplicate = (text, ignoredId = null) =>
    replies.some(
      (reply) => reply.id !== ignoredId && reply.text.trim().toLocaleLowerCase('vi') === text
    )

  const addReply = () => {
    const text = newText.trim()
    if (!text) {
      setActionError('Nội dung mẫu trả lời không được để trống.')
      return
    }
    if (text.length > QUICK_REPLY_TEXT_LIMIT) {
      setActionError(`Nội dung không được vượt quá ${QUICK_REPLY_TEXT_LIMIT} ký tự.`)
      return
    }
    if (hasDuplicate(text.toLocaleLowerCase('vi'))) {
      setActionError('Mẫu trả lời đã tồn tại. Vui lòng nhập nội dung khác.')
      return
    }

    updateGroup([...replies, { id: createQuickReplyId(activeGroup), text }])
    setNewText('')
  }

  const startEditing = (reply) => {
    setEditingId(reply.id)
    setEditingText(reply.text)
    setActionError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingText('')
  }

  const saveEditing = () => {
    const text = editingText.trim()
    if (!text) {
      setActionError('Nội dung mẫu trả lời không được để trống.')
      return
    }
    if (text.length > QUICK_REPLY_TEXT_LIMIT) {
      setActionError(`Nội dung không được vượt quá ${QUICK_REPLY_TEXT_LIMIT} ký tự.`)
      return
    }
    if (hasDuplicate(text.toLocaleLowerCase('vi'), editingId)) {
      setActionError('Mẫu trả lời đã tồn tại. Vui lòng nhập nội dung khác.')
      return
    }

    updateGroup(replies.map((reply) => (reply.id === editingId ? { ...reply, text } : reply)))
    cancelEditing()
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    updateGroup(replies.filter((reply) => reply.id !== deleteTarget.id))
    setDeleteTarget(null)
    if (editingId === deleteTarget.id) cancelEditing()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Nhóm mẫu trả lời nhanh">
        {quickReplyGroups.map((group) => {
          const selected = activeGroup === group.key
          const count = value?.[group.key]?.length || 0

          return (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cx(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-caption font-semibold transition-colors',
                selected
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-transparent bg-slate-100 text-ink-muted hover:bg-primary-subtle hover:text-primary'
              )}
              onClick={() => {
                setActiveGroup(group.key)
                setActionError('')
                cancelEditing()
              }}
            >
              {group.label}
              <span className="rounded-full bg-white px-1.5 text-[10px] text-ink-muted">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="new-quick-reply" className="text-small font-semibold text-ink-secondary">
          Thêm mẫu trả lời
        </label>
        <div className="flex items-end gap-2 max-sm:flex-col max-sm:items-stretch">
          <textarea
            id="new-quick-reply"
            rows={2}
            maxLength={QUICK_REPLY_TEXT_LIMIT}
            value={newText}
            onChange={(event) => {
              setNewText(event.target.value)
              setActionError('')
            }}
            placeholder="Nhập nội dung mẫu trả lời..."
            className="min-h-18 min-w-0 flex-1 resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-small leading-relaxed text-ink outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10 placeholder:text-ink-subtle"
          />
          <Button
            type="button"
            variant="secondary"
            className="h-10 border-[#c7d9ef] bg-[#eaf3fc] text-primary hover:bg-[#dcecfb] max-sm:w-full"
            onClick={addReply}
          >
            Lưu
          </Button>
        </div>
        <p className="text-caption leading-relaxed text-ink-muted">
          Tối đa {QUICK_REPLY_TEXT_LIMIT} ký tự.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="flex items-start gap-3 border-l-3 border-[#d7e6f4] bg-[#f8fbff] p-3 transition-colors hover:border-primary hover:bg-primary-soft/50"
          >
            {editingId === reply.id ? (
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <textarea
                  rows={2}
                  maxLength={QUICK_REPLY_TEXT_LIMIT}
                  value={editingText}
                  onChange={(event) => {
                    setEditingText(event.target.value)
                    setActionError('')
                  }}
                  className="min-h-18 w-full resize-y rounded-lg border border-primary bg-surface px-3 py-2 text-small leading-relaxed text-ink outline-none ring-3 ring-primary/10"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" size="sm" onClick={saveEditing}>
                    Lưu
                  </Button>
                  <Button type="button" size="sm" onClick={cancelEditing}>
                    Hủy
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-small leading-relaxed text-ink-secondary">
                  {reply.text}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    icon="edit"
                    label="Chỉnh sửa mẫu trả lời"
                    tone="edit"
                    onClick={() => startEditing(reply)}
                  />
                  <IconButton
                    icon="trash"
                    label="Xóa mẫu trả lời"
                    danger
                    onClick={() => setDeleteTarget(reply)}
                  />
                </div>
              </>
            )}
          </div>
        ))}
        {!replies.length && (
          <div className="px-4 py-6 text-center text-small text-ink-muted">
            Chưa có mẫu trả lời trong nhóm này.
          </div>
        )}
      </div>

      {(actionError || error) && (
        <p className="flex items-center gap-2 text-small text-danger-ink" role="alert">
          <Icon name="warning" size={16} />
          {actionError || error}
        </p>
      )}

      {deleteTarget && (
        <Dialog
          size="sm"
          title="Xác nhận"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button data-autofocus onClick={() => setDeleteTarget(null)}>
                Hủy
              </Button>
              <Button variant="danger-subtle" onClick={confirmDelete}>
                <Icon name="trash" size={16} />
                Xóa
              </Button>
            </>
          }
        >
          <p className="text-body leading-relaxed text-ink-secondary">
            Bạn có chắc muốn xóa mẫu trả lời này không?
          </p>
        </Dialog>
      )}
    </div>
  )
}

export default function Settings() {
  const { quickReplies, setQuickReplies } = useOutletContext()
  const [saved, setSaved] = useState(() => {
    try {
      return readSettings(window.localStorage)
    } catch {
      return { values: { ...DEFAULT_SETTINGS }, savedAt: null }
    }
  })
  const [draft, setDraft] = useState(() => ({ ...saved.values }))
  const [savedQuickReplies, setSavedQuickReplies] = useState(() => cloneQuickReplies(quickReplies))
  const [quickReplyDraft, setQuickReplyDraft] = useState(() => cloneQuickReplies(quickReplies))
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const formRef = useRef(null)
  const errors = validateSettings(draft)
  const quickReplyErrors = validateQuickReplies(quickReplyDraft)
  const changedCount = Object.keys(DEFAULT_SETTINGS).filter(
    (key) => String(draft[key]) !== String(saved.values[key])
  ).length
  const quickRepliesChanged = JSON.stringify(quickReplyDraft) !== JSON.stringify(savedQuickReplies)
  const dirty = changedCount > 0 || quickRepliesChanged
  const total = weightTotal(draft)
  const weightError =
    submitted || WEIGHT_FIELDS.some(({ key }) => touched[key]) ? errors.weights : null

  useEffect(() => {
    if (!dirty) return undefined

    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (!notice || notice.type === 'error') return undefined

    const timeout = window.setTimeout(() => setNotice(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setNotice(null)
  }

  const changeQuickReplies = (value) => {
    setQuickReplyDraft(value)
    setNotice(null)
  }

  const blur = (key) => setTouched((current) => ({ ...current, [key]: true }))

  const field = (name, label, hint, unit, extra = {}) => (
    <SettingField
      name={name}
      label={label}
      hint={hint}
      unit={unit}
      value={draft[name]}
      error={submitted || touched[name] ? errors[name] : null}
      onChange={change}
      onBlur={blur}
      {...extra}
    />
  )

  const saveChanges = () => {
    try {
      const next = saveSettings(window.localStorage, draft)
      const nextQuickReplies = saveQuickReplies(window.localStorage, quickReplyDraft)
      setSaved(next)
      setDraft({ ...next.values })
      setSavedQuickReplies(nextQuickReplies)
      setQuickReplyDraft(cloneQuickReplies(nextQuickReplies))
      setQuickReplies(nextQuickReplies)
      setTouched({})
      setSubmitted(false)
      setNotice({ type: 'success', text: 'Đã lưu cấu hình.' })
    } catch {
      setNotice({
        type: 'error',
        text: 'Không thể lưu cấu hình. Vui lòng kiểm tra quyền lưu trữ của trình duyệt và thử lại.',
      })
    }
  }

  const discardChanges = () => {
    setDraft({ ...saved.values })
    setQuickReplyDraft(cloneQuickReplies(savedQuickReplies))
    setTouched({})
    setSubmitted(false)
    setNotice({ type: 'info', text: 'Đã hủy các thay đổi chưa lưu.' })
  }

  const submit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    setNotice(null)

    if (Object.keys(errors).length || Object.keys(quickReplyErrors).length) {
      const invalid = [...formRef.current.elements].find((element) => errors[element.name])
      const target = invalid || formRef.current.elements.namedItem('wLocation')
      target?.focus()
      setNotice({
        type: 'error',
        text: 'Chưa thể lưu. Vui lòng kiểm tra các giá trị được đánh dấu bên dưới.',
      })
      return
    }

    setConfirmation('save')
  }

  const requestDiscard = () => {
    if (!dirty) return
    setConfirmation('discard')
  }

  const confirmAction = () => {
    const action = confirmation
    setConfirmation(null)

    if (action === 'save') saveChanges()
    if (action === 'discard') discardChanges()
  }

  return (
    <div className="mx-auto max-w-[1640px] px-8 pb-1 pt-7 max-[1200px]:px-[22px] max-sm:px-4 max-sm:py-5">
      <div className="flex flex-col gap-5">
        <SettingsNotice notice={notice} />

        <div className="mb-[2px] flex items-center justify-between gap-[18px] max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
          <div className="flex w-fit min-w-0 items-center gap-2.5 rounded-[7px] border border-[#d2dfeb] bg-[#f7fafd] px-3.5 py-[11px] text-caption text-[#71839a]">
            <Icon name="history" size={18} />
            <span>
              Cập nhật lần cuối
              <strong className="ml-1.5 inline text-small font-semibold text-[#465f7b]">
                {saved.savedAt
                  ? new Date(saved.savedAt).toLocaleString('vi-VN')
                  : 'Chưa có lần lưu'}
              </strong>
            </span>
          </div>
          <div className="flex shrink-0 gap-2.5 max-sm:[&>button]:flex-1">
            <Button
              className="h-auto min-h-[43px] px-[17px] text-small max-sm:px-2.5"
              disabled={!dirty}
              icon="reset"
              onClick={requestDiscard}
            >
              Hủy thay đổi
            </Button>
            <Button
              className="h-auto min-h-[43px] px-[17px] text-small max-sm:px-2.5"
              type="submit"
              form="admin-settings-form"
              variant="primary"
              disabled={!dirty && Boolean(saved.savedAt)}
              icon="check"
            >
              Lưu cấu hình
            </Button>
          </div>
        </div>

        <form id="admin-settings-form" ref={formRef} noValidate onSubmit={submit}>
          <div className="grid items-stretch gap-[22px] max-[600px]:gap-[17px] max-[760px]:grid-cols-1 min-[761px]:grid-cols-2">
            <SettingsCard
              id="settings-time"
              icon="history"
              title="Ngưỡng thời gian"
              description="Các mốc theo dõi tiến độ ghép nối."
              className="order-1"
            >
              {field(
                'staleDays',
                'Ngưỡng không hoạt động · STALE',
                'Nhập số ngày để đánh dấu ghép nối không có tương tác.',
                'ngày',
                { min: 1, max: 365 }
              )}
              <div className="grid gap-[18px] max-[600px]:grid-cols-1 max-[600px]:gap-0 min-[601px]:grid-cols-2">
                {field(
                  'contactHours',
                  'Nhắc liên hệ',
                  'Thời gian nhắc liên hệ được tính trước mốc STALE.',
                  'giờ',
                  { min: 1, max: 72 }
                )}
                {field(
                  'completionDays',
                  'Thời hạn hoàn tất',
                  'Tính từ khi hai bên bắt đầu giao dịch trao trả.',
                  'ngày',
                  { min: 1, max: 730 }
                )}
              </div>
            </SettingsCard>

            <SettingsCard
              id="settings-matching"
              icon="list"
              title="Kết quả matching"
              description="Giới hạn số kết quả được đề xuất."
              className="order-3"
            >
              {field(
                'topN',
                'Số kết quả đề xuất · Top-N',
                'Từ 1–100 kết quả, xếp theo điểm phù hợp giảm dần.',
                'kết quả',
                { min: 1, max: 100 }
              )}
            </SettingsCard>

            <SettingsCard
              id="settings-weights"
              icon="settings"
              title="Trọng số ghép nối"
              description="Phân bổ mức độ ưu tiên cho từng tiêu chí."
              className="order-2"
            >
              <div
                className={cx(
                  'flex flex-wrap items-center justify-between gap-3 text-[15px]',
                  weightError && 'text-danger-ink'
                )}
              >
                <span className="font-semibold">
                  <span className="block">Tổng trọng số</span>
                  <small className="mt-1 block text-small font-normal text-ink-muted">Σw = 1</small>
                </span>
                <strong
                  className={cx(
                    'whitespace-nowrap text-[26px] font-semibold text-[#277f6c]',
                    weightError && 'text-danger-ink'
                  )}
                >
                  {total.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                  <span className="text-[15px] font-normal text-ink-muted"> / 100%</span>
                </strong>
              </div>
              <WeightTrack values={draft} />
              <div className="flex flex-col">
                {WEIGHT_FIELDS.map((fieldConfig) => (
                  <WeightField
                    key={fieldConfig.key}
                    field={fieldConfig}
                    value={draft[fieldConfig.key]}
                    error={errors[fieldConfig.key]}
                    weightError={weightError}
                    submitted={submitted}
                    touched={touched}
                    onChange={change}
                    onBlur={blur}
                  />
                ))}
              </div>
              <p id="settings-weight-help" className="text-caption leading-relaxed text-ink-muted">
                Mỗi trọng số là số nguyên từ 0–100%. Tổng phải bằng 100% để lưu cấu hình.
              </p>
              {weightError && (
                <p
                  id="settings-weight-error"
                  className="text-caption text-danger-ink"
                  aria-live="polite"
                >
                  {weightError}
                </p>
              )}
            </SettingsCard>

            <SettingsCard
              id="settings-reports"
              icon="flag"
              title="Ngưỡng xử lý report"
              description="Thời hạn theo dõi các báo cáo vi phạm."
              tone="amber"
              className="order-4"
            >
              {field(
                'reportDays',
                'Thời hạn xử lý report',
                'Tính từ khi tiếp nhận báo cáo chưa được xử lý.',
                '',
                { options: [3, 5, 7] }
              )}
              <div className="mb-[23px] flex items-start gap-[13px] rounded-lg border border-[#e4d5b8] bg-[#fffbf3] px-[17px] py-[21px] text-body leading-[1.8] text-[#806d4c]">
                <span className="grid size-[38px] shrink-0 place-items-center rounded-lg bg-[#f8edda] text-[#a67a2d]">
                  <Icon name="flag" size={18} />
                </span>
                <div>
                  <strong className="mt-0.5 mb-2 block text-[15px] font-semibold text-[#806029]">
                    Theo dõi báo cáo quá hạn
                  </strong>
                  <p>
                    Báo cáo chưa xử lý sau <b>{draft.reportDays} ngày</b> được đánh dấu quá hạn để
                    ưu tiên rà soát.
                  </p>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              id="settings-quick-replies"
              icon="reply"
              title="Mẫu trả lời nhanh"
              description="Quản lý các nội dung được sử dụng khi trả lời hội thoại."
              className="order-5 min-[761px]:col-span-2"
            >
              <QuickReplyManager
                value={quickReplyDraft}
                onChange={changeQuickReplies}
                error={Object.keys(quickReplyErrors).length ? 'Có mẫu trả lời chưa hợp lệ.' : null}
              />
            </SettingsCard>
          </div>
        </form>

        {confirmation && (
          <Dialog
            size="sm"
            title="Xác nhận"
            onClose={() => setConfirmation(null)}
            footer={
              <>
                <Button data-autofocus onClick={() => setConfirmation(null)}>
                  Quay lại
                </Button>
                <Button
                  variant={confirmation === 'save' ? 'primary' : 'danger-subtle'}
                  onClick={confirmAction}
                >
                  <Icon name={confirmation === 'save' ? 'check' : 'reset'} size={16} />
                  {confirmation === 'save' ? 'Lưu' : 'Hủy'}
                </Button>
              </>
            }
          >
            <p className="text-body leading-relaxed text-ink-secondary">
              {confirmation === 'save'
                ? 'Bạn có chắc muốn lưu các thay đổi cấu hình này không?'
                : 'Các thay đổi chưa lưu sẽ bị mất. Bạn có chắc muốn hủy không?'}
            </p>
          </Dialog>
        )}
      </div>
    </div>
  )
}
