import { useMemo, useState } from 'react'

export default function usePaginatedFilter({ items, initialFilters, filterFn, pageSize }) {
  const [filters, setFilters] = useState(() => ({ ...initialFilters }))
  const [page, setPage] = useState(1)

  const filteredItems = useMemo(() => filterFn(items, filters), [filterFn, filters, items])
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [currentPage, filteredItems, pageSize])

  const setFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ ...initialFilters })
    setPage(1)
  }

  return {
    filters,
    setFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    pageCount,
    currentPage,
    filteredItems,
    visibleItems,
  }
}
