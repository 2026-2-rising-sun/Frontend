import type { Paged } from '../domain/types'

export const DEFAULT_PAGE_SIZE = 12

/** 배열을 page(0부터) / size 단위로 잘라 Paged 응답으로 만든다. */
export function paginate<T>(all: T[], page = 0, size = DEFAULT_PAGE_SIZE): Paged<T> {
  const start = page * size
  const items = all.slice(start, start + size)
  return { items, page, size, totalCount: all.length, hasNext: start + size < all.length }
}
