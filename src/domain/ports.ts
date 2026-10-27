import type { RefundsPort } from './refunds'
import type { CartSelection, CartCheckout, PaymentGroup } from './types'
import type { CouponsPort, SellerCouponsPort } from './coupons'
import type { AuthPort } from './auth'
import type { NotificationsPort } from './notifications'
import type { PromotionsPort } from './promotions'
import type { SellerLive, SellerProduct, SellerProductListParams, CreateOrderInput, LiveInput, LiveDetail, LiveStatus, LiveSummary, Order, PageParams, Paged, Product, ProductBasicInput, ProductListParams, SaleAction, SaleInfoInput } from './types'
export interface ChatMessage { messageId: string; broadcastId: number; displayName: string; content: string; createdAt: string }
export interface LikeTotal { broadcastId: number; total: number; version: number }
export interface ViewerTotal { broadcastId: number; total: number; measuredAt: string; expiresAfterSeconds: number }
export interface MyLike extends LikeTotal { liked: boolean; stateVersion: number }
export interface CartItem { id: string; productId: string; quantity: number; version: number }
export interface ProductsPort {
  list(params?: ProductListParams): Promise<Paged<Product>>
  get(id: string): Promise<Product>
  check(id: string, quantity: number): Promise<{ orderable: boolean; reason: string | null; maxQuantity: number; unitPrice: number }>
}
export interface LivesPort {
  list(params?: PageParams & { status?: LiveStatus }): Promise<Paged<LiveSummary>>
  get(id: string): Promise<LiveDetail>
  listProducts(id: string): Promise<Product[]>
  chats(id: string): Promise<ChatMessage[]>
  sendChat(id: string, content: string): Promise<ChatMessage>
  likes(id: string): Promise<LikeTotal>
  myLike(id: string): Promise<MyLike>
  setLike(id: string, liked: boolean, idempotencyKey: string): Promise<MyLike>
  viewerCount(id: string): Promise<ViewerTotal>
  heartbeatViewer(id: string, viewerId: string): Promise<ViewerTotal>
  eventsUrl(id: string): string
}
export interface OrdersPort {
  checkout(id: string, quantity: number, couponId?: string): Promise<{ unitPrice: number; totalAmount: number; orderable: boolean; reason: string | null; discountAmount?: number; payableAmount?: number; couponId?: string | null }>
  create(input: CreateOrderInput): Promise<Order>
  list(params?: PageParams): Promise<Paged<Order>>
  lookup(number: string): Promise<Order>
  cancel(number: string): Promise<Order>
}
export interface PaymentsPort {
  start(number: string): Promise<{ paymentId: string; status: string }>
  get(number: string, paymentId: string): Promise<{ paymentId: string; status: string }>
}
export interface PaymentGroupsPort {
  active(): Promise<PaymentGroup | null>
  get(number: string): Promise<PaymentGroup>
  start(number: string, key: string): Promise<{ paymentId: string; status: string }>
  payment(number: string, paymentId: string): Promise<{ paymentId: string; status: string }>
  cancel(number: string): Promise<void>
}
export interface CartPort {
  checkout(items: CartSelection[], couponId?: string): Promise<CartCheckout>
  order(input: { items: CartSelection[]; buyerName: string; buyerPhone: string; expectedTotalAmount: number; couponId?: string; idempotencyKey: string }): Promise<PaymentGroup>
  list(): Promise<CartItem[]>
  add(productId: string, quantity: number): Promise<CartItem>
  update(id: string, quantity: number): Promise<CartItem>
  remove(id: string): Promise<void>
}
export interface SellerProductsPort {
  list(params?: SellerProductListParams): Promise<Paged<SellerProduct>>
  get(id: string): Promise<SellerProduct>
  create(input: ProductBasicInput & { idempotencyKey: string }): Promise<SellerProduct>
  updateBasicInfo(id: string, input: ProductBasicInput & { version: number }): Promise<SellerProduct>
  setSaleInfo(id: string, input: SaleInfoInput): Promise<SellerProduct>
  changePrice(id: string, price: number): Promise<SellerProduct>
  adjustStock(id: string, delta: number): Promise<SellerProduct>
  changeSaleStatus(id: string, action: SaleAction): Promise<SellerProduct>
}
export interface SellerLivesPort {
  list(params?: PageParams & { status?: LiveStatus }): Promise<Paged<LiveSummary>>
  get(id: string): Promise<SellerLive>
  create(input: LiveInput & { idempotencyKey: string }): Promise<SellerLive>
  update(id: string, input: LiveInput & { version: number }): Promise<SellerLive>
  linkProduct(id: string, productId: string, version: number): Promise<SellerLive>
  unlinkProduct(id: string, linkId: string, version: number): Promise<SellerLive>
  reorderProducts(id: string, linkIds: string[], version: number): Promise<SellerLive>
  start(id: string, version: number): Promise<SellerLive>
  end(id: string): Promise<SellerLive>
}
export interface Api {
  auth: AuthPort
  promotions: PromotionsPort
  refunds: RefundsPort
  notifications: NotificationsPort; coupons: CouponsPort; products: ProductsPort; lives: LivesPort; orders: OrdersPort; payments: PaymentsPort; cart: CartPort; paymentGroups: PaymentGroupsPort
  seller: { products: SellerProductsPort; lives: SellerLivesPort; coupons: SellerCouponsPort }
}
