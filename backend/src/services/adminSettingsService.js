const { AuditLog, QuickReply, SystemConfig, User } = require('../models')
const {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  SETTING_GROUPS,
  DEFAULT_QUICK_REPLIES,
  QUICK_REPLY_GROUPS,
  QUICK_REPLY_MARKERS,
} = require('../config/systemSettings')
const ApiError = require('../utils/ApiError')
const { settingError, thresholdError } = require('../utils/systemSettings')

const MANAGED_KEYS = [...SETTING_KEYS, ...Object.values(QUICK_REPLY_MARKERS)]
const SHARED_KEYS = ['paginationPageSize', ...Object.values(QUICK_REPLY_MARKERS)]
let operations = Promise.resolve()

const exclusive = (work) => {
  const result = operations.then(work)
  operations = result.catch(() => {})
  return result
}

const invalidFields = (details) => new ApiError(422, 'Dữ liệu không hợp lệ.', details)
const configChanged = () =>
  ApiError.conflict('Cấu hình đã thay đổi. Vui lòng tải lại và thử lại.', 'SETTINGS_CHANGED')

const readRecords = async (session = null, keys = MANAGED_KEYS) => {
  const configQuery = SystemConfig.find({ key: { $in: keys } })
    .session(session)
    .lean()
  const replyQuery = QuickReply.find({ group: { $in: QUICK_REPLY_GROUPS } })
    .select('+normalizedText')
    .sort({ group: 1, sortOrder: 1, _id: 1 })
    .session(session)
    .lean()
  const [configs, replies] = session
    ? [await configQuery, await replyQuery]
    : await Promise.all([configQuery, replyQuery])
  return { configs, replies }
}

const valuesOf = ({ configs }) => {
  const values = { ...DEFAULT_SETTINGS }
  for (const config of configs) {
    if (!SETTING_KEYS.includes(config.key)) continue
    const value =
      typeof config.value === 'string' && config.value.trim() !== '' ? Number(config.value) : NaN
    if (settingError(config.key, value)) {
      throw new ApiError(
        500,
        'Cấu hình trong database không hợp lệ.',
        undefined,
        'SETTINGS_INVALID'
      )
    }
    values[config.key] = value
  }
  return values
}

const groupInitialized = (records, group) =>
  records.configs.some((config) => config.key === QUICK_REPLY_MARKERS[group]) ||
  records.replies.some((reply) => reply.group === group)

const replyValues = (replies) =>
  replies.map((reply) => ({ id: String(reply._id), text: reply.text }))

const quickRepliesOf = (records) =>
  Object.fromEntries(
    QUICK_REPLY_GROUPS.map((group) => [
      group,
      groupInitialized(records, group)
        ? replyValues(records.replies.filter((reply) => reply.group === group))
        : DEFAULT_QUICK_REPLIES[group].map((text) => ({ text })),
    ])
  )

const stateOf = async (records, session = null) => {
  const latest = [...records.configs, ...records.replies]
    .filter((record) => record.updatedAt)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
  const actor = latest?.updatedBy
    ? await User.findById(latest.updatedBy).select('username').session(session).lean()
    : null
  return {
    values: valuesOf(records),
    quickReplies: quickRepliesOf(records),
    updatedAt: latest?.updatedAt ?? null,
    updatedBy: actor ? { id: String(actor._id), username: actor.username } : null,
    missing: {
      values: SETTING_KEYS.filter((key) => !records.configs.some((config) => config.key === key)),
      quickReplies: QUICK_REPLY_GROUPS.filter((group) => !groupInitialized(records, group)),
    },
  }
}

const getSettings = () => exclusive(async () => stateOf(await readRecords()))

const getBackofficeSettings = () =>
  exclusive(async () => {
    const records = await readRecords(null, SHARED_KEYS)
    return {
      paginationPageSize: valuesOf(records).paginationPageSize,
      quickReplies: quickRepliesOf(records),
    }
  })

const getMatchingSettings = () =>
  exclusive(async () => {
    const keys = SETTING_GROUPS.matching
    const configs = await SystemConfig.find({ key: { $in: keys } })
      .select('key value')
      .lean()
    const values = valuesOf({ configs })
    return { values: Object.fromEntries(keys.map((key) => [key, values[key]])) }
  })

const nextTimestamp = (records) =>
  new Date(
    Math.max(
      Date.now(),
      ...[...records.configs, ...records.replies].map((record) =>
        record.updatedAt ? record.updatedAt.getTime() + 1 : 0
      )
    )
  )

