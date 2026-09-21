import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { usageService } from '../services/usageService.js';
import { auditService } from '../services/auditService.js';
import { renderService } from '../services/renderService.js';
import { qrService } from '../services/qrService.js';

const elementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'logo', 'qr', 'line', 'signature']),
  x: z.number(), y: z.number(),
  width: z.number().optional(), height: z.number().optional(),
  rotation: z.number().optional(),
  text: z.string().optional(),
  src: z.string().optional(),
  fontFamily: z.string().optional(), fontSize: z.number().optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  color: z.string().optional(), align: z.string().optional(),
  lineHeight: z.number().optional(), letterSpacing: z.number().optional(),
  italic: z.boolean().optional(), thickness: z.number().optional(), style: z.string().optional(),
}).passthrough();

const designSchema = z.object({
  background: z.string().optional(),
  backgroundImage: z.string().optional(),
  elements: z.array(elementSchema).default([]),
});

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  page_size: z.enum(['a4-landscape', 'a4-portrait', 'letter-landscape', 'letter-portrait']).default('a4-landscape'),
  design: designSchema.optional(),
  is_published: z.boolean().optional(),
});

export const templateController = {
  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('templates').select('*').eq('org_id', req.org.id).order('updated_at', { ascending: false });
    return ok(res, data || []);
  }),

  get: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('templates').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!data) throw Errors.notFound('Template not found.');
    return ok(res, data);
  }),

  create: asyncHandler(async (req, res) => {
    await usageService.assertTemplateAllowed(req.org.id);
    const body = upsertSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('templates')
      .insert({ ...body, org_id: req.org.id, created_by: req.user.id })
      .select().single();
    if (error) throw Errors.internal('Failed to create template.');
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'template.created', resourceType: 'template', resourceId: data.id });
    return created(res, data);
  }),

  update: asyncHandler(async (req, res) => {
    const body = upsertSchema.partial().parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('templates').update(body).eq('id', req.params.id).eq('org_id', req.org.id).select().single();
    if (error || !data) throw Errors.notFound('Template not found.');
    return ok(res, data);
  }),

  duplicate: asyncHandler(async (req, res) => {
    await usageService.assertTemplateAllowed(req.org.id);
    const { data: src } = await supabaseAdmin
      .from('templates').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!src) throw Errors.notFound('Template not found.');
    const { data, error } = await supabaseAdmin
      .from('templates')
      .insert({ org_id: req.org.id, name: `${src.name} (copy)`, description: src.description, page_size: src.page_size, design: src.design, created_by: req.user.id })
      .select().single();
    if (error) throw Errors.internal('Failed to duplicate template.');
    return created(res, data);
  }),

  remove: asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin.from('templates').delete().eq('id', req.params.id).eq('org_id', req.org.id);
    if (error) throw Errors.internal('Failed to delete template.');
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'template.deleted', resourceType: 'template', resourceId: req.params.id });
    return ok(res, { deleted: true });
  }),

  // Server-rendered HTML preview with sample data — same renderer as the PDF.
  preview: asyncHandler(async (req, res) => {
    const { data: template } = await supabaseAdmin
      .from('templates').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!template) throw Errors.notFound('Template not found.');

    const sample = {
      recipient_name: 'John Doe',
      recipient_email: 'john@example.com',
      event_name: 'Full Stack Development',
      organization_name: 'BulkCertifyX Demo Organization',
      issued_by: 'BulkCertifyX Demo Organization',
      verification_code: 'CERT-A7K2-X9PQ',
      issue_date: new Date().toISOString().slice(0, 10),
      course_name: 'Full Stack Development',
      grade: 'A',
    };
    const qrDataUrl = await qrService.dataUrl(sample.verification_code);
    const html = renderService.buildHtml({ template, data: sample, qrDataUrl });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }),
};
