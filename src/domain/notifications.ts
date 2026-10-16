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
export interface NotificationsPort {
  list(cursor?: string | null): Promise<NotificationPage>
  unreadCount(): Promise<number>
  read(id: string): Promise<void>
}
export function notificationTarget(item: Notification): string | null {
  if (!item.linkValue || !/^[1-9]\d*$/.test(item.linkValue)) return null
  if (item.linkType === 'BROADCAST') return `/lives/${item.linkValue}`
  if (item.linkType === 'PRODUCT') return `/products/${item.linkValue}`
  return null
}
