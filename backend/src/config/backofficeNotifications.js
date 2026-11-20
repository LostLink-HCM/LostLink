const CATEGORY_BY_TYPE = {
  post_pending: 'review',
  report_queue: 'report',
  report_flagged: 'report',
  backoffice_message: 'system',
}

const TYPES_BY_ROLE = {
  admin: ['backoffice_message'],
  moderator: ['post_pending', 'report_queue', 'report_flagged', 'backoffice_message'],
}

const CATEGORIES = ['review', 'warning', 'report', 'system']

module.exports = { CATEGORY_BY_TYPE, TYPES_BY_ROLE, CATEGORIES }