const prepareConfigs = (records, values, actor, updatedAt) =>
  Object.entries(values).flatMap(([key, value]) => {
    const before = records.configs.find((config) => config.key === key)
    if (before?.value === String(value)) return []
    const after = before
      ? { ...before, value: String(value), updatedBy: actor._id, updatedAt }
      : { _id: new SystemConfig()._id, key, value: String(value), updatedBy: actor._id, updatedAt }
    return [{ before, after }]
  })

const prepareReplies = async (records, groups, actor, updatedAt, importing) => {
  const replies = []
  const changedGroups = []
  const usedIds = new Set()
  for (const [group, items] of Object.entries(groups)) {
    const current = records.replies.filter((reply) => reply.group === group)
    const next = []
    for (const [sortOrder, item] of items.entries()) {
      const old =
        !importing && item.id ? current.find((reply) => String(reply._id) === item.id) : null
      if (!importing && item.id && (!old || usedIds.has(item.id))) {
        throw invalidFields([
          {
            field: `${group}.${sortOrder}.id`,
            message: 'Mẫu trả lời không thuộc nhóm này hoặc mã bị trùng.',
          },
        ])
      }
      if (old) usedIds.add(item.id)
      const text = item.text.trim()
      if (old && old.text === text && old.sortOrder === sortOrder) {
        next.push(old)
      } else {
        const reply = new QuickReply({
          ...(old && { _id: old._id }),
          group,
          text,
          sortOrder,
          updatedBy: actor._id,
          updatedAt,
        })
        await reply.validate()
        next.push(reply.toObject())
      }
    }
    const signature = (itemsToCompare) =>
      JSON.stringify(
        itemsToCompare.map((reply) => [String(reply._id), reply.text, reply.sortOrder])
      )
    if (signature(current) !== signature(next)) {
      changedGroups.push(group)
      replies.push(...next)
    }
  }
  return { replies, changedGroups }
}

const persist = async (records, configChanges, replyChanges, actor, action, detail, session) => {
  if (!configChanges.length && !replyChanges.changedGroups.length) return
  const appliedConfigs = []
  let repliesStarted = false
  const replyFilter = { group: { $in: replyChanges.changedGroups } }
  const log = new AuditLog({
    actor: actor._id,
    actorRole: actor.role,
    action,
    entityType: detail.section === 'quickReplies' ? 'QuickReply' : 'SystemConfig',
    entityId: detail.section === 'quickReplies' ? null : (configChanges[0]?.after._id ?? null),
    detail,
  })
  try {
    for (const change of configChanges) {
      const { before, after } = change
      if (before) {
        const result = await SystemConfig.collection.replaceOne(
          { _id: before._id, value: before.value, updatedAt: before.updatedAt },
          after,
          { session }
        )
        if (!result.matchedCount) throw configChanged()
      } else {
        await SystemConfig.collection.insertOne(after, { session })
      }
      appliedConfigs.push(change)
    }
    if (replyChanges.changedGroups.length) {
      repliesStarted = true
      await QuickReply.deleteMany(replyFilter).session(session)
      if (replyChanges.replies.length) {
        await QuickReply.collection.insertMany(replyChanges.replies, { session })
      }
    }
    await log.save({ session })
  } catch (error) {
    if (!session) {
      try {
        if (repliesStarted) {
          await QuickReply.deleteMany(replyFilter)
          const previous = records.replies.filter((reply) =>
            replyChanges.changedGroups.includes(reply.group)
          )
          if (previous.length) await QuickReply.collection.insertMany(previous)
        }
        for (const { before, after } of appliedConfigs.reverse()) {
          const filter = { _id: after._id, updatedAt: after.updatedAt, value: after.value }
          const result = before
            ? await SystemConfig.collection.replaceOne(filter, before)
            : await SystemConfig.collection.deleteOne(filter)
          if (!(before ? result.matchedCount : result.deletedCount)) throw configChanged()
        }
        await AuditLog.deleteOne({ _id: log._id })
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Không thể hoàn lại lần lưu cấu hình thất bại.'
        )
      }
    }
    throw error
  }
}

