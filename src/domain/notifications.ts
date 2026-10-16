export interface Notification {
  id: string
  eventType: string
  title: string
  body: string
  linkType: 'BROADCAST' | 'PRODUCT' | 'PAYMENT_GROUP' | 'REFUND' | 'COUPON' | null
  linkValue: string | null
  occurredAt: string
  readAt: string | null
}
export interface NotificationPage { items: Notification[]; nextCursor: string | null; hasNext: boolean }
export type AlertKind = 'broadcast' | 'restock'
export interface AlertSubscription { targetId: string; createdAt: string }
export interface AlertSubscriptionPage { items: AlertSubscription[]; nextCursor: string | null; hasNext: boolean }
export interface NotificationsPort {
  subscriptionState(kind: AlertKind, id: string): Promise<boolean>
  subscriptions(kind: AlertKind, cursor?: string | null): Promise<AlertSubscriptionPage>
  list(cursor?: string | null): Promise<NotificationPage>
  unreadCount(): Promise<number>
  read(id: string): Promise<void>
  registerBroadcast(id: string): Promise<void>
  unregisterBroadcast(id: string): Promise<void>
  registerRestock(id: string): Promise<void>
  unregisterRestock(id: string): Promise<void>
}
export function notificationTarget(item: Notification): string | null {
  const value = item.linkValue
  if (!value) return null
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  if (item.linkType === 'COUPON' && value.trim().length > 0 && value.length <= 36) return '/coupons'
  if (item.linkType === 'PAYMENT_GROUP' && new RegExp(`^PG-${uuid}$`).test(value)) return `/payment-groups/${value}`
  if (item.linkType === 'REFUND') {
    const match = new RegExp(`^(PG-${uuid})/([1-9]\\d*)$`).exec(value)
    return match ? `/payment-groups/${match[1]}/refunds/${match[2]}` : null
  }
  if (!/^[1-9]\d*$/.test(value)) return null
  if (item.linkType === 'BROADCAST') return `/lives/${value}`
  if (item.linkType === 'PRODUCT') return `/products/${value}`
  return null
}
