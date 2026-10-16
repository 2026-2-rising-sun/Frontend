export interface AvailableCoupon { id: string; name: string; fixedDiscount: number; remaining: number; endsAt: string; expiresAt: string }
export interface MemberCoupon { id: string; couponId: string; name: string; fixedDiscount: number; status: 'AVAILABLE' | 'RESERVED' | 'USED' | 'EXPIRED'; claimedAt: string; expiresAt: string }
export interface ProductCoupon { couponId: string; name: string; fixedDiscount: number; startsAt: string; endsAt: string; expiresAt: string; soldOut: boolean }
export interface CouponSettings { name: string; fixedDiscount: number; issuanceLimit: number; startsAt: string; endsAt: string; expiresAt: string; productIds: number[] }
export interface SellerCoupon extends CouponSettings { id: string; sellerId: string; issuedCount: number; version: number }
export interface CouponsPort {
  available(page?: number): Promise<AvailableCoupon[]>
  mine(page?: number): Promise<MemberCoupon[]>
  claim(id: string): Promise<MemberCoupon>
  product(productId: string): Promise<ProductCoupon[]>
}
export interface SellerCouponsPort {
  list(page?: number): Promise<{ items: SellerCoupon[]; page: number; size: number; totalElements: number }>
  get(id: string): Promise<SellerCoupon>
  create(settings: CouponSettings): Promise<SellerCoupon>
  update(id: string, version: number, settings: CouponSettings): Promise<SellerCoupon>
}
export const couponStatusLabel = { AVAILABLE: '사용 가능', RESERVED: '주문에 적용 중', USED: '사용 완료', EXPIRED: '기간 만료' }