const changeSettings = (actor, work) =>
  exclusive(async () => {
    if (actor.role !== 'admin') throw ApiError.forbidden('Chỉ admin được cập nhật cấu hình.')
    const hello = await SystemConfig.db.db.admin().command({ hello: 1 })
    const change = async (session) => {
      const records = await readRecords(session)
      await work(records, session)
      return stateOf(await readRecords(session), session)
    }
    return hello.setName || hello.msg === 'isdbgrid'
      ? SystemConfig.db.transaction(change)
      : change(null)
  })

const updateSettings = (group, values, actor) =>
  changeSettings(actor, async (records, session) => {
    const keys = SETTING_GROUPS[group]
    const effective = { ...valuesOf(records), ...values }
    const error = group === 'matching' ? thresholdError(effective) : null
    if (error) throw invalidFields([{ field: 'weakThreshold', message: error }])
    const selected = Object.fromEntries(keys.map((key) => [key, effective[key]]))
    const changes = prepareConfigs(records, selected, actor, nextTimestamp(records))
    await persist(
      records,
      changes,
      { changedGroups: [] },
      actor,
      'update',
      {
        section: group,
        before: Object.fromEntries(keys.map((key) => [key, valuesOf(records)[key]])),
        after: selected,
      },
      session
    )
  })

const updateQuickReplies = (groups, actor) =>
  changeSettings(actor, async (records, session) => {
    const timestamp = nextTimestamp(records)
    const changes = await prepareReplies(records, groups, actor, timestamp, false)
    const markers = Object.fromEntries(
      QUICK_REPLY_GROUPS.filter(
        (group) => changes.changedGroups.includes(group) || !groupInitialized(records, group)
      ).map((group) => [QUICK_REPLY_MARKERS[group], 'true'])
    )
    const configChanges = prepareConfigs(records, markers, actor, timestamp)
    // Một lần xóa hết mẫu vẫn phải có thời điểm cập nhật mới ở dấu khởi tạo.
    for (const group of changes.changedGroups) {
      if (configChanges.some((change) => change.after.key === QUICK_REPLY_MARKERS[group])) continue
      const before = records.configs.find((config) => config.key === QUICK_REPLY_MARKERS[group])
      configChanges.push({
        before,
        after: { ...before, updatedAt: timestamp, updatedBy: actor._id },
      })
    }
    await persist(
      records,
      configChanges,
      changes,
      actor,
      'update',
      {
        section: 'quickReplies',
        before: Object.fromEntries(
          QUICK_REPLY_GROUPS.map((group) => [
            group,
            replyValues(records.replies.filter((reply) => reply.group === group)),
          ])
        ),
        after: Object.fromEntries(
          QUICK_REPLY_GROUPS.map((group) => [group, groups[group].map(({ text }) => ({ text }))])
        ),
      },
      session
    )
  })

const initializeSettings = (input, actor) =>
  changeSettings(actor, async (records, session) => {
    const values = Object.fromEntries(
      SETTING_KEYS.filter((key) => !records.configs.some((config) => config.key === key)).map(
        (key) => [key, input.values?.[key] ?? DEFAULT_SETTINGS[key]]
      )
    )
    const error = thresholdError({ ...valuesOf(records), ...values })
    if (error) throw invalidFields([{ field: 'values.weakThreshold', message: error }])
    const groups = Object.fromEntries(
      QUICK_REPLY_GROUPS.filter((group) => !groupInitialized(records, group)).map((group) => [
        group,
        input.quickReplies?.[group] ?? DEFAULT_QUICK_REPLIES[group].map((text) => ({ text })),
      ])
    )
    const timestamp = nextTimestamp(records)
    const configChanges = prepareConfigs(
      records,
      {
        ...values,
        ...Object.fromEntries(
          Object.keys(groups).map((group) => [QUICK_REPLY_MARKERS[group], 'true'])
        ),
      },
      actor,
      timestamp
    )
    const changes = await prepareReplies(records, groups, actor, timestamp, true)
    await persist(
      records,
      configChanges,
      changes,
      actor,
      'initialize',
      {
        section: 'initialize',
        keys: Object.keys(values),
        quickReplyGroups: Object.keys(groups),
        before: { values: {}, quickReplies: {} },
        after: {
          values,
          quickReplies: Object.fromEntries(
            Object.entries(groups).map(([group, replies]) => [
              group,
              replies.map(({ text }) => ({ text })),
            ])
          ),
        },
      },
      session
    )
  })

module.exports = {
  getSettings,
  getBackofficeSettings,
  getMatchingSettings,
  updateSettings,
  updateQuickReplies,
  initializeSettings,
}
