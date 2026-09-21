import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { auditService } from '../services/auditService.js';

const upsertSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).nullish(),
  event_date: z.string().nullish(),
  template_id: z.string().uuid().nullish(),
  issued_by: z.string().max(150).nullish(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export const eventController = {
  list: asyncHandler(async (req, res) => {
    // Include certificate counts per event (batched to prevent N+1 queries).
    const { data: events } = await supabaseAdmin
      .from('events').select('*').eq('org_id', req.org.id).order('created_at', { ascending: false });

    if (!events?.length) return ok(res, []);

    const eventIds = events.map((e) => e.id);
    const { data: certs } = await supabaseAdmin
      .from('certificates')
      .select('event_id')
      .eq('org_id', req.org.id)
      .in('event_id', eventIds);

    const counts = {};
    for (const c of certs || []) {
      if (c.event_id) counts[c.event_id] = (counts[c.event_id] || 0) + 1;
    }

    const withCounts = events.map((e) => ({
      ...e,
      certificate_count: counts[e.id] || 0,
    }));
    return ok(res, withCounts);
  }),

  get: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('events').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!data) throw Errors.notFound('Event not found.');
    return ok(res, data);
  }),

  create: asyncHandler(async (req, res) => {
    const body = upsertSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('events').insert({ ...body, org_id: req.org.id, created_by: req.user.id }).select().single();
    if (error) throw Errors.internal('Failed to create event.');
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'event.created', resourceType: 'event', resourceId: data.id });
    return created(res, data);
  }),

  update: asyncHandler(async (req, res) => {
    const body = upsertSchema.partial().parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('events').update(body).eq('id', req.params.id).eq('org_id', req.org.id).select().single();
    if (error || !data) throw Errors.notFound('Event not found.');
    return ok(res, data);
  }),

  duplicate: asyncHandler(async (req, res) => {
    const { data: src } = await supabaseAdmin
      .from('events').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!src) throw Errors.notFound('Event not found.');
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({ org_id: req.org.id, name: `${src.name} (copy)`, description: src.description, template_id: src.template_id, issued_by: src.issued_by, status: 'draft', created_by: req.user.id })
      .select().single();
    if (error) throw Errors.internal('Failed to duplicate event.');
    return created(res, data);
  }),

  archive: asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('events').update({ status: 'archived' }).eq('id', req.params.id).eq('org_id', req.org.id).select().single();
    if (error || !data) throw Errors.notFound('Event not found.');
    return ok(res, data);
  }),
};
