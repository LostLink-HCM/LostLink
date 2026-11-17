const SETTING_DEFINITIONS = Object.freeze({
  reportDays: { default: 5, min: 1, max: 365, integer: true },
  contactHours: { default: 12, min: 1, max: 72, integer: true },
  returnReminderDays: { default: 7, min: 1, max: 365, integer: true },
  mCategory: { default: 0.95, min: 0, max: 1, exclusive: true },
  mTime: { default: 0.9, min: 0, max: 1, exclusive: true },
  mLocation: { default: 0.9, min: 0, max: 1, exclusive: true },
  mDescription: { default: 0.8, min: 0, max: 1, exclusive: true },
  mContents: { default: 0.8, min: 0, max: 1, exclusive: true },
  strongThreshold: { default: 90, min: 1, max: 99, integer: true },
  weakThreshold: { default: 50, min: 1, max: 99, integer: true },
  priorOdds: { default: 200, min: 2, max: 100000, integer: true },
  timeTolerance: { default: 1, min: 0, max: 30, integer: true },
  sMin: { default: 0.05, min: 0.01, max: 0.5 },
  paginationPageSize: { default: 10, min: 1, max: 100, integer: true },
})

const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(Object.entries(SETTING_DEFINITIONS).map(([key, rule]) => [key, rule.default]))
)
const SETTING_KEYS = Object.freeze(Object.keys(SETTING_DEFINITIONS))
const SETTING_GROUPS = Object.freeze({
  matching: [
    'mCategory',
    'mTime',
    'mLocation',
    'mDescription',
    'mContents',
    'strongThreshold',
    'weakThreshold',
    'priorOdds',
    'timeTolerance',
    'sMin',
  ],
  timeThresholds: ['reportDays', 'contactHours', 'returnReminderDays'],
  pagination: ['paginationPageSize'],
})

const QUICK_REPLY_GROUPS = Object.freeze(['user', 'internal'])
const QUICK_REPLY_TEXT_MAX = 500
const DEFAULT_QUICK_REPLIES = Object.freeze({
  user: [
    'Chào bạn, mình đã tiếp nhận yêu cầu và đang kiểm tra thông tin.',
    'Bạn có thể bổ sung thời gian, địa điểm và các thông tin liên quan giúp mình không?',
    'Cảm ơn bạn đã phối hợp. Nếu cần hỗ trợ thêm, bạn cứ nhắn tại đây nhé.',
  ],
  internal: [
    'Mình đã tiếp nhận thông tin và sẽ kiểm tra lại hồ sơ.',
    'Nhờ bạn hỗ trợ xem xét trường hợp này. Mình sẽ bổ sung thông tin liên quan.',
  ],
})

const QUICK_REPLY_MARKERS = Object.freeze(
  Object.fromEntries(
    QUICK_REPLY_GROUPS.map((group) => [group, `quickReplies.${group}.initialized`])
  )
)

module.exports = {
  SETTING_DEFINITIONS,
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SETTING_GROUPS,
  QUICK_REPLY_GROUPS,
  QUICK_REPLY_TEXT_MAX,
  DEFAULT_QUICK_REPLIES,
  QUICK_REPLY_MARKERS,
}
