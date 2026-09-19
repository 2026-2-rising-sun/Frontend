import {
  LIVE_DESCRIPTION_MAX,
  LIVE_TITLE_MAX,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_NAME_MAX,
  validateImageFile,
} from '../domain/constraints'
import { ApiError } from '../domain/errors'
import type { AdminLivesPort, AdminProductsPort } from '../domain/ports'
import type { LiveInput, ProductBasicInput } from '../domain/types'
import { db, persist, type StoredLive, type StoredProduct } from './db'
import { isPublic, toAdminLive, toAdminProduct } from './mappers'

import { mockLivesApi } from './mockLivesApi'
import { paginate } from './paginate'
import { simulateNetwork } from './simulate'

const validation = (message: string) => new ApiError('VALIDATION', message)

const findProduct = (id: string): StoredProduct => {
  const product = db.products.find((p) => p.id === id)
  if (!product) throw new ApiError('NOT_FOUND', '상품을 찾을 수 없어요.')
  return product
}

const findLive = (id: string): StoredLive => {
  const live = db.lives.find((l) => l.id === id)
  if (!live) throw new ApiError('NOT_FOUND', '방송을 찾을 수 없어요.')
  return live
}

const checkBasic = (input: ProductBasicInput) => {
  const name = input.name.trim()
  const description = input.description.trim()
  if (!name) throw validation('상품명을 입력해 주세요.')
  if (name.length > PRODUCT_NAME_MAX) throw validation(`상품명은 ${PRODUCT_NAME_MAX}자 이하로 입력해 주세요.`)
  if (!description) throw validation('상품 설명을 입력해 주세요.')
  if (description.length > PRODUCT_DESCRIPTION_MAX) throw validation(`상품 설명은 ${PRODUCT_DESCRIPTION_MAX}자 이하로 입력해 주세요.`)
  if (input.image) {
    const problem = validateImageFile(input.image)
    if (problem) throw validation(problem)
  }
  return { name, description }
}

const isPositiveInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0
const isNonNegativeInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

/** 재고가 바뀌면 판매 중 ↔ 품절만 자동 전환한다. 판매 준비·비공개 상품은 재고가 늘어도 자동 공개하지 않는다. */
const syncSoldOut = (p: StoredProduct) => {
  if (p.status === 'SELLING' && (p.stock ?? 0) === 0) p.status = 'SOLD_OUT'
  else if (p.status === 'SOLD_OUT' && (p.stock ?? 0) > 0) p.status = 'SELLING'
}

