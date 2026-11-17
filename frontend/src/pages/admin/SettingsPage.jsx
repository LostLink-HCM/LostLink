import { Fragment, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { saveSystemSettings } from '../../api/systemSettings'
import useSystemSettings from '../../hooks/useSystemSettings'
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
  SETTINGS_KEYS_BY_TAB,
  thresholdBits,
  validateSettings,
} from '../../lib/admin/settings'
import {
  cloneQuickReplies,
  QUICK_REPLY_TEXT_LIMIT,
  validateQuickReplies,
} from '../../lib/backoffice/quickReplies'

const cardTones = {
  blue: {
    tint: 'bg-[#edf3fa]',
    icon: 'border border-[#d5e0ec] bg-white text-[#3976bd]',
  },
  amber: {
    tint: 'bg-[#fcf6e9]',
    icon: 'border border-[#e4d5b8] bg-white text-[#a67a2d]',
  },
}

const SETTINGS_TABS = [
  { key: 'matching', label: 'Ghép cặp' },
  { key: 'timeThresholds', label: 'Thời hạn' },
  { key: 'quickReplies', label: 'Mẫu trả lời nhanh' },
  { key: 'pagination', label: 'Phân trang' },
]
const pickSettings = (values, keys) => Object.fromEntries(keys.map((key) => [key, values[key]]))
const EMPTY_REPLY_EDITOR = { activeGroup: 'user', newText: '', editingId: null, editingText: '' }
const UNSAVED_HIGHLIGHT_MS = 3000

