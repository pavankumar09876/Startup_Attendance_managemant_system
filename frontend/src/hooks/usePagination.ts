import { useState } from 'react'

export function usePagination(defaultLimit = 20) {
  const [page, setPage] = useState(1)
  const [limit] = useState(defaultLimit)

  const skip = (page - 1) * limit

  const nextPage = () => setPage((p) => p + 1)
  const prevPage = () => setPage((p) => Math.max(1, p - 1))
  const goToPage = (n: number) => setPage(n)
  const reset = () => setPage(1)

  return { page, skip, limit, nextPage, prevPage, goToPage, reset }
}
