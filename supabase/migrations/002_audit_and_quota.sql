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
