export interface Notification {
  id: string
  eventType: string
  title: string
  body: string
  linkType: 'BROADCAST' | 'PRODUCT' | null
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
  if (!item.linkValue || !/^[1-9]\d*$/.test(item.linkValue)) return null
  if (item.linkType === 'BROADCAST') return `/lives/${item.linkValue}`
  if (item.linkType === 'PRODUCT') return `/products/${item.linkValue}`
  return null
}
