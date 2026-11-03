import { useState, useCallback } from 'react'

/**
 * usePagination – manages page/limit/sort state for server-side paginated tables
 */
export function usePagination({ initialPage = 1, initialLimit = 20 } = {}) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  const goToPage = useCallback((p) => setPage(p), [])

  const resetPage = useCallback(() => setPage(1), [])

  const changeLimit = useCallback((l) => {
    setLimit(l)
    setPage(1)
  }, [])

  return { page, limit, goToPage, resetPage, changeLimit }
}

export default usePagination

