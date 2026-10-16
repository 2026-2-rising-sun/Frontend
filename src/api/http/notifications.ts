import type { Notification, NotificationPage, NotificationsPort } from '../../domain/notifications'
import type { HttpClient } from './client'
type NotificationDto = Omit<Notification, 'id'> & { id: string | number }
export function createNotifications(request: HttpClient): NotificationsPort {
  return {
    async list(cursor) {
      const page = await request<Omit<NotificationPage, 'items'> & { items: NotificationDto[] }>('/notification/v1/notifications', { query: { cursor, size: 20 } })
      return { ...page, items: page.items.map(item => ({ ...item, id: String(item.id) })) }
    },
    async unreadCount() { return (await request<{ unreadCount: number }>('/notification/v1/notifications/unread-count')).unreadCount },
    read: id => request(`/notification/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', responseType: 'empty' }),
  }
}
