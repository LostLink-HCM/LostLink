const { DISTRICTS } = require('../config/areas')
const { AuditLog, MatchSuggestion, Post, Report, VerificationAttempt } = require('../models')
const { startOfVnDay } = require('../utils/vnTime')

const DAY_MS = 24 * 60 * 60 * 1000
const DISTRICT_SET = new Set(DISTRICTS)

const shiftDate = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)

const emptyTotals = () => ({ lost: 0, found: 0, matches: 0, successful: 0, reports: 0, locks: 0 })

const createRateTrendBuckets = (from, to) => {
  const days =
    Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS) +
    1

  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(from, index)
    return {
      date,
      start: startOfVnDay(date),
      end: startOfVnDay(shiftDate(date, 1)),
      approvedPosts: 0,
      approvedWithSuggestions: 0,
      returnedPosts: 0,
      verificationRequests: 0,
      verificationPassed: 0,
    }
  })
}

const rateTrendValues = (buckets, numerator, denominator, from) => {
  const firstIndex = buckets.findIndex((bucket) => bucket.date === from)
  if (firstIndex < 0) return []

  return buckets.slice(firstIndex).map((_, index) => {
    const endIndex = firstIndex + index
    const window = buckets.slice(Math.max(0, endIndex - 6), endIndex + 1)
    const numeratorTotal = window.reduce((sum, bucket) => sum + bucket[numerator], 0)
    const denominatorTotal = window.reduce((sum, bucket) => sum + bucket[denominator], 0)
    return denominatorTotal ? (numeratorTotal / denominatorTotal) * 100 : null
  })
}

const findRateTrendBucket = (buckets, value) => {
  const timestamp = value instanceof Date ? value.getTime() : startOfVnDay(value).getTime()
  return buckets.find((bucket) => timestamp >= bucket.start && timestamp < bucket.end)
}

const totalsWithDerived = (totals, days) => ({
  ...totals,
  posts: totals.lost + totals.found,
  rate: totals.matches ? (totals.successful / totals.matches) * 100 : null,
  average: days ? (totals.lost + totals.found) / days : 0,
})

const add = (map, key, amount = 1) => map.set(key, (map.get(key) || 0) + amount)

const aggregatePosts = (start, end, area) =>
  Post.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lt: end },
        ...(area ? { area } : {}),
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        day: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' },
        },
        area: 1,
        type: 1,
        categoryName: { $ifNull: ['$categoryDoc.name', 'Danh mục đã lưu trữ'] },
      },
    },
    {
      $group: {
        _id: { day: '$day', area: '$area', category: '$categoryName', type: '$type' },
        count: { $sum: 1 },
      },
    },
  ])

const aggregateMatches = (start, end, area) =>
  MatchSuggestion.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $lookup: {
        from: 'posts',
        localField: 'postLost',
        foreignField: '_id',
        as: 'lostPost',
      },
    },
    { $unwind: '$lostPost' },
    ...(area ? [{ $match: { 'lostPost.area': area } }] : []),
    {
      $project: {
        day: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' },
        },
        area: '$lostPost.area',
        confirmedLost: 1,
        confirmedFound: 1,
      },
    },
    {
      $group: {
        _id: { day: '$day', area: '$area' },
        count: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $and: ['$confirmedLost', '$confirmedFound'] }, 1, 0] },
        },
      },
    },
  ])

const aggregateReports = (start, end, area) =>
  Report.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $lookup: {
        from: 'posts',
        localField: 'targetPost',
        foreignField: '_id',
        as: 'targetPostDoc',
      },
    },
    { $unwind: { path: '$targetPostDoc', preserveNullAndEmptyArrays: true } },
    ...(area ? [{ $match: { targetType: 'post', 'targetPostDoc.area': area } }] : []),
    {
      $project: {
        day: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' },
        },
        area: { $ifNull: ['$targetPostDoc.area', ''] },
      },
    },
    { $group: { _id: { day: '$day', area: '$area' }, count: { $sum: 1 } } },
  ])

const aggregateLocks = (start, end) =>
  AuditLog.aggregate([
    {
      $match: {
        entityType: 'User',
        action: 'lock',
        createdAt: { $gte: start, $lt: end },
      },
    },
    {
      $project: {
        day: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' },
        },
      },
    },
    { $group: { _id: '$day', count: { $sum: 1 } } },
  ])

const firstStatusAt = (history, status) =>
  history?.find((entry) => entry.status === status)?.changedAt ?? null

