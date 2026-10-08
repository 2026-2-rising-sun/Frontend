import type { CartSelection, CartCheckout, PaymentGroup } from './types'
import type { AuthPort } from './auth'
import type { AdminLive, AdminProduct, AdminProductListParams, CreateOrderInput, LiveInput, LiveDetail, LiveStatus, LiveSummary, Order, PageParams, Paged, Product, ProductBasicInput, ProductListParams, SaleAction, SaleInfoInput } from './types'
export interface ChatMessage { messageId: string; broadcastId: number; displayName: string; content: string; createdAt: string }
export interface LikeTotal { broadcastId: number; total: number; version: number }
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
  eventsUrl(id: string): string
}
export interface OrdersPort {
  checkout(id: string, quantity: number): Promise<{ unitPrice: number; totalAmount: number; orderable: boolean; reason: string | null }>
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
  checkout(items: CartSelection[]): Promise<CartCheckout>
  order(input: { items: CartSelection[]; buyerName: string; buyerPhone: string; expectedTotalAmount: number; idempotencyKey: string }): Promise<PaymentGroup>
  list(): Promise<CartItem[]>
  add(productId: string, quantity: number): Promise<CartItem>
  update(id: string, quantity: number): Promise<CartItem>
  remove(id: string): Promise<void>
}
export interface AdminProductsPort {
  list(params?: AdminProductListParams): Promise<Paged<AdminProduct>>
  get(id: string): Promise<AdminProduct>
  create(input: ProductBasicInput & { idempotencyKey: string }): Promise<AdminProduct>
  updateBasicInfo(id: string, input: ProductBasicInput & { version: number }): Promise<AdminProduct>
  setSaleInfo(id: string, input: SaleInfoInput): Promise<AdminProduct>
  changePrice(id: string, price: number): Promise<AdminProduct>
  adjustStock(id: string, delta: number): Promise<AdminProduct>
  changeSaleStatus(id: string, action: SaleAction): Promise<AdminProduct>
}
export interface AdminLivesPort {
  list(params?: PageParams & { status?: LiveStatus }): Promise<Paged<LiveSummary>>
  get(id: string): Promise<AdminLive>
  create(input: LiveInput & { idempotencyKey: string }): Promise<AdminLive>
  update(id: string, input: LiveInput & { version: number }): Promise<AdminLive>
  linkProduct(id: string, productId: string, version: number): Promise<AdminLive>
  unlinkProduct(id: string, linkId: string, version: number): Promise<AdminLive>
  reorderProducts(id: string, linkIds: string[], version: number): Promise<AdminLive>
  start(id: string, version: number): Promise<AdminLive>
  end(id: string): Promise<AdminLive>
}
export interface Api {
  auth: AuthPort; products: ProductsPort; lives: LivesPort; orders: OrdersPort; payments: PaymentsPort; cart: CartPort; paymentGroups: PaymentGroupsPort
  admin: { products: AdminProductsPort; lives: AdminLivesPort }
}
