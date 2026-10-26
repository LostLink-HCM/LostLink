import { DEFAULT_QUICK_REPLIES } from '../../data/backofficeQuickReplies'

export const QUICK_REPLIES_STORAGE_KEY = 'll_backoffice_quick_replies_v1'
export const QUICK_REPLY_TEXT_LIMIT = 500

const QUICK_REPLY_GROUPS = ['user', 'internal']

function createFallbackId(group, index) {
  return `${group}-${index + 1}`
}

function normalizeGroup(items, group) {
  if (!Array.isArray(items)) return []

  return items.reduce((result, item, index) => {
    const text = typeof item === 'string' ? item : item?.text
    if (typeof text !== 'string') return result

    result.push({
      id: typeof item === 'object' && item?.id ? String(item.id) : createFallbackId(group, index),
      text,
    })
    return result
  }, [])
}

export function cloneQuickReplies(value = DEFAULT_QUICK_REPLIES) {
  return Object.fromEntries(
    QUICK_REPLY_GROUPS.map((group) => [group, normalizeGroup(value?.[group], group)])
  )
}

export function validateQuickReplies(value) {
  const errors = {}

  for (const group of QUICK_REPLY_GROUPS) {
    const replies = normalizeGroup(value?.[group], group)
    const seen = new Set()

    replies.forEach((reply, index) => {
      const text = reply.text.trim()
      const key = text.toLocaleLowerCase('vi')

      if (!text) {
        errors[`${group}.${index}`] = 'Nội dung không được để trống.'
      } else if (text.length > QUICK_REPLY_TEXT_LIMIT) {
        errors[`${group}.${index}`] =
          `Nội dung không được vượt quá ${QUICK_REPLY_TEXT_LIMIT} ký tự.`
      } else if (seen.has(key)) {
        errors[`${group}.${index}`] = 'Không được trùng nội dung trong cùng một nhóm.'
      }

      seen.add(key)
    })
  }

  return errors
}

export function readQuickReplies(storage) {
  const fallback = cloneQuickReplies()

  try {
    const raw = storage.getItem(QUICK_REPLIES_STORAGE_KEY)
    if (!raw) return fallback

    const stored = JSON.parse(raw)
    const normalized = cloneQuickReplies(stored)

    return Object.keys(validateQuickReplies(normalized)).length ? fallback : normalized
  } catch {
    return fallback
  }
}

export function saveQuickReplies(storage, value) {
  const normalized = cloneQuickReplies(value)

  if (Object.keys(validateQuickReplies(normalized)).length) {
    throw new Error('Mẫu trả lời nhanh chưa hợp lệ.')
  }

  storage.setItem(QUICK_REPLIES_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}
