import { supabaseAdmin } from '@/lib/supabase'

export function logAuditEvent(params: {
  adminId: string
  adminEmail: string
  action: string
  targetType?: string
  targetId?: string
  targetName?: string
  metadata?: Record<string, unknown>
}) {
  // fire-and-forget — never block the main action on audit logging
  supabaseAdmin.from('superadmin_audit_log').insert({
    admin_id:    params.adminId,
    admin_email: params.adminEmail,
    action:      params.action,
    target_type: params.targetType ?? null,
    target_id:   params.targetId ?? null,
    target_name: params.targetName ?? null,
    metadata:    params.metadata ?? {},
  }).then()
}
