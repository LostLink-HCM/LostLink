const CATEGORY_BY_TYPE = {
  post_pending: 'review',
  report_queue: 'report',
  report_flagged: 'report',
  backoffice_message: 'system',
  account_restricted: 'warning',
}

const TYPES_BY_ROLE = {
  admin: ['account_restricted'],
  moderator: ['post_pending', 'report_queue', 'backoffice_message'],
}

const CATEGORIES = ['review', 'warning', 'report', 'system']

module.exports = { CATEGORY_BY_TYPE, TYPES_BY_ROLE, CATEGORIES }
