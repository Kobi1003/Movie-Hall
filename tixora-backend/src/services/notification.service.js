import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  static async createNotification({ userId, type, title, message, entityType = null, entityId = null }) {
    const id = uuidv4();
    const notification = {
      id, user_id: userId, type, title, message,
      entity_type: entityType, entity_id: entityId,
      is_read: false, created_at: new Date().toISOString()
    };
    const { error } = await supabaseAdmin.from('notifications').insert(notification);
    if (error) logger.warn('Failed to insert notification to Supabase', error.message);
    memoryStore.notifications.set(id, notification);
    return notification;
  }

  static async getUserNotifications(userId) {
    const { data } = await supabaseAdmin.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    const notifMap = new Map();
    (data || []).forEach(n => notifMap.set(n.id, n));
    for (const n of memoryStore.notifications.values()) {
      if (n.user_id === userId) notifMap.set(n.id, n);
    }
    const list = Array.from(notifMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (list.length === 0) {
      const welcome = await this.createNotification({
        userId,
        type: 'BOOKING_CONFIRMED',
        title: 'Welcome to TIXORA!',
        message: 'Your account is ready. Explore active screenings and book real-time reserved seats.'
      });
      return [welcome];
    }
    return list;
  }

  static async markAsRead(notificationId, userId) {
    await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', userId);
    const notif = memoryStore.notifications.get(notificationId);
    if (notif && notif.user_id === userId) notif.is_read = true;
    return notif;
  }

  static async markAllAsRead(userId) {
    await supabaseAdmin.from('notifications').update({ is_read: true }).eq('user_id', userId);
    for (const notif of memoryStore.notifications.values()) {
      if (notif.user_id === userId) notif.is_read = true;
    }
    return true;
  }
}