const collectApprovedPosts = async (start, end, area) => {
  const candidates = await Post.find({
    statusHistory: {
      $elemMatch: { status: 'searching', changedAt: { $gte: start, $lt: end } },
    },
    ...(area ? { area } : {}),
  })
    .select('_id area createdAt statusHistory')
    .lean()

  return candidates
    .map((post) => ({
      ...post,
      approvedAt: firstStatusAt(post.statusHistory, 'searching'),
      returnedAt: firstStatusAt(post.statusHistory, 'returned'),
    }))
    .filter((post) => post.approvedAt && post.approvedAt >= start && post.approvedAt < end)
}

const collectSuggestedPostIds = async (posts) => {
  if (!posts.length) return new Set()
  const postIds = posts.map(({ _id }) => _id)
  const [lostPosts, foundPosts] = await Promise.all([
    MatchSuggestion.distinct('postLost', { postLost: { $in: postIds } }),
    MatchSuggestion.distinct('postFound', { postFound: { $in: postIds } }),
  ])
  return new Set([...lostPosts, ...foundPosts].map(String))
}

const verificationBasePipeline = (start, end, area) => [
  { $match: { attemptedAt: { $gte: start, $lt: end } } },
  {
    $lookup: {
      from: 'verification_challenges',
      localField: 'challenge',
      foreignField: '_id',
      as: 'challenge',
    },
  },
  { $unwind: '$challenge' },
  {
    $lookup: {
      from: 'posts',
      localField: 'challenge.post',
      foreignField: '_id',
      as: 'post',
    },
  },
  { $unwind: '$post' },
  ...(area ? [{ $match: { 'post.area': area } }] : []),
]

const collectVerificationStats = async (start, end, area) => {
  const [stats] = await VerificationAttempt.aggregate([
    ...verificationBasePipeline(start, end, area),
    {
      $group: {
        _id: null,
        requests: { $sum: 1 },
        passed: { $sum: { $cond: ['$isCorrect', 1, 0] } },
      },
    },
  ])

  const requests = stats?.requests ?? 0
  const passed = stats?.passed ?? 0
  return { requests, passed, rate: requests ? (passed / requests) * 100 : null }
}