export const mockAdminProductsApi: AdminProductsPort = {
  async list({ status = 'ALL', query, page, size } = {}) {
    await simulateNetwork('read')
    let items = [...db.products]
    if (status !== 'ALL') items = items.filter((p) => p.status === status)
    if (query?.trim()) items = items.filter((p) => p.name.includes(query.trim()))
    return structuredClone(paginate(items.map(toAdminProduct), page, size))
  },

  async get(productId) {
    await simulateNetwork('read')
    return toAdminProduct(findProduct(productId))
  },

  async create(input) {
    await simulateNetwork('write')
    const { name, description } = checkBasic(input)
    const product: StoredProduct = {
      id: db.nextProductId(),
      name,
      description,
      imageUrl: null,
      // 이미지 파일은 저장하지 않는다(화면 시연용). 선택했다면 "등록됨"으로만 기록한다.
      hasImage: !!input.image,
      price: null,
      stock: null,
      status: 'DRAFT',
      version: 1,
      featuredLive: null,
    }
    db.products.unshift(product)
    persist()
    return toAdminProduct(product)
  },

  async updateBasicInfo(productId, input) {
    await simulateNetwork('write')
    const product = findProduct(productId)
    if (product.version !== input.version) {
      throw new ApiError('CONFLICT', '다른 곳에서 먼저 수정되었어요. 최신 내용을 확인해 주세요.')
    }
    const { name, description } = checkBasic(input)
    // 이미 생성된 주문의 상품명은 주문 당시 값으로 보존되므로 여기서 바꾸지 않는다.
    product.name = name
    product.description = description
    if (input.image) product.hasImage = true
    product.version += 1
    persist()
    return toAdminProduct(product)
  },

  async setSaleInfo(productId, input) {
    await simulateNetwork('write')
    const product = findProduct(productId)
    if (product.status !== 'DRAFT') {
      throw new ApiError('INVALID_STATE', '이미 판매 설정이 된 상품이에요. 가격·재고 수정을 이용해 주세요.')
    }
    if (!isPositiveInt(input.price)) throw validation('가격은 1원 이상의 정수로 입력해 주세요.')
    if (!isNonNegativeInt(input.stock)) throw validation('재고는 0 이상의 정수로 입력해 주세요.')
    product.price = input.price
    product.stock = input.stock
    product.status = 'READY' // 판매 준비. 실제 판매 시작은 changeSaleStatus(START_SALE)
    persist()
    return toAdminProduct(product)
  },

  async changePrice(productId, price) {
    await simulateNetwork('write')
    const product = findProduct(productId)
    if (product.status === 'DRAFT') throw new ApiError('INVALID_STATE', '판매 설정 전 상품이에요.')
    if (!isPositiveInt(price)) throw validation('가격은 1원 이상의 정수로 입력해 주세요.')
    // 새로 생기는 주문부터 적용된다. 이미 만든 주문은 주문 당시 금액을 유지한다.
    product.price = price
    persist()
    return toAdminProduct(product)
  },

  async setStock(productId, { stock, expectedStock }) {
    await simulateNetwork('write')
    const product = findProduct(productId)
    if (product.status === 'DRAFT') throw new ApiError('INVALID_STATE', '판매 설정 전 상품이에요.')
    if (!isNonNegativeInt(stock)) throw validation('재고는 0 이상의 정수로 입력해 주세요.')
    // 화면을 연 뒤 주문 등으로 재고가 달라졌다면 과거 값으로 덮어쓰지 않는다.
    if (product.stock !== expectedStock) {
      throw new ApiError('CONFLICT', '재고가 그 사이 변경되었어요. 최신 재고를 확인해 주세요.', { currentStock: product.stock })
    }
    product.stock = stock
    syncSoldOut(product)
    persist()
    return toAdminProduct(product)
  },

  async changeSaleStatus(productId, action) {
    await simulateNetwork('write')
    const product = findProduct(productId)
    if (action === 'START_SALE') {
      if (product.status !== 'READY') throw new ApiError('INVALID_STATE', '판매 준비 상태의 상품만 판매를 시작할 수 있어요.')
      if (!product.hasImage) throw validation('대표 이미지가 등록되어야 판매를 시작할 수 있어요.')
      if ((product.stock ?? 0) < 1) throw validation('판매 가능한 재고가 있어야 판매를 시작할 수 있어요.')
      product.status = 'SELLING'
    } else if (action === 'HIDE') {
      if (!isPublic(product)) throw new ApiError('INVALID_STATE', '판매 중이거나 품절인 상품만 비공개로 바꿀 수 있어요.')
      product.status = 'HIDDEN' // 삭제 대신 비공개로 신규 주문을 막는다. 기존 주문은 그대로.
    } else {
      if (product.status !== 'HIDDEN') throw new ApiError('INVALID_STATE', '비공개 상품만 공개를 재개할 수 있어요.')
      product.status = (product.stock ?? 0) > 0 ? 'SELLING' : 'SOLD_OUT'
    }
    persist()
    return toAdminProduct(product)
  },
}

