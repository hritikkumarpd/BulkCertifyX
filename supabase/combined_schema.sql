-- ============================================================================
-- BulkCertifyX — 001 initial schema
-- Multi-tenant certificate platform. Organization is the primary tenant.
-- Row Level Security is enabled on every tenant-owned table.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive text

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type plan_tier        as enum ('free', 'starter', 'pro', 'enterprise');
create type member_role      as enum ('owner', 'admin', 'member');
create type member_status    as enum ('active', 'invited', 'suspended');
create type event_status     as enum ('draft', 'active', 'archived');
create type cert_status      as enum ('valid', 'revoked');   -- expired is derived from expires_at
create type bulk_status      as enum ('queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled');
create type subscription_status as enum ('active', 'past_due', 'cancelled', 'paused', 'incomplete');

-- ----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ----------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- organizations — the tenant
-- ----------------------------------------------------------------------------
create table organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           citext not null unique,
  logo_url       text,
  website        text,
  contact_email  citext,
  address        text,
  timezone       text not null default 'Asia/Kolkata',
  -- branding
  brand_name     text,
  brand_color    text not null default '#4F46E5',
  footer_text    text,
  white_label    boolean not null default false,
  -- billing snapshot (source of truth is subscriptions table + webhooks)
  plan           plan_tier not null default 'free',
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);
create trigger trg_orgs_updated before update on organizations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- organization_members — team + roles
-- ----------------------------------------------------------------------------
create table organization_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,   -- null until invite accepted
  email        citext not null,
  role         member_role not null default 'member',
  status       member_status not null default 'invited',
  invited_by   uuid references auth.users(id),
  invite_token text unique,                 -- single-use, hashed; cleared on accept
  invite_expires_at timestamptz,
  joined_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, email)
);
create index idx_members_org  on organization_members(org_id);
create index idx_members_user on organization_members(user_id);
create trigger trg_members_updated before update on organization_members
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Membership helper functions (used by RLS everywhere; SECURITY DEFINER to
-- avoid recursive RLS evaluation on organization_members).
-- ----------------------------------------------------------------------------
create or replace function is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function has_org_role(target_org uuid, roles member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(roles)
  );
$$;

-- ----------------------------------------------------------------------------
-- templates
-- ----------------------------------------------------------------------------
create table templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  description text,
  page_size   text not null default 'a4-landscape'
                check (page_size in ('a4-landscape','a4-portrait','letter-landscape','letter-portrait')),
  -- design is a JSON document of elements (text/image/logo/qr/line/signature)
  design      jsonb not null default '{"background":"#ffffff","elements":[]}',
  thumbnail_url text,
  is_published boolean not null default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_templates_org on templates(org_id);
create trigger trg_templates_updated before update on templates
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
create table events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  template_id  uuid references templates(id) on delete set null,
  name         text not null,
  description  text,
  event_date   date,
  issued_by    text,
  status       event_status not null default 'draft',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_events_org on events(org_id);
create trigger trg_events_updated before update on events
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- bulk_jobs
-- ----------------------------------------------------------------------------
create table bulk_jobs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  event_id      uuid references events(id) on delete set null,
  template_id   uuid references templates(id) on delete set null,
  status        bulk_status not null default 'queued',
  total_rows    integer not null default 0,
  processed     integer not null default 0,
  successful    integer not null default 0,
  failed        integer not null default 0,
  column_map    jsonb not null default '{}',
  zip_url       text,
  error_summary jsonb,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);
create index idx_bulk_org on bulk_jobs(org_id);
create index idx_bulk_status on bulk_jobs(org_id, status);

