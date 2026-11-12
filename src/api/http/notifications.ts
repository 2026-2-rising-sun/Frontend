import type { Notification, NotificationPage, NotificationsPort, AlertSubscriptionPage } from '../../domain/notifications'
import type { HttpClient } from './client'
type NotificationDto = Omit<Notification, 'id'> & { id: string | number }
export function createNotifications(request: HttpClient): NotificationsPort {
  return {
    async subscriptionState(kind, id) {
      return (await request<{ subscribed: boolean }>(`/notification/v1/${kind === 'broadcast' ? 'broadcast' : 'restock'}-alerts/${encodeURIComponent(id)}`)).subscribed
    },
    async subscriptions(kind, cursor) {
      const page = await request<Omit<AlertSubscriptionPage, 'items'> & { items: { targetId: string | number; createdAt: string }[] }>(`/notification/v1/${kind === 'broadcast' ? 'broadcast' : 'restock'}-alerts`, { query: { cursor, size: 20 } })
      return { ...page, items: page.items.map(item => ({ ...item, targetId: String(item.targetId) })) }
    },
    async list(cursor) {
      const page = await request<Omit<NotificationPage, 'items'> & { items: NotificationDto[] }>('/notification/v1/notifications', { query: { cursor, size: 20 } })
      return { ...page, items: page.items.map(item => ({ ...item, id: String(item.id) })) }
    },
    async unreadCount() { return (await request<{ unreadCount: number }>('/notification/v1/notifications/unread-count')).unreadCount },
    readAll: () => request('/notification/v1/notifications/read-all', { method: 'POST', responseType: 'empty' }),
    read: id => request(`/notification/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', responseType: 'empty' }),
    registerBroadcast: id => request('/notification/v1/broadcast-alerts', { method: 'POST', body: { broadcastId: Number(id) }, responseType: 'empty' }),
    unregisterBroadcast: id => request(`/notification/v1/broadcast-alerts/${encodeURIComponent(id)}`, { method: 'DELETE', responseType: 'empty' }),
    registerRestock: id => request('/notification/v1/restock-alerts', { method: 'POST', body: { productId: Number(id) }, responseType: 'empty' }),
    unregisterRestock: id => request(`/notification/v1/restock-alerts/${encodeURIComponent(id)}`, { method: 'DELETE', responseType: 'empty' }),
  }
}
