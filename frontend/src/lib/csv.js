import { api } from './api'

// Ký tự BOM ở đầu file giúp Excel nhận đúng UTF-8 để hiển thị tiếng Việt
const BOM = String.fromCharCode(0xfeff)

// Ô bắt đầu bằng = + @ - sẽ bị Excel hiểu là công thức, thêm ' phía trước để vô hiệu
const escapeCell = (value) => {
  const text = String(value ?? '')
  const safe = /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export const toCsv = (rows) => BOM + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

export function downloadCsv(filename, rows) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadCsvFromApi(path, params = {}, fallbackFilename = 'LostLink.csv') {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== '' && value != null)
      .map(([key, value]) => [key, String(value)])
  )
  const suffix = query.size ? `?${query}` : ''
  const { blob, filename } = await api.download(`${path}${suffix}`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || fallbackFilename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename || fallbackFilename
}