-- Individual rows of a bulk job (also drives retry of failed rows)
create table bulk_job_rows (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references bulk_jobs(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  row_index    integer not null,
  data         jsonb not null,              -- mapped field -> value
  status       text not null default 'pending' check (status in ('pending','success','failed')),
  error        text,
  certificate_id uuid,
  created_at   timestamptz not null default now()
);
create index idx_bulkrows_job on bulk_job_rows(job_id);
create index idx_bulkrows_status on bulk_job_rows(job_id, status);

-- ----------------------------------------------------------------------------
-- certificates
-- ----------------------------------------------------------------------------
create table certificates (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  event_id          uuid references events(id) on delete set null,
  template_id       uuid references templates(id) on delete set null,
  bulk_job_id       uuid references bulk_jobs(id) on delete set null,
  verification_code text not null unique,           -- e.g. CERT-A7K2-X9PQ
  recipient_name    text not null,
  recipient_email   citext,
  -- all merged variables (recipient_name, course_name, grade, ...)
  fields            jsonb not null default '{}',
  pdf_url           text,
  status            cert_status not null default 'valid',
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz,
  revoked_at        timestamptz,
  revoke_reason     text,
  verification_count integer not null default 0,
  email_status      text default 'not_sent'
                      check (email_status in ('not_sent','queued','sent','failed')),
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);
create index idx_certs_org on certificates(org_id);
create index idx_certs_event on certificates(event_id);
create index idx_certs_code on certificates(verification_code);   -- fast public verify
create index idx_certs_email on certificates(org_id, recipient_email);

-- Public verification log (append-only)
create table verification_logs (
  id           uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references certificates(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  verified_at  timestamptz not null default now(),
  user_agent   text,
  referer      text
);
create index idx_veriflog_cert on verification_logs(certificate_id);
create index idx_veriflog_org on verification_logs(org_id, verified_at);

-- ----------------------------------------------------------------------------
-- api_keys — full key shown once, only hash stored
-- ----------------------------------------------------------------------------
create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,               -- first chars, shown in UI
  key_hash     text not null,               -- sha256 of full key
  permissions  text[] not null default array['certificates:read','verify:read'],
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index idx_apikeys_org on api_keys(org_id);
create unique index idx_apikeys_hash on api_keys(key_hash);

-- ----------------------------------------------------------------------------
-- custom_domains
-- ----------------------------------------------------------------------------
create table custom_domains (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  hostname       citext not null unique,           -- global uniqueness prevents hijack
  verification_token text not null,
  verified       boolean not null default false,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index idx_domains_org on custom_domains(org_id);

-- ----------------------------------------------------------------------------
-- subscriptions — mirrors Razorpay, updated only by verified webhooks
-- ----------------------------------------------------------------------------
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organizations(id) on delete cascade unique,
  plan                   plan_tier not null default 'free',
  status                 subscription_status not null default 'active',
  billing_cycle          text check (billing_cycle in ('monthly','annual')),
  razorpay_customer_id   text,
  razorpay_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger trg_subs_updated before update on subscriptions
  for each row execute function set_updated_at();

-- Billing history / invoices
create table billing_events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  razorpay_event_id text unique,        -- idempotency for webhooks
  type         text not null,
  amount       integer,                 -- paise
  currency     text default 'INR',
  status       text,
  invoice_url  text,
  raw          jsonb,
  created_at   timestamptz not null default now()
);
create index idx_billing_org on billing_events(org_id, created_at);

-- ----------------------------------------------------------------------------
-- usage_counters — per org per month, for atomic quota reservation
-- ----------------------------------------------------------------------------
create table usage_counters (
  org_id        uuid not null references organizations(id) on delete cascade,
  period        text not null,           -- 'YYYY-MM'
  certificates  integer not null default 0,
  emails        integer not null default 0,
  primary key (org_id, period)
);

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,   -- null = whole org
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifs_user on notifications(user_id, read_at);
create index idx_notifs_org on notifications(org_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles              enable row level security;
alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table templates             enable row level security;
alter table events                enable row level security;
alter table bulk_jobs             enable row level security;
alter table bulk_job_rows         enable row level security;
alter table certificates          enable row level security;
alter table verification_logs     enable row level security;
alter table api_keys              enable row level security;
alter table custom_domains        enable row level security;
alter table subscriptions         enable row level security;
alter table billing_events        enable row level security;
alter table usage_counters        enable row level security;
alter table notifications         enable row level security;

-- profiles: users manage their own
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members read; owners/admins update; creator inserts
create policy orgs_read   on organizations for select using (is_org_member(id));
create policy orgs_insert on organizations for insert with check (created_by = auth.uid());
create policy orgs_update on organizations for update using (has_org_role(id, array['owner','admin']::member_role[]));
create policy orgs_delete on organizations for delete using (has_org_role(id, array['owner']::member_role[]));

-- organization_members
create policy members_read   on organization_members for select using (is_org_member(org_id) or user_id = auth.uid());
create policy members_manage on organization_members for all
  using (has_org_role(org_id, array['owner','admin']::member_role[]))
  with check (has_org_role(org_id, array['owner','admin']::member_role[]));

-- Generic tenant tables: any active member may read/write org-scoped rows.
-- (Role-specific restrictions such as billing are enforced in the API layer.)
create policy templates_rw on templates for all using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy events_rw    on events    for all using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy bulk_rw      on bulk_jobs  for all using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy bulkrows_rw  on bulk_job_rows for all using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy certs_rw     on certificates for all using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy apikeys_rw   on api_keys  for all using (has_org_role(org_id, array['owner','admin']::member_role[])) with check (has_org_role(org_id, array['owner','admin']::member_role[]));
create policy domains_rw   on custom_domains for all using (has_org_role(org_id, array['owner','admin']::member_role[])) with check (has_org_role(org_id, array['owner','admin']::member_role[]));
create policy veriflog_read on verification_logs for select using (is_org_member(org_id));
create policy subs_read    on subscriptions for select using (is_org_member(org_id));
create policy billing_read on billing_events for select using (is_org_member(org_id));
create policy usage_read   on usage_counters for select using (is_org_member(org_id));
create policy notifs_read  on notifications for select using (is_org_member(org_id) and (user_id is null or user_id = auth.uid()));
create policy notifs_update on notifications for update using (user_id = auth.uid());

-- NOTE: the backend uses the Supabase service-role key for privileged work
-- (webhooks, worker writes, verification logging). Service role bypasses RLS,
-- so those paths enforce tenant scoping explicitly in code.
-- ============================================================================
-- BulkCertifyX — 002 audit logs + atomic quota reservation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- audit_logs — append-only, never editable by ordinary users
-- ----------------------------------------------------------------------------
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations(id) on delete cascade,
  user_id       uuid references auth.users(id),
  action        text not null,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index idx_audit_org on audit_logs(org_id, created_at desc);
create index idx_audit_action on audit_logs(org_id, action);

alter table audit_logs enable row level security;
-- Read-only for owners/admins; writes happen via service role only.
create policy audit_read on audit_logs for select
  using (has_org_role(org_id, array['owner','admin']::member_role[]));

-- ----------------------------------------------------------------------------
-- reserve_certificate_quota — atomic, concurrency-safe quota reservation.
-- Returns true and increments the counter iff the org has room for `amount`
-- more certificates this period. Uses an upsert + conditional update inside a
-- single statement so two concurrent bulk jobs cannot both overshoot the cap.
--
-- plan_limit = -1 means unlimited (enterprise).
-- ----------------------------------------------------------------------------
create or replace function reserve_certificate_quota(
  p_org_id uuid,
  p_period text,
  p_amount integer,
  p_limit  integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  -- ensure a row exists for this period
  insert into usage_counters (org_id, period, certificates)
  values (p_org_id, p_period, 0)
  on conflict (org_id, period) do nothing;

  if p_limit < 0 then
    -- unlimited: just record usage, lock row to serialize the write
    update usage_counters
      set certificates = certificates + p_amount
      where org_id = p_org_id and period = p_period;
    return true;
  end if;

  -- Conditional increment: only succeeds if it stays within the cap.
  update usage_counters
    set certificates = certificates + p_amount
    where org_id = p_org_id
      and period = p_period
      and certificates + p_amount <= p_limit
    returning true into v_ok;

  return coalesce(v_ok, false);
end $$;

-- Release quota (e.g. rows that permanently failed and should not count).
create or replace function release_certificate_quota(
  p_org_id uuid,
  p_period text,
  p_amount integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update usage_counters
    set certificates = greatest(0, certificates - p_amount)
    where org_id = p_org_id and period = p_period;
end $$;

-- Increment the email counter for a period (atomic upsert).
create or replace function increment_email_usage(
  p_org_id uuid,
  p_period text,
  p_amount integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into usage_counters (org_id, period, emails)
  values (p_org_id, p_period, p_amount)
  on conflict (org_id, period)
  do update set emails = usage_counters.emails + p_amount;
end $$;

-- ----------------------------------------------------------------------------
-- increment_verification — safe counter bump + async-friendly log insert.
-- Called with service role from the public verification endpoint.
-- ----------------------------------------------------------------------------
create or replace function increment_verification(p_cert_id uuid)
returns void language sql security definer set search_path = public as $$
  update certificates set verification_count = verification_count + 1
  where id = p_cert_id;
$$;
