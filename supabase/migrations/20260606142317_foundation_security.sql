-- Foundation objects shared by the production health robotics schema.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.organization_kind as enum (
  'government',
  'clinic',
  'hospital',
  'pharmacy',
  'operator',
  'residential_provider'
);

create type public.member_role as enum (
  'owner',
  'admin',
  'doctor',
  'pharmacist',
  'government_analyst',
  'care_worker',
  'robot_operator',
  'viewer'
);

create type public.member_status as enum (
  'invited',
  'active',
  'suspended'
);

create type public.audit_action as enum (
  'create',
  'read',
  'update',
  'delete',
  'export',
  'login',
  'robot_ingest',
  'clinical_review'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind public.organization_kind not null,
  name text not null,
  legal_name text,
  registration_number text,
  email extensions.citext,
  phone text,
  website_url text,
  address_line1 text,
  address_line2 text,
  district text,
  region text not null default 'Hong Kong',
  country_code char(2) not null default 'HK',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, name)
);

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create index organization_memberships_user_idx
  on public.organization_memberships(user_id, status);

create trigger set_organization_memberships_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null,
  entity_table text not null,
  entity_id uuid,
  patient_id uuid,
  ip_address inet,
  user_agent text,
  robot_unit_id uuid,
  request_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_events_org_time_idx
  on public.audit_events(organization_id, occurred_at desc);

create index audit_events_patient_time_idx
  on public.audit_events(patient_id, occurred_at desc)
  where patient_id is not null;

create or replace function public.has_org_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role = any(allowed_roles)
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_events enable row level security;

create policy "Members can view their organizations"
  on public.organizations for select
  using (public.has_org_access(id));

create policy "Organization admins can update organizations"
  on public.organizations for update
  using (public.has_org_role(id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(id, array['owner','admin']::public.member_role[]));

create policy "Users can view their own memberships"
  on public.organization_memberships for select
  using (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "Organization admins can manage memberships"
  on public.organization_memberships for all
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "Members can view audit events"
  on public.audit_events for select
  using (organization_id is not null and public.has_org_role(organization_id, array['owner','admin','government_analyst']::public.member_role[]));