function SettingsCard({ id, icon, title, description, children, tone = 'blue', className }) {
  const colors = cardTones[tone]

  return (
    <section
      className={cx(
        'min-w-0 overflow-hidden rounded-[10px] border border-[#8fa7c2] bg-white shadow-[0_4px_14px_#16233a12]',
        className
      )}
      aria-labelledby={id}
    >
      <header
        className={cx(
          'flex items-center gap-3 border-b border-[#c4d2e2] px-6 py-5 max-sm:gap-2.5 max-sm:px-[17px] max-sm:py-[17px]',
          colors.tint
        )}
      >
        <span
          className={cx('grid size-[43px] shrink-0 place-items-center rounded-[9px]', colors.icon)}
        >
          <Icon name={icon} size={21} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="mb-1 text-title font-[650] text-[#24476b] max-sm:text-lead">
            {title}
          </h2>
          <p className="text-body leading-relaxed text-[#526a83]">{description}</p>
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
  highlighted = false,
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
          'flex h-9 items-center overflow-hidden rounded-lg border transition focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/20',
          error
            ? 'border-danger bg-danger-soft focus-within:border-danger focus-within:ring-danger/20'
            : highlighted
              ? 'border-amber-400 bg-amber-50'
              : 'border-line-strong bg-surface'
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

function QuickReplyManager({
  value,
  savedValue,
  onChange,
  error,
  editor,
  setEditor,
  highlightChanges,
}) {
  const { activeGroup, newText, editingId, editingText } = editor
  const changeEditor = (key, next) => setEditor((current) => ({ ...current, [key]: next }))
  const setActiveGroup = (next) => changeEditor('activeGroup', next)
  const setNewText = (next) => changeEditor('newText', next)
  const setEditingId = (next) => changeEditor('editingId', next)
  const setEditingText = (next) => changeEditor('editingText', next)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionError, setActionError] = useState('')
  const replies = value?.[activeGroup] || []
  const savedReplies = savedValue[activeGroup] || []
  const deletedReplies = savedReplies.filter(
    (reply) => !replies.some((item) => item.id === reply.id)
  )
  const changedReply = (reply) => {
    const original = savedReplies.find((item) => item.id === reply.id)
    return (
      !original ||
      original.text !== reply.text ||
      (editingId === reply.id && editingText !== reply.text)
    )
  }
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
            className={cx(
              'min-h-18 min-w-0 flex-1 resize-y rounded-lg border px-3 py-2 text-small leading-relaxed text-ink outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10 placeholder:text-ink-subtle',
              highlightChanges && newText
                ? 'border-amber-400 bg-amber-50'
                : 'border-line-strong bg-surface'
            )}
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

      <div
        className={cx(
          'flex flex-col divide-y divide-line rounded-lg border',
          highlightChanges && deletedReplies.length ? 'border-amber-400 bg-amber-50' : 'border-line'
        )}
      >
        {replies.map((reply) => (
          <div
            key={reply.id}
            className={cx(
              'flex items-start gap-3 border-l-3 p-3 transition-colors',
              highlightChanges && changedReply(reply)
                ? 'border-amber-400 bg-amber-50'
                : 'border-[#d7e6f4] bg-[#f8fbff] hover:border-primary hover:bg-primary-soft/50'
            )}
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
                  className={cx(
                    'min-h-18 w-full resize-y rounded-lg border px-3 py-2 text-small leading-relaxed text-ink outline-none ring-3 ring-primary/10',
                    highlightChanges && changedReply(reply)
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-primary bg-surface'
                  )}
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

function SettingsEditor({ initialSettings, onSaved, registerNavigationGuard, readOnly = false }) {
  const [saved, setSaved] = useState(initialSettings)
  const [draft, setDraft] = useState(() => ({ ...saved.values }))
  const [savedQuickReplies, setSavedQuickReplies] = useState(() =>
    cloneQuickReplies(saved.quickReplies)
  )
  const [quickReplyDraft, setQuickReplyDraft] = useState(() =>
    cloneQuickReplies(saved.quickReplies)
  )
  const [touched, setTouched] = useState({})
  const [activeTab, setActiveTab] = useState('matching')
  const [submittedTabs, setSubmittedTabs] = useState({})
  const [notice, setNotice] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [replyEditor, setReplyEditor] = useState(EMPTY_REPLY_EDITOR)
  const [highlightedChanges, setHighlightedChanges] = useState(null)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const saveInFlight = useRef(false)
  const formRef = useRef(null)
  const errors = { ...validateSettings(draft), ...serverErrors }
  const quickReplyErrors = validateQuickReplies(quickReplyDraft)
  const changedSettings = Object.keys(DEFAULT_SETTINGS).filter(
    (key) => String(draft[key]) !== String(saved.values[key])
  )
  const settingsChanged = changedSettings.length > 0
  const quickRepliesChanged = JSON.stringify(quickReplyDraft) !== JSON.stringify(savedQuickReplies)
  const editedReply = quickReplyDraft[replyEditor.activeGroup].find(
    (reply) => reply.id === replyEditor.editingId
  )
  const replyEditorDirty =
    Boolean(replyEditor.newText) ||
    Boolean(editedReply && replyEditor.editingText !== editedReply.text)
  const dirty = settingsChanged || quickRepliesChanged || replyEditorDirty
  const activeSettingsKeys = SETTINGS_KEYS_BY_TAB[activeTab] || []
  const activeSectionDirty =
    activeTab === 'quickReplies'
      ? quickRepliesChanged || replyEditorDirty
      : activeSettingsKeys.some((key) => String(draft[key]) !== String(saved.values[key]))
  const activeSectionErrors =
    activeTab === 'quickReplies'
      ? quickReplyErrors
      : Object.fromEntries(
          activeSettingsKeys.filter((key) => errors[key]).map((key) => [key, errors[key]])
        )
  const saveDisabled =
    saving || (activeTab === 'quickReplies' ? !quickRepliesChanged : !activeSectionDirty)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const priorOdds = Number(draft.priorOdds)
  const bitsHint = (key) =>
    errors[key] || errors.priorOdds
      ? ''
      : `Tương ứng W ≈ ${formatNumber(thresholdBits(Number(draft[key]), priorOdds), 1)} bit`
  const priorHint = () =>
    errors.priorOdds ? '' : `p₀ = 1/${formatNumber(priorOdds)} ≈ ${formatPercent(1 / priorOdds)}`

  useEffect(() => {
    if (!registerNavigationGuard) return undefined
    const guard = (proceed) => {
      if (saveInFlight.current) {
        setNotice({
          type: 'info',
          text: 'Cấu hình đang được lưu. Vui lòng chờ lưu xong trước khi chuyển trang.',
        })
        return false
      }
      if (!dirty) return true
      setPendingNavigation({ kind: 'page', proceed })
      return false
    }
    return registerNavigationGuard(guard)
  }, [dirty, registerNavigationGuard])

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

  useEffect(() => {
    if (!highlightedChanges) return undefined
    const timeout = window.setTimeout(() => setHighlightedChanges(null), UNSAVED_HIGHLIGHT_MS)
    return () => window.clearTimeout(timeout)
  }, [highlightedChanges])

  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setServerErrors({})
    setNotice(null)
  }

  const changeQuickReplies = (value) => {
    setQuickReplyDraft(value)
    setServerErrors({})
    setNotice(null)
  }

  const blur = (key) => {
    setTouched((current) => ({ ...current, [key]: true }))
    setDraft((current) => {
      const value = current[key]
      if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Number(value))) {
        return current
      }
      const normalized = String(Number(value))
      return value === normalized ? current : { ...current, [key]: normalized }
    })
  }

  const field = (name, label, hint, unit, extra = {}) => (
    <SettingField
      name={name}
      label={label}
      hint={hint}
      unit={unit}
      value={draft[name] ?? DEFAULT_SETTINGS[name] ?? ''}
      highlighted={Boolean(highlightedChanges) && changedSettings.includes(name)}
      error={submittedTabs[activeTab] || touched[name] ? errors[name] : null}
      onChange={change}
      onBlur={blur}
      {...extra}
    />
  )

  const saveTab = async (tab) => {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setServerErrors({})
    setNotice(null)
    try {
      const keys = SETTINGS_KEYS_BY_TAB[tab] || []
      const next = await saveSystemSettings(tab, tab === 'quickReplies' ? quickReplyDraft : draft)
      const nextReplies = cloneQuickReplies(next.quickReplies)
      setSaved(next)
      setSavedQuickReplies(nextReplies)
      // Cập nhật bản đã lưu, giữ những ô đang sửa dở ở các tab khác.
      setDraft((current) =>
        Object.fromEntries(
          Object.keys(next.values).map((key) => [
            key,
            keys.includes(key) || String(current[key]) === String(saved.values[key])
              ? next.values[key]
              : current[key],
          ])
        )
      )
      if (tab === 'quickReplies') {
        setQuickReplyDraft(cloneQuickReplies(nextReplies))
      } else if (!quickRepliesChanged) {
        setQuickReplyDraft(cloneQuickReplies(nextReplies))
      }
      onSaved(next)
      setTouched((current) => {
        const next = { ...current }
        keys.forEach((key) => delete next[key])
        return next
      })
      setSubmittedTabs((current) => ({ ...current, [tab]: false }))
      setNotice({ type: 'success', text: 'Đã lưu cấu hình.' })
    } catch (error) {
      setServerErrors(error.fieldErrors || {})
      if (tab === 'matching' && ADVANCED_FIELDS.some((key) => error.fieldErrors?.[key])) {
        setAdvancedOpen(true)
      }
      setNotice({
        type: 'error',
        text: error.message || 'Không thể lưu cấu hình. Vui lòng thử lại.',
      })
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  const discardTab = (tab) => {
    setServerErrors({})
    setHighlightedChanges(null)
    const keys = SETTINGS_KEYS_BY_TAB[tab] || []
    if (tab === 'quickReplies') {
      setQuickReplyDraft(cloneQuickReplies(savedQuickReplies))
      setReplyEditor((current) => ({ ...EMPTY_REPLY_EDITOR, activeGroup: current.activeGroup }))
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
    if (readOnly || saveInFlight.current) return
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
    if (saveInFlight.current) return
    const { action, tab } = confirmation
    setConfirmation(null)

    if (action === 'save') void saveTab(tab)
    if (action === 'discard') discardTab(tab)
  }

  const changeTab = (tab) => {
    if (tab === activeTab || saveInFlight.current) return
    if (activeSectionDirty) {
      setPendingNavigation({ kind: 'tab', tab })
      return
    }
    setActiveTab(tab)
    setNotice(null)
  }

  const continueNavigation = () => {
    if (!pendingNavigation || saveInFlight.current) return
    const target = pendingNavigation
    setPendingNavigation(null)
    if (target.kind === 'page') target.proceed()
    else {
      discardTab(activeTab)
      setActiveTab(target.tab)
      setNotice(null)
    }
  }

  const stayOnPage = () => {
    setPendingNavigation(null)
    if (activeTab === 'matching' && ADVANCED_FIELDS.some((key) => changedSettings.includes(key))) {
      setAdvancedOpen(true)
    }
    setHighlightedChanges({})
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
                {saved.updatedAt
                  ? new Date(saved.updatedAt).toLocaleString('vi-VN')
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
                  onClick={() => changeTab(tab.key)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <fieldset
            disabled={saving || readOnly}
            className="m-0 min-w-0 border-0 p-0"
            aria-busy={saving}
          >
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
                      { min: 1, max: 365, step: 1 }
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
                    savedValue={savedQuickReplies}
                    highlightChanges={Boolean(highlightedChanges)}
                    onChange={changeQuickReplies}
                    editor={replyEditor}
                    setEditor={setReplyEditor}
                    error={
                      Object.keys(quickReplyErrors).length
                        ? 'Có mẫu trả lời chưa hợp lệ.'
                        : Object.entries(serverErrors)
                            .filter(([key]) => key.startsWith('user') || key.startsWith('internal'))
                            .map(([, message]) => message)
                            .join(' ') || null
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
                  {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
                </Button>
              </div>
            </div>
          </fieldset>
        </form>

        {pendingNavigation && (
          <Dialog
            size="sm"
            title="Có thay đổi chưa lưu"
            onClose={() => setPendingNavigation(null)}
            footer={
              <>
                <Button data-autofocus onClick={stayOnPage}>
                  Ở lại
                </Button>
                <Button variant="primary" onClick={continueNavigation}>
                  {pendingNavigation.kind === 'page' ? 'Rời trang' : 'Chuyển tab'}
                </Button>
              </>
            }
          >
            <p className="text-body leading-relaxed text-ink-secondary">
              {pendingNavigation.kind === 'page'
                ? 'Bạn có thay đổi chưa lưu. Rời trang sẽ bỏ các thay đổi này. Bạn có muốn tiếp tục không?'
                : 'Bạn có thay đổi chưa lưu. Chuyển tab sẽ bỏ các thay đổi trong tab hiện tại. Bạn có muốn tiếp tục không?'}
            </p>
          </Dialog>
        )}

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

export default function Settings() {
  const { applySystemSettings: applySharedSettings, registerSettingsNavigationGuard } =
    useOutletContext()
  const {
    systemSettings,
    settingsLoading,
    settingsError,
    settingsInitialized,
    reloadSystemSettings,
    applySystemSettings,
    initializeSettings,
  } = useSystemSettings({ scope: 'full', onLoaded: applySharedSettings })
  const [initializing, setInitializing] = useState(false)
  const [initializationError, setInitializationError] = useState('')
  const initializationInFlight = useRef(false)

  const saved = (data) => {
    applySystemSettings(data)
    applySharedSettings(data)
  }
  const initialize = async () => {
    if (initializationInFlight.current) return
    initializationInFlight.current = true
    setInitializing(true)
    setInitializationError('')
    try {
      await initializeSettings()
    } catch (error) {
      const details = Object.values(error.fieldErrors || {}).join(' ')
      setInitializationError(
        [error.message, details].filter(Boolean).join(' ') ||
          'Không thể khởi tạo cấu hình hệ thống. Vui lòng thử lại.'
      )
    } finally {
      initializationInFlight.current = false
      setInitializing(false)
    }
  }
  return (
    <>
      {settingsError && (
        <div
          role="alert"
          className="mx-6 mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-danger-soft bg-danger-soft p-4 text-small text-danger-ink max-sm:mx-4"
        >
          <p className="min-w-0 flex-1">Không tải được cấu hình hệ thống. {settingsError}</p>
          <Button onClick={reloadSystemSettings}>Thử lại</Button>
        </div>
      )}
      {systemSettings ? (
        <>
          {!settingsInitialized && (
            <div
              role="status"
              className="mx-6 mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-primary-soft bg-primary-subtle p-4 text-small text-primary max-sm:mx-4"
            >
              <Icon name="info" size={18} />
              <p className="min-w-0 flex-1">
                Cấu hình hệ thống chưa được khởi tạo đầy đủ. Các mục còn thiếu đang hiển thị giá trị
                mặc định; bạn có thể xem cấu hình và cần khởi tạo trước khi chỉnh sửa.
              </p>
              {initializationError && (
                <p role="alert" className="basis-full text-danger-ink">
                  {initializationError}
                </p>
              )}
              <Button type="button" variant="primary" disabled={initializing} onClick={initialize}>
                {initializing ? 'Đang khởi tạo…' : 'Khởi tạo cấu hình mặc định'}
              </Button>
            </div>
          )}
          <SettingsEditor
            key={settingsInitialized ? 'initialized' : 'uninitialized'}
            initialSettings={systemSettings}
            onSaved={saved}
            registerNavigationGuard={registerSettingsNavigationGuard}
            readOnly={!settingsInitialized}
          />
        </>
      ) : settingsLoading ? (
        <p role="status" className="px-8 py-7 text-small text-ink-muted max-sm:px-4">
          Đang tải cấu hình hệ thống…
        </p>
      ) : null}
    </>
  )
}
