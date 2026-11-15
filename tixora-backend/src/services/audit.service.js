import { v4 as uuidv4 } from 'uuid';
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

    // Best-effort: try to persist to DB, fall back silently to in-memory
    try {
      const { error } = await supabaseAdmin.from('audit_logs').insert(logEntry);
      if (error) {
        // Table may not exist — store in memory and continue without crashing
        console.warn('[AuditService] audit_logs DB write skipped (falling back to memory):', error.message);
      }
    } catch (err) {
      console.warn('[AuditService] audit_logs DB write failed silently:', err.message);
    }

    memoryStore.auditLogs.set(id, logEntry);
    return logEntry;
  }

  static async getLogs({ entityType, entityId, limit = 50 }) {
    // Try DB first; fall back to in-memory if table doesn't exist
    try {
      let query = supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (_) {}

    // Fallback: return from in-memory store
    let entries = Array.from(memoryStore.auditLogs.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    if (entityType) entries = entries.filter(e => e.entity_type === entityType);
    if (entityId) entries = entries.filter(e => e.entity_id === entityId);
    return entries;
  }
}