const checkLive = (input: LiveInput, { requireFuture }: { requireFuture: boolean }) => {
  const title = input.title.trim()
  const description = input.description.trim()
  if (!title) throw validation('방송 제목을 입력해 주세요.')
  if (title.length > LIVE_TITLE_MAX) throw validation(`방송 제목은 ${LIVE_TITLE_MAX}자 이하로 입력해 주세요.`)
  if (description.length > LIVE_DESCRIPTION_MAX) throw validation(`방송 설명은 ${LIVE_DESCRIPTION_MAX}자 이하로 입력해 주세요.`)
  if (!input.scheduledAt || Number.isNaN(+new Date(input.scheduledAt))) throw validation('예정 시작 시각을 올바르게 입력해 주세요.')
  // 신규 예약은 과거 시각을 허용하지 않는다. (이미 시각이 지난 방송을 "시작"하는 것은 허용)
  if (requireFuture && +new Date(input.scheduledAt) <= Date.now()) throw validation('예정 시작 시각은 현재보다 이후여야 해요.')
  const playbackUrl = input.playbackUrl.trim()
  if (!playbackUrl) throw validation('시청 연결 정보를 입력해 주세요.')
  if (!/^https?:\/\//i.test(playbackUrl)) throw validation('시청 연결 정보는 http(s):// 로 시작하는 재생 주소여야 해요.')
  return { title, description, playbackUrl }
}

const requireReady = (live: StoredLive) => {
  if (live.status !== 'READY') throw new ApiError('INVALID_STATE', '준비 중인 방송만 수정할 수 있어요.')
}

export const mockAdminLivesApi: AdminLivesPort = {
  list: (params) => mockLivesApi.list(params),

  async get(liveId) {
    await simulateNetwork('read')
    return structuredClone(toAdminLive(findLive(liveId)))
  },

  async create(input) {
    await simulateNetwork('write')
    const { title, description, playbackUrl } = checkLive(input, { requireFuture: true })
    const live: StoredLive = {
      id: db.nextLiveId(),
      title,
      description,
      thumbnailUrl: null,
      status: 'READY',
      scheduledAt: new Date(input.scheduledAt).toISOString(),
      startedAt: null,
      endedAt: null,
      hostName: '내 방송',
      playbackUrl,
      version: 1,
      productIds: [],
    }
    db.lives.push(live)
    persist()
    return structuredClone(toAdminLive(live))
  },

  async update(liveId, input) {
    await simulateNetwork('write')
    const live = findLive(liveId)
    if (live.version !== input.version) throw new ApiError('CONFLICT', '다른 곳에서 먼저 수정되었어요. 최신 내용을 확인해 주세요.')
    requireReady(live)
    const changedTime = +new Date(input.scheduledAt) !== +new Date(live.scheduledAt)
    const { title, description, playbackUrl } = checkLive(input, { requireFuture: changedTime })
    live.title = title
    live.description = description
    live.playbackUrl = playbackUrl
    live.scheduledAt = new Date(input.scheduledAt).toISOString()
    live.version += 1
    persist()
    return structuredClone(toAdminLive(live))
  },

  async linkProduct(liveId, productId) {
    await simulateNetwork('write')
    const live = findLive(liveId)
    requireReady(live)
    const product = findProduct(productId)
    if (!isPublic(product)) throw validation('판매 중이거나 품절인 공개 상품만 연결할 수 있어요.')
    if (live.productIds.includes(productId)) throw validation('이미 이 방송에 연결된 상품이에요.')
    live.productIds.push(productId) // 연결만 관리한다. 상품을 복제하거나 재고를 바꾸지 않는다.
    live.version += 1
    persist()
    return structuredClone(toAdminLive(live))
  },

  async unlinkProduct(liveId, productId) {
    await simulateNetwork('write')
    const live = findLive(liveId)
    requireReady(live)
    live.productIds = live.productIds.filter((id) => id !== productId) // 상품·기존 주문은 삭제되지 않는다.
    live.version += 1
    persist()
    return structuredClone(toAdminLive(live))
  },

  async reorderProducts(liveId, productIds) {
    await simulateNetwork('write')
    const live = findLive(liveId)
    if (live.status === 'ENDED') throw new ApiError('INVALID_STATE', '종료된 방송의 순서는 수정할 수 없어요.')
    const same =
      productIds.length === live.productIds.length &&
      new Set(productIds).size === productIds.length &&
      productIds.every((id) => live.productIds.includes(id))
    // 그 사이 연결 구성이 바뀌었다면 최신 구성을 다시 확인하게 한다.
    if (!same) throw new ApiError('CONFLICT', '연결된 상품 구성이 달라졌어요. 최신 목록을 확인해 주세요.')
    live.productIds = [...productIds]
    live.version += 1
    persist()
    return structuredClone(toAdminLive(live))
  },

  async start(liveId) {
    await simulateNetwork('write')
    const live = findLive(liveId)
    if (live.status === 'LIVE') return structuredClone(toAdminLive(live)) // 반복 요청으로 시작 기록이 또 생기지 않는다.
    if (live.status === 'ENDED') throw new ApiError('INVALID_STATE', '종료된 방송은 다시 시작할 수 없어요.')
    if (!live.playbackUrl) throw validation('영상 시청 연결 정보가 준비되어야 시작할 수 있어요.')
    const sellable = live.productIds
      .map((id) => db.products.find((p) => p.id === id))
      .some((p) => p && p.status === 'SELLING' && (p.stock ?? 0) > 0)
    if (!sellable) throw validation('판매 가능한 연결 상품이 1개 이상 있어야 시작할 수 있어요.')
    live.status = 'LIVE'
    live.startedAt = new Date().toISOString()
    live.version += 1
    persist()
    return structuredClone(toAdminLive(live))
  },

  async end(liveId) {
    await simulateNetwork('write')
    const live = findLive(liveId)
    if (live.status === 'ENDED') return structuredClone(toAdminLive(live)) // 같은 종료 결과를 유지한다.
    if (live.status === 'READY') throw new ApiError('INVALID_STATE', '준비 중인 방송은 종료할 수 없어요.')
    // 방송 종료는 판매 상태·기존 주문·이후 구매에 영향을 주지 않는다.
    live.status = 'ENDED'
    live.endedAt = new Date().toISOString()
    live.version += 1
    persist()
    return structuredClone(toAdminLive(live))
  },
}
