-- Dashboard-ready rollups, export tracking, and read models for government, doctors, and pharmacies.

create type public.snapshot_grain as enum (
  'hour',
  'day',
  'week',
  'month'
);

create type public.export_status as enum (
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

create table public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  grain public.snapshot_grain not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  patient_count integer not null default 0 check (patient_count >= 0),
  robot_visit_count integer not null default 0 check (robot_visit_count >= 0),
  completed_session_count integer not null default 0 check (completed_session_count >= 0),
  open_alert_count integer not null default 0 check (open_alert_count >= 0),
  critical_alert_count integer not null default 0 check (critical_alert_count >= 0),
  pharmacy_request_count integer not null default 0 check (pharmacy_request_count >= 0),
  metrics jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, community_id, building_id, grain, period_start)
);

create index dashboard_snapshots_org_period_idx
  on public.dashboard_snapshots(organization_id, grain, period_start desc);

create table public.community_health_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  measurement_definition_id uuid not null references public.measurement_definitions(id) on delete restrict,
  grain public.snapshot_grain not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  sample_count integer not null default 0 check (sample_count >= 0),
  patient_count integer not null default 0 check (patient_count >= 0),
  average_value numeric,
  min_value numeric,
  max_value numeric,
  abnormal_count integer not null default 0 check (abnormal_count >= 0),
  critical_count integer not null default 0 check (critical_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, community_id, building_id, measurement_definition_id, grain, period_start)
);

create index community_health_metrics_lookup_idx
  on public.community_health_metrics(organization_id, community_id, grain, period_start desc);

create table public.population_risk_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  segment_key text not null,
  segment_label text not null,
  grain public.snapshot_grain not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  patient_count integer not null default 0 check (patient_count >= 0),
  high_risk_count integer not null default 0 check (high_risk_count >= 0),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, community_id, building_id, segment_key, grain, period_start)
);

create index population_risk_segments_lookup_idx
  on public.population_risk_segments(organization_id, grain, period_start desc);

create table public.data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status public.export_status not null default 'queued',
  export_kind text not null,
  date_from date,
  date_to date,
  filters jsonb not null default '{}'::jsonb,
  includes_phi boolean not null default false,
  storage_bucket text,
  storage_path text,
  row_count integer check (row_count is null or row_count >= 0),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index data_export_jobs_org_status_idx
  on public.data_export_jobs(organization_id, status, requested_at desc);

create trigger set_data_export_jobs_updated_at
before update on public.data_export_jobs
for each row execute function public.set_updated_at();

create or replace view public.patient_latest_observations
with (security_invoker = true)
as
select distinct on (co.patient_id, co.measurement_definition_id)
  co.patient_id,
  co.measurement_definition_id,
  md.code as measurement_code,
  md.display_name,
  co.observed_at,
  co.numeric_value,
  co.text_value,
  co.boolean_value,
  co.categorical_value,
  co.json_value,
  co.unit,
  co.result_flag,
  co.confidence,
  co.care_session_id
from public.clinical_observations co
join public.measurement_definitions md on md.id = co.measurement_definition_id
where co.status in ('preliminary', 'final', 'amended')
order by co.patient_id, co.measurement_definition_id, co.observed_at desc;

create or replace view public.patient_dashboard_summary
with (security_invoker = true)
as
select
  p.id as patient_id,
  p.full_name,
  p.status,
  pr.household_id,
  h.primary_room_id,
  public.organization_for_household(h.id) as organization_id,
  count(distinct ca.id) filter (where ca.status in ('open','acknowledged','in_review')) as open_alert_count,
  max(rcs.started_at) as last_session_at,
  max(co.observed_at) as last_observation_at
from public.patients p
left join public.patient_residencies pr on pr.patient_id = p.id and pr.ended_on is null and pr.is_primary
left join public.households h on h.id = pr.household_id
left join public.clinical_alerts ca on ca.patient_id = p.id
left join public.robot_care_sessions rcs on rcs.patient_id = p.id
left join public.clinical_observations co on co.patient_id = p.id
where public.has_patient_access(p.id)
group by p.id, p.full_name, p.status, pr.household_id, h.primary_room_id, h.id;

create or replace view public.building_robot_operations_summary
with (security_invoker = true)
as
select
  b.id as building_id,
  b.name as building_name,
  c.id as community_id,
  c.name as community_name,
  c.operator_organization_id as organization_id,
  count(distinct rd.robot_unit_id) filter (where rd.status = 'active') as active_robot_count,
  count(distinct rrv.id) filter (where rrv.arrived_at >= now() - interval '24 hours') as visits_last_24h,
  count(distinct rcs.id) filter (where rcs.started_at >= now() - interval '24 hours') as sessions_last_24h,
  count(distinct ca.id) filter (where ca.status = 'open') as open_alert_count
from public.buildings b
join public.communities c on c.id = b.community_id
left join public.robot_deployments rd on rd.building_id = b.id or (rd.building_id is null and rd.community_id = c.id)
left join public.robot_room_visits rrv on rrv.robot_deployment_id = rd.id
left join public.robot_care_sessions rcs on rcs.robot_room_visit_id = rrv.id
left join public.clinical_alerts ca on ca.care_session_id = rcs.id
where public.has_org_access(c.operator_organization_id)
group by b.id, b.name, c.id, c.name, c.operator_organization_id;

alter table public.dashboard_snapshots enable row level security;
alter table public.community_health_metrics enable row level security;
alter table public.population_risk_segments enable row level security;
alter table public.data_export_jobs enable row level security;

create policy "Members can access dashboard snapshots"
  on public.dashboard_snapshots for all
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

create policy "Members can access community health metrics"
  on public.community_health_metrics for all
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

create policy "Members can access population risk segments"
  on public.population_risk_segments for all
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

create policy "Members can access data export jobs"
  on public.data_export_jobs for all
  using (public.has_org_role(organization_id, array['owner','admin','government_analyst']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin','government_analyst']::public.member_role[]));

