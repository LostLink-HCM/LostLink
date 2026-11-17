import { useOutletContext } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../lib/admin/settings'

export default function useBackofficePageSize() {
  return useOutletContext()?.paginationPageSize ?? DEFAULT_SETTINGS.paginationPageSize
}
