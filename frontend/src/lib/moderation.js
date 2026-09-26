export const REJECT_REASONS = ['Nội dung Spam / Quảng cáo', 'Hình ảnh không hợp lệ / Phản cảm', 'Nghi ngờ thông tin giả mạo/lừa đảo', 'Nội dung sai mục đích nền tảng']

export function reviewPost(posts, id, decision, reason = '') {
  if (!['approve', 'reject'].includes(decision) || (decision === 'reject' && !reason.trim())) return posts
  return posts.map((post) => post.id === id && post.status === 'pending'
    ? { ...post, status: decision === 'approve' ? 'searching' : 'rejected', moderationReason: reason.trim() }
    : post)
}

export function csvFromRows(rows) {
  const cell = (value) => {
    const text = String(value ?? '')
    const safe = /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename, rows) {
  const url = URL.createObjectURL(new Blob([csvFromRows(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
