import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/errors.js';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';

export class AuditService {
  static async log({ actorUserId, actorRole, action, entityType, entityId, previousValue = null, newValue = null, reason = null, ipAddress = null, userAgent = null }) {
    const id = uuidv4();
    const logEntry = {
      id,
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action,
      entity_type: entityType,
      entity_id: entityId,
      previous_value: previousValue,
      new_value: newValue,
      reason,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    };
    const { error } = await supabaseAdmin.from('audit_logs').insert(logEntry);
    if (error) throw new AppError('Could not save the audit event', 503, 'DATABASE_UNAVAILABLE');
    memoryStore.auditLogs.set(id, logEntry);
    return logEntry;
  }

  static async getLogs({ entityType, entityId, limit = 50 }) {
    let query = supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    const { data, error } = await query;
    if (error) throw new AppError('Could not load audit events', 503, 'DATABASE_UNAVAILABLE');
    return data || [];
  }
}