const collectVerificationStatsByDay = async (start, end, area) =>
  VerificationAttempt.aggregate([
    ...verificationBasePipeline(start, end, area),
    {
      $project: {
        day: {
          $dateToString: { format: '%Y-%m-%d', date: '$attemptedAt', timezone: 'Asia/Ho_Chi_Minh' },
        },
        isCorrect: 1,
      },
    },
    {
      $group: {
        _id: '$day',
        requests: { $sum: 1 },
        passed: { $sum: { $cond: ['$isCorrect', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ])

const summarizePostKpis = (posts, suggestedPostIds) => {
  const approvedPosts = posts.length
  const approvedWithSuggestions = posts.filter(({ _id }) =>
    suggestedPostIds.has(String(_id))
  ).length
  const returnedPosts = posts.filter(
    ({ approvedAt, returnedAt }) => returnedAt && returnedAt >= approvedAt
  )
  const approvalDurations = posts
    .map(({ approvedAt, createdAt }) => (approvedAt - createdAt) / DAY_MS)
    .filter((duration) => Number.isFinite(duration) && duration >= 0)
  const returnDurations = returnedPosts
    .map(({ approvedAt, returnedAt }) => (returnedAt - approvedAt) / DAY_MS)
    .filter((duration) => Number.isFinite(duration) && duration >= 0)

  return {
    approvedPosts,
    approvedWithSuggestions,
    suggestionRate: approvedPosts ? (approvedWithSuggestions / approvedPosts) * 100 : null,
    returnedPosts: returnedPosts.length,
    returnRate: approvedPosts ? (returnedPosts.length / approvedPosts) * 100 : null,
    averageReturnDays: returnDurations.length
      ? returnDurations.reduce((sum, duration) => sum + duration, 0) / returnDurations.length
      : null,
    averageApprovalDays: approvalDurations.length
      ? approvalDurations.reduce((sum, duration) => sum + duration, 0) / approvalDurations.length
      : null,
  }
}

const listDashboardAreas = async () => {
  const values = await Post.distinct('area', { area: { $type: 'string', $ne: '' } })
  return values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim())
    .filter((value) => DISTRICT_SET.has(value))
    .sort((left, right) => left.localeCompare(right, 'vi'))
}

const listAdminDashboard = async ({ from, to, area = '' }) => {
  const days =
    Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS) +
    1
  const trendDays = Math.max(7, days)
  const trendFrom = shiftDate(to, 1 - trendDays)
  const trendDataFrom = shiftDate(trendFrom, -6)
  const previousFrom = shiftDate(from, -days)
  const previousTo = shiftDate(from, -1)
  const currentEnd = startOfVnDay(shiftDate(to, 1))
  const trendDataStart = startOfVnDay(trendDataFrom)
  const previousStart = startOfVnDay(previousFrom)
  const approvedCandidatesStart = trendDataFrom < previousFrom ? trendDataStart : previousStart

  const [
    posts,
    matches,
    reports,
    locks,
    areaOptions,
    approvedCandidates,
    verification,
    previousVerification,
    verificationByDay,
  ] = await Promise.all([
    aggregatePosts(previousStart, currentEnd),
    aggregateMatches(previousStart, currentEnd, area),
    aggregateReports(previousStart, currentEnd, area),
    aggregateLocks(previousStart, currentEnd),
    listDashboardAreas(),
    collectApprovedPosts(approvedCandidatesStart, currentEnd, area),
    collectVerificationStats(startOfVnDay(from), currentEnd, area),
    collectVerificationStats(previousStart, startOfVnDay(from), area),
    collectVerificationStatsByDay(trendDataStart, currentEnd, area),
  ])

  const suggestedPostIds = await collectSuggestedPostIds(approvedCandidates)
  const currentApproved = approvedCandidates.filter(
    ({ approvedAt }) => approvedAt >= startOfVnDay(from) && approvedAt < currentEnd
  )
  const previousApproved = approvedCandidates.filter(
    ({ approvedAt }) => approvedAt >= previousStart && approvedAt < startOfVnDay(from)
  )
  const kpis = {
    ...summarizePostKpis(currentApproved, suggestedPostIds),
    verificationRequests: verification.requests,
    verificationPassed: verification.passed,
    verificationRate: verification.rate,
  }
  const previousKpis = {
    ...summarizePostKpis(previousApproved, suggestedPostIds),
    verificationRequests: previousVerification.requests,
    verificationPassed: previousVerification.passed,
    verificationRate: previousVerification.rate,
  }
  const rateTrendBuckets = createRateTrendBuckets(trendDataFrom, to)
  for (const post of approvedCandidates) {
    const bucket = findRateTrendBucket(rateTrendBuckets, post.approvedAt)
    if (!bucket) continue
    bucket.approvedPosts += 1
    if (suggestedPostIds.has(String(post._id))) bucket.approvedWithSuggestions += 1
    if (post.returnedAt && post.returnedAt >= post.approvedAt) bucket.returnedPosts += 1
  }
  for (const row of verificationByDay) {
    const bucket = findRateTrendBucket(rateTrendBuckets, row._id)
    if (!bucket) continue
    bucket.verificationRequests += row.requests
    bucket.verificationPassed += row.passed
  }
  const rateTrends = {
    suggestionRate: rateTrendValues(
      rateTrendBuckets,
      'approvedWithSuggestions',
      'approvedPosts',
      trendFrom
    ),
    returnRate: rateTrendValues(rateTrendBuckets, 'returnedPosts', 'approvedPosts', trendFrom),
    verificationRate: rateTrendValues(
      rateTrendBuckets,
      'verificationPassed',
      'verificationRequests',
      trendFrom
    ),
  }

  const dailyByDate = new Map()
  for (let index = 0; index < days; index += 1) {
    const date = shiftDate(from, index)
    dailyByDate.set(date, { date, ...emptyTotals() })
  }
  const currentTotals = emptyTotals()
  const previousTotals = emptyTotals()
  const areas = new Map()
  const rankedAreaPosts = new Map()
  const previousAreas = new Map()
  const categories = new Map()
  const previousCategories = new Map()

  const isCurrent = (date) => date >= from && date <= to
  const isPrevious = (date) => date >= previousFrom && date <= previousTo
  const addToPeriod = (totals, areaMap, areaName, key, count) => {
    totals[key] += count
    if (areaName) {
      if (!areaMap.has(areaName)) areaMap.set(areaName, emptyTotals())
      areaMap.get(areaName)[key] += count
    }
  }

  for (const row of posts) {
    const { day, area: postArea, category, type } = row._id
    const count = row.count
    const key = type === 'lost' ? 'lost' : 'found'
    if (isCurrent(day)) {
      const isDistrict = DISTRICT_SET.has(postArea)
      if (isDistrict) add(rankedAreaPosts, postArea, count)
      if (area && postArea !== area) continue
      addToPeriod(currentTotals, areas, isDistrict ? postArea : '', key, count)
      const dayRow = dailyByDate.get(day)
      if (dayRow) dayRow[key] += count
      add(categories, category, count)
    } else if (isPrevious(day) && (!area || postArea === area)) {
      addToPeriod(
        previousTotals,
        previousAreas,
        DISTRICT_SET.has(postArea) ? postArea : '',
        key,
        count
      )
      add(previousCategories, category, count)
    }
  }

  for (const row of matches) {
    const { day, area: matchArea } = row._id
    if (isCurrent(day)) {
      addToPeriod(currentTotals, areas, matchArea, 'matches', row.count)
      currentTotals.successful += row.successful
      if (matchArea) areas.get(matchArea).successful += row.successful
      const dayRow = dailyByDate.get(day)
      if (dayRow) {
        dayRow.matches += row.count
        dayRow.successful += row.successful
      }
    } else if (isPrevious(day)) {
      addToPeriod(previousTotals, previousAreas, matchArea, 'matches', row.count)
      previousTotals.successful += row.successful
      if (matchArea) previousAreas.get(matchArea).successful += row.successful
    }
  }

  for (const row of reports) {
    const { day, area: reportArea } = row._id
    if (isCurrent(day)) {
      currentTotals.reports += row.count
      if (area && reportArea) {
        addToPeriod(currentTotals, areas, reportArea, 'reports', row.count)
      } else if (!area) {
        const dayRow = dailyByDate.get(day)
        if (dayRow) dayRow.reports += row.count
        if (reportArea) {
          if (!areas.has(reportArea)) areas.set(reportArea, emptyTotals())
          areas.get(reportArea).reports += row.count
        }
      }
      if (area) {
        const dayRow = dailyByDate.get(day)
        if (dayRow) dayRow.reports += row.count
      }
    } else if (isPrevious(day)) {
      previousTotals.reports += row.count
      if (reportArea) {
        if (!previousAreas.has(reportArea)) previousAreas.set(reportArea, emptyTotals())
        previousAreas.get(reportArea).reports += row.count
      }
    }
  }

  const lockMap = new Map(locks.map((row) => [row._id, row.count]))
  for (const [day, count] of lockMap) {
    if (isCurrent(day)) {
      currentTotals.locks += count
      const dayRow = dailyByDate.get(day)
      if (dayRow) dayRow.locks += count
    } else if (isPrevious(day)) previousTotals.locks += count
  }

  const totals = totalsWithDerived(currentTotals, days)
  const previous = totalsWithDerived(previousTotals, days)
  const areaRank = new Map(
    [...rankedAreaPosts.entries()]
      .sort(
        ([leftName, leftPosts], [rightName, rightPosts]) =>
          rightPosts - leftPosts || leftName.localeCompare(rightName, 'vi')
      )
      .map(([name], index) => [name, index + 1])
  )
  const areaMaxPosts = Math.max(0, ...rankedAreaPosts.values())
  const areaRanking = [...DISTRICTS]
    .map((name) => ({ name, posts: rankedAreaPosts.get(name) || 0 }))
    .sort((left, right) => right.posts - left.posts || left.name.localeCompare(right.name, 'vi'))
    .map((row, index) => ({ ...row, rank: index + 1 }))
  const allAreaRows = [...areas.entries()]
    .filter(([name, values]) => name && values.lost + values.found > 0)
    .map(([name, values]) => {
      const before = previousAreas.get(name) || emptyTotals()
      return {
        name,
        rank: areaRank.get(name),
        ...totalsWithDerived(values, days),
        change:
          before.lost + before.found
            ? ((values.lost + values.found - before.lost - before.found) /
                (before.lost + before.found)) *
              100
            : values.lost + values.found === 0
              ? 0
              : null,
      }
    })
    .sort((left, right) => right.posts - left.posts || left.name.localeCompare(right.name, 'vi'))

  const categoryNames = new Set([...categories.keys(), ...previousCategories.keys()])
  const categoryRows = [...categoryNames]
    .map((name) => {
      const count = categories.get(name) || 0
      const before = previousCategories.get(name) || 0
      return {
        name,
        posts: count,
        change: before ? ((count - before) / before) * 100 : count === 0 ? 0 : null,
      }
    })
    .sort((left, right) => right.posts - left.posts || left.name.localeCompare(right.name, 'vi'))

  const topAreas = area ? allAreaRows.filter((item) => item.name === area) : allAreaRows.slice(0, 5)

  return {
    from,
    to,
    area,
    areaOptions,
    totals,
    previous,
    kpis,
    previousKpis,
    rateTrends,
    daily: [...dailyByDate.values()],
    days,
    previousRange: { from: previousFrom, to: previousTo },
    areas: topAreas,
    areaRanking,
    areaMaxPosts,
    categories: categoryRows,
    average: totals.average,
    hasData:
      Object.values(currentTotals).some((value) => value > 0) ||
      kpis.approvedPosts > 0 ||
      kpis.verificationRequests > 0,
    canCompare: true,
  }
}

module.exports = { listAdminDashboard }
