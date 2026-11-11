import { Fragment, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../../components/backoffice/Button'
import { cx } from '../../components/backoffice/classes'
import Dialog from '../../components/backoffice/Dialog'
import IconButton from '../../components/backoffice/IconButton'
import Icon from '../../components/common/Icon'
import { formatNumber, formatPercent } from '../../lib/admin/matching'
import {
  ADVANCED_FIELDS,
  DEFAULT_SETTINGS,
  RELIABILITY_FIELDS,
  readSettings,
  saveSettings,
  thresholdBits,
  validateSettings,
} from '../../lib/admin/settings'
import {
  cloneQuickReplies,
  QUICK_REPLY_TEXT_LIMIT,
  saveQuickReplies,
  validateQuickReplies,
} from '../../lib/backoffice/quickReplies'

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

const MATCHING_SETTING_KEYS = [
  ...RELIABILITY_FIELDS.map(({ key }) => key),
  'strongThreshold',
  'weakThreshold',
  'priorOdds',
  'timeTolerance',
  'sMin',
]
const TIME_THRESHOLD_SETTING_KEYS = ['reportDays', 'contactHours', 'returnReminderDays']
const PAGINATION_SETTING_KEYS = ['paginationPageSize']
const SETTINGS_TABS = [
  { key: 'matching', label: 'Ghép cặp' },
  { key: 'timeThresholds', label: 'Thời hạn' },
  { key: 'quickReplies', label: 'Mẫu trả lời nhanh' },
  { key: 'pagination', label: 'Phân trang' },
]
const SETTINGS_KEYS_BY_TAB = {
  matching: MATCHING_SETTING_KEYS,
  timeThresholds: TIME_THRESHOLD_SETTING_KEYS,
  pagination: PAGINATION_SETTING_KEYS,
}

const pickSettings = (values, keys) => Object.fromEntries(keys.map((key) => [key, values[key]]))

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
  errorTextClassName = 'text-danger-ink',
  onChange,
  onBlur,
  options,
  min,
  max,
  step = 1,
}) {
  const id = `setting-${name}`
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <div className="mb-5 flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold text-ink-secondary">
        {label}
      </label>
      <div
        className={cx(
          'flex h-9 items-center overflow-hidden rounded-lg border border-line-strong bg-surface transition focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/20',
          error &&
            'border-danger bg-danger-soft focus-within:border-danger focus-within:ring-danger/20'
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
            aria-describedby={describedBy || undefined}
            required
            className="h-full w-full min-w-0 cursor-pointer border-0 bg-transparent px-3 text-small font-semibold text-ink outline-none"
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
              inputMode={step === 1 ? 'numeric' : 'decimal'}
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(event) => onChange(name, event.target.value)}
              onBlur={() => onBlur(name)}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy || undefined}
              required
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-small font-semibold text-ink outline-none"
            />
            {unit && (
              <span
                className="shrink-0 border-l border-line px-3 text-small text-ink-muted"
                aria-hidden="true"
              >
                {unit}
              </span>
            )}
          </>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-small leading-[1.65] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className={cx('text-small leading-relaxed', errorTextClassName)}
          role="alert"
        >
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
  const [activeTab, setActiveTab] = useState('matching')
  const [submittedTabs, setSubmittedTabs] = useState({})
  const [notice, setNotice] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const formRef = useRef(null)
  const errors = validateSettings(draft)
  const quickReplyErrors = validateQuickReplies(quickReplyDraft)
  const settingsChanged = Object.keys(DEFAULT_SETTINGS).some(
    (key) => String(draft[key]) !== String(saved.values[key])
  )
  const quickRepliesChanged = JSON.stringify(quickReplyDraft) !== JSON.stringify(savedQuickReplies)
  const dirty = settingsChanged || quickRepliesChanged
  const activeSettingsKeys = SETTINGS_KEYS_BY_TAB[activeTab] || []
  const activeSectionDirty =
    activeTab === 'quickReplies'
      ? quickRepliesChanged
      : activeSettingsKeys.some((key) => String(draft[key]) !== String(saved.values[key]))
  const activeSectionErrors =
    activeTab === 'quickReplies'
      ? quickReplyErrors
      : Object.fromEntries(
          activeSettingsKeys.filter((key) => errors[key]).map((key) => [key, errors[key]])
        )
  const saveDisabled =
    activeTab === 'quickReplies'
      ? !quickRepliesChanged
      : !activeSectionDirty && Boolean(saved.savedAt)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const priorOdds = Number(draft.priorOdds)
  const bitsHint = (key) =>
    errors[key] || errors.priorOdds
      ? ''
      : `Tương ứng W ≈ ${formatNumber(thresholdBits(Number(draft[key]), priorOdds), 1)} bit`
  const priorHint = () =>
    errors.priorOdds ? '' : `p₀ = 1/${formatNumber(priorOdds)} ≈ ${formatPercent(1 / priorOdds)}`

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
      value={draft[name] ?? DEFAULT_SETTINGS[name] ?? ''}
      error={submittedTabs[activeTab] || touched[name] ? errors[name] : null}
      onChange={change}
      onBlur={blur}
      {...extra}
    />
  )

  const saveTab = (tab) => {
    try {
      const keys = SETTINGS_KEYS_BY_TAB[tab] || []
      if (tab === 'quickReplies') {
        const next = saveQuickReplies(window.localStorage, quickReplyDraft)
        setSavedQuickReplies(next)
        setQuickReplyDraft(cloneQuickReplies(next))
        setQuickReplies(next)
      } else {
        const next = saveSettings(window.localStorage, {
          ...saved.values,
          ...pickSettings(draft, keys),
        })
        setSaved(next)
        setDraft((current) => ({ ...current, ...pickSettings(next.values, keys) }))
      }
      setTouched((current) => {
        const next = { ...current }
        keys.forEach((key) => delete next[key])
        return next
      })
      setSubmittedTabs((current) => ({ ...current, [tab]: false }))
      setNotice({ type: 'success', text: 'Đã lưu cấu hình.' })
    } catch {
      setNotice({
        type: 'error',
        text: 'Không thể lưu thay đổi. Vui lòng kiểm tra quyền lưu trữ của trình duyệt và thử lại.',
      })
    }
  }

  const discardTab = (tab) => {
    const keys = SETTINGS_KEYS_BY_TAB[tab] || []
    if (tab === 'quickReplies') {
      setQuickReplyDraft(cloneQuickReplies(savedQuickReplies))
    } else {
      setDraft((current) => ({ ...current, ...pickSettings(saved.values, keys) }))
    }
    setTouched((current) => {
      const next = { ...current }
      keys.forEach((key) => delete next[key])
      return next
    })
    setSubmittedTabs((current) => ({ ...current, [tab]: false }))
    setNotice({ type: 'info', text: 'Đã hủy thay đổi trong tab này.' })
  }

  const submit = (event) => {
    event.preventDefault()
    setSubmittedTabs((current) => ({ ...current, [activeTab]: true }))
    setNotice(null)

    if (Object.keys(activeSectionErrors).length) {
      if (activeTab === 'matching' && ADVANCED_FIELDS.some((key) => activeSectionErrors[key])) {
        setAdvancedOpen(true)
      }
      if (activeTab !== 'quickReplies') {
        const elements = formRef.current?.elements
        const invalid = [...(elements || [])].find((element) => activeSectionErrors[element.name])
        const fallbackName =
          activeTab === 'matching'
            ? 'mCategory'
            : activeTab === 'timeThresholds'
              ? 'reportDays'
              : 'paginationPageSize'
        const target = invalid || elements?.namedItem(fallbackName)
        // Đợi mục Nâng cao mở ra thì ô bên trong mới nhận focus được
        requestAnimationFrame(() => target?.focus())
      }
      setNotice({
        type: 'error',
        text:
          activeTab === 'quickReplies'
            ? 'Chưa thể lưu. Vui lòng kiểm tra mẫu trả lời được đánh dấu bên dưới.'
            : 'Chưa thể lưu. Vui lòng kiểm tra các giá trị được đánh dấu bên dưới.',
      })
      return
    }

    setConfirmation({ action: 'save', tab: activeTab })
  }

  const requestDiscard = () => {
    if (!activeSectionDirty) return
    setConfirmation({ action: 'discard', tab: activeTab })
  }

  const confirmAction = () => {
    const { action, tab } = confirmation
    setConfirmation(null)

    if (action === 'save') saveTab(tab)
    if (action === 'discard') discardTab(tab)
  }

  return (
    <div className="mx-auto max-w-[1640px] px-8 pb-1 pt-7 max-[1200px]:px-[22px] max-sm:px-4 max-sm:py-5">
      <div className="flex flex-col gap-5">
        <SettingsNotice notice={notice} />

        <div className="mb-[2px] flex items-center gap-[18px] max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
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
        </div>

        <form id="admin-settings-form" ref={formRef} noValidate onSubmit={submit}>
          <div
            className="mb-5 flex gap-1 overflow-x-auto border-b border-line"
            role="tablist"
            aria-label="Nhóm cấu hình hệ thống"
          >
            {SETTINGS_TABS.map((tab) => {
              const selected = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  id={`settings-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="settings-tab-panel"
                  className={cx(
                    'min-h-[45px] shrink-0 border-b-2 px-4 text-small font-semibold transition-colors',
                    selected
                      ? 'border-primary text-primary'
                      : 'border-transparent text-ink-muted hover:text-primary'
                  )}
                  onClick={() => {
                    setActiveTab(tab.key)
                    setNotice(null)
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div
            id="settings-tab-panel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeTab}`}
            tabIndex={0}
            className="flex flex-col gap-4"
          >
            {activeTab === 'matching' && (
              <SettingsCard
                id="settings-match-params"
                icon="settings"
                title="Ghép cặp"
                description="Độ tin cậy và ngưỡng gợi ý dùng chung cho mọi danh mục."
              >
                <h3 className="mb-3 text-body font-semibold text-ink">Độ tin cậy (m)</h3>
                <div className="grid gap-x-[18px] min-[601px]:grid-cols-2">
                  {RELIABILITY_FIELDS.map(({ key, label }) => (
                    <Fragment key={key}>
                      {field(key, label, '', '', { min: 0.01, max: 0.99, step: 0.01 })}
                    </Fragment>
                  ))}
                </div>

                <h3 className="mt-5 mb-3 border-t border-primary-muted pt-5 text-body font-semibold text-ink">
                  Ngưỡng gợi ý
                </h3>
                <div className="grid gap-x-[18px] min-[601px]:grid-cols-2">
                  {field('strongThreshold', 'Gợi ý mạnh', bitsHint('strongThreshold'), '%', {
                    min: 1,
                    max: 99,
                  })}
                  {field('weakThreshold', 'Gợi ý yếu', bitsHint('weakThreshold'), '%', {
                    min: 1,
                    max: 99,
                  })}
                </div>

                <details
                  open={advancedOpen}
                  onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                  className="rounded-lg border border-line bg-surface-muted"
                >
                  <summary className="cursor-pointer rounded-lg px-4 py-3 text-small font-semibold text-primary outline-none hover:bg-primary-subtle focus-visible:ring-2 focus-visible:ring-focus/30">
                    Nâng cao
                  </summary>
                  <div className="border-t border-line px-4 pt-4">
                    {field('priorOdds', 'Xác suất tiên nghiệm p₀ = 1 / N', priorHint(), 'N', {
                      min: 2,
                      max: 100000,
                    })}
                    <div className="grid gap-x-[18px] min-[601px]:grid-cols-2">
                      {field('timeTolerance', 'Dung sai thời gian ε', '', 'ngày', {
                        min: 0,
                        max: 30,
                      })}
                      {field('sMin', 'Điểm tối thiểu Sₘᵢₙ', '', '', {
                        min: 0.01,
                        max: 0.5,
                        step: 0.01,
                      })}
                    </div>
                  </div>
                </details>
              </SettingsCard>
            )}

            {activeTab === 'timeThresholds' && (
              <SettingsCard
                id="settings-time-thresholds"
                icon="flag"
                title="Thời hạn"
                description="Thiết lập thời hạn xử lý báo cáo và lịch gửi email nhắc cho các hội thoại đang mở."
              >
                {field(
                  'reportDays',
                  'Thời hạn xử lý báo cáo',
                  'Tính từ khi tiếp nhận báo cáo chưa được xử lý.',
                  'ngày',
                  { min: 1, max: 365, step: 1 }
                )}
                <div className="grid gap-x-[18px] border-t border-primary-muted pt-5 min-[601px]:grid-cols-2">
                  {field(
                    'contactHours',
                    'Thời gian không hoạt động trước khi gửi email nhắc',
                    'Tính từ lần hoạt động gần nhất.',
                    'giờ',
                    { min: 1, max: 72, step: 1 }
                  )}
                  {field(
                    'returnReminderDays',
                    'Nhắc nếu hội thoại vẫn mở sau',
                    'Chỉ nhắc khi hội thoại chưa được đánh dấu “Đã trao trả” hoặc “Đã đóng”.',
                    'ngày',
                    { min: 1, step: 1 }
                  )}
                </div>
              </SettingsCard>
            )}

            {activeTab === 'quickReplies' && (
              <SettingsCard
                id="settings-quick-replies"
                icon="reply"
                title="Mẫu trả lời nhanh"
                description="Quản lý các nội dung được sử dụng khi trả lời hội thoại."
              >
                <QuickReplyManager
                  value={quickReplyDraft}
                  onChange={changeQuickReplies}
                  error={
                    Object.keys(quickReplyErrors).length ? 'Có mẫu trả lời chưa hợp lệ.' : null
                  }
                />
              </SettingsCard>
            )}

            {activeTab === 'pagination' && (
              <SettingsCard
                id="settings-pagination"
                icon="list"
                title="Phân trang"
                description="Số mục hiển thị trên mỗi trang trong các danh sách admin và moderator."
              >
                {field('paginationPageSize', 'Số mục trên mỗi trang', '', 'mục', {
                  min: 1,
                  max: 100,
                  step: 1,
                })}
              </SettingsCard>
            )}

            <div className="flex justify-end gap-2.5 max-sm:[&>button]:flex-1">
              <Button
                type="button"
                className="h-auto min-h-[43px] px-[17px] text-small max-sm:px-2.5"
                disabled={!activeSectionDirty}
                icon="reset"
                onClick={requestDiscard}
              >
                Hủy thay đổi
              </Button>
              <Button
                className="h-auto min-h-[43px] px-[17px] text-small max-sm:px-2.5"
                type="submit"
                variant="primary"
                disabled={saveDisabled}
                icon="check"
              >
                Lưu cấu hình
              </Button>
            </div>
          </div>
        </form>

        {confirmation && (
          <Dialog
            size="sm"
            title="Xác nhận"
            onClose={() => setConfirmation(null)}
            footer={
              <>
                <Button data-autofocus type="button" onClick={() => setConfirmation(null)}>
                  Quay lại
                </Button>
                <Button
                  variant={confirmation.action === 'save' ? 'primary' : 'danger-subtle'}
                  type="button"
                  onClick={confirmAction}
                >
                  <Icon name={confirmation.action === 'save' ? 'check' : 'reset'} size={16} />
                  {confirmation.action === 'save' ? 'Lưu' : 'Hủy'}
                </Button>
              </>
            }
          >
            <p className="text-body leading-relaxed text-ink-secondary">
              {confirmation.action === 'save'
                ? `Bạn có chắc muốn lưu thay đổi trong tab “${SETTINGS_TABS.find((tab) => tab.key === confirmation.tab)?.label}” không?`
                : `Các thay đổi chưa lưu trong tab “${SETTINGS_TABS.find((tab) => tab.key === confirmation.tab)?.label}” sẽ bị mất. Bạn có chắc muốn hủy không?`}
            </p>
          </Dialog>
        )}
      </div>
    </div>
  )
}
