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
    registerBroadcast: id => request('/notification/v1/broadcast-alerts', { method: 'POST', body: { broadcastId: Number(id) }, responseType: 'empty' }),
    unregisterBroadcast: id => request(`/notification/v1/broadcast-alerts/${encodeURIComponent(id)}`, { method: 'DELETE', responseType: 'empty' }),
    registerRestock: id => request('/notification/v1/restock-alerts', { method: 'POST', body: { productId: Number(id) }, responseType: 'empty' }),
    unregisterRestock: id => request(`/notification/v1/restock-alerts/${encodeURIComponent(id)}`, { method: 'DELETE', responseType: 'empty' }),
  }
}
