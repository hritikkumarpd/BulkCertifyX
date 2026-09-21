import { supabaseAdmin } from '../lib/supabase.js';
import { ok } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('org_id', req.org.id)
      .or(`user_id.is.null,user_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })
      .limit(30);
    const unread = (data || []).filter((n) => !n.read_at).length;
    return ok(res, { notifications: data || [], unread });
  }),

  markRead: asyncHandler(async (req, res) => {
    await supabaseAdmin.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('org_id', req.org.id);
    return ok(res, { read: true });
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await supabaseAdmin.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('org_id', req.org.id)
      .is('read_at', null)
      .or(`user_id.is.null,user_id.eq.${req.user.id}`);
    return ok(res, { read: true });
  }),
};
