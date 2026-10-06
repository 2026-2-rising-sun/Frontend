import { createSellerProducts } from './sellerProducts'
import type { Api, CartItem, ChatMessage } from '../../domain/ports'
import type { AdminLive } from '../../domain/types'
import { createHttpAuth } from './auth'
import { product, live, page, order, type ProductDto, type LiveDto, type PageDto, type OrderDto } from './mappers'
const id = encodeURIComponent
export function createHttpApi(baseUrl: string, testAccounts = false): Api {
  const { auth, request } = createHttpAuth(baseUrl, testAccounts)
  const publicRequest: typeof request = (path, options) => request(path, { ...options, anonymous: true })
  type LivePage = { content: LiveDto[]; number: number; size: number; totalElements: number; totalPages: number }
  const livePage = (p: LivePage) => page({ ...p, items: p.content, page: p.number }, live)
  const liveProducts = async (n: string, admin = false) => (await (admin ? request : publicRequest)<ProductDto[]>(`/live/v1/${admin ? 'admin/' : ''}broadcasts/${id(n)}/products`)).map(product)
  const adminLive = async (n: string): Promise<AdminLive> => {
    const dto = await request<LiveDto>(`/live/v1/admin/broadcasts/${id(n)}`)
    return { ...live(dto), version: dto.version ?? 0, products: await liveProducts(n, true) }
  }
  const liveMutation = async (n: string, suffix: string, options: Parameters<typeof request>[1]) => { await request(`/live/v1/admin/broadcasts/${id(n)}${suffix}`, options); return adminLive(n) }
  const getOrder = async (n: string) => order(await request<OrderDto>(`/commerce/v1/orders/${id(n)}`))
  const cartItem = (c: CartItem) => ({ ...c, id: String(c.id), productId: String(c.productId) })
  return {
    auth,
    products: {
      async list(params) {
        const dto = await publicRequest<{ items: ProductDto[]; nextCursor: number | null; hasNext: boolean }>('/shopping/v1/products', { query: { cursor: params?.cursor, size: params?.size } })
        return { items: dto.items.map(product), nextCursor: dto.nextCursor === null ? null : String(dto.nextCursor), hasNext: dto.hasNext, page: params?.page ?? 0, size: params?.size ?? 12, totalCount: -1 }
      },
      get: async n => product(await publicRequest<ProductDto>(`/shopping/v1/products/${id(n)}`)),
      check: (n, quantity) => publicRequest(`/shopping/v1/products/${id(n)}/purchase-check`, { query: { quantity } }),
    },
    lives: {
      async list(params) {
        const result = livePage(await publicRequest<LivePage>('/live/v1/broadcasts', { query: { page: params?.page, size: params?.size } }))
        if (params?.status) result.items = result.items.filter(l => l.status === params.status)
        return result
      },
      get: async n => live(await publicRequest<LiveDto>(`/live/v1/broadcasts/${id(n)}`)),
      listProducts: n => liveProducts(n),
      chats: async n => (await publicRequest<ChatMessage[]>(`/live/v1/broadcasts/${id(n)}/chats`)).map(c => ({ ...c, messageId: String(c.messageId) })),
      sendChat: (n, content) => request(`/live/v1/broadcasts/${id(n)}/chats`, { method: 'POST', body: { content } }),
      likes: n => publicRequest(`/live/v1/broadcasts/${id(n)}/likes`),
      like: n => request(`/live/v1/broadcasts/${id(n)}/likes`, { method: 'POST' }),
      eventsUrl: n => `${baseUrl.replace(/\/$/, '')}/live/v1/broadcasts/${id(n)}/events`,
    },
    orders: {
      checkout: (n, quantity) => request('/commerce/v1/orders/checkout', { query: { productId: n, quantity } }),
      async create(input) {
        const body = { buyerName: input.ordererName, buyerPhone: input.ordererPhone, expectedTotalAmount: input.expectedUnitPrice * input.quantity }
        const path = input.cartItemId ? `/commerce/v1/cart/items/${id(input.cartItemId)}/orders` : '/commerce/v1/orders'
        return order(await request<OrderDto>(path, { method: 'POST', headers: { 'X-Idempotency-Key': input.idempotencyKey }, body: input.cartItemId ? body : { ...body, productId: Number(input.productId), quantity: input.quantity } }))
      },
      list: async params => page(await request<PageDto<OrderDto>>('/commerce/v1/orders', { query: { page: params?.page, size: params?.size } }), order),
      lookup: getOrder,
      async cancel(n) { await request(`/commerce/v1/orders/${id(n)}/cancel`, { method: 'POST' }); return getOrder(n) },
    },
    payments: {
      start: n => request(`/commerce/v1/orders/${id(n)}/payments`, { method: 'POST', body: {} }),
      get: (n, p) => request(`/commerce/v1/orders/${id(n)}/payments/${id(p)}`),
    },
    cart: {
      list: async () => (await request<CartItem[]>('/commerce/v1/cart/items')).map(cartItem),
      add: async (n, quantity) => cartItem(await request('/commerce/v1/cart/items', { method: 'POST', body: { productId: Number(n), quantity } })),
      update: async (n, quantity) => cartItem(await request(`/commerce/v1/cart/items/${id(n)}`, { method: 'PATCH', body: { quantity } })),
      remove: n => request(`/commerce/v1/cart/items/${id(n)}`, { method: 'DELETE' }),
    },
    admin: {
      products: createSellerProducts(request, () => auth.getSession()?.memberId),
      lives: {
        list: async params => livePage(await request('/live/v1/admin/broadcasts', { query: { page: params?.page, size: params?.size, status: params?.status === 'READY' ? 'PREPARING' : params?.status } })),
        get: adminLive,
        async create({ idempotencyKey, ...input }) { const result = await request<LiveDto>('/live/v1/admin/broadcasts', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: input }); return adminLive(String(result.id)) },
        update: (n, { version, ...input }) => liveMutation(n, '', { method: 'PATCH', query: { version }, body: input }),
        linkProduct: (n, p, version) => liveMutation(n, '/products', { method: 'POST', body: { productId: Number(p), expectedVersion: version } }),
        unlinkProduct: (n, p, version) => liveMutation(n, `/products/${id(p)}`, { method: 'DELETE', query: { expectedVersion: version } }),
        reorderProducts: (n, links, version) => liveMutation(n, '/products/order', { method: 'PUT', body: { linkIds: links.map(Number), expectedVersion: version } }),
        start: (n, version) => liveMutation(n, '/start', { method: 'POST', query: { expectedVersion: version } }),
        end: n => liveMutation(n, '/end', { method: 'POST' }),
      },
    },
  }
}
