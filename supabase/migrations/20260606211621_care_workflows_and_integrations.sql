-- Doctor, pharmacy, care-plan, alert, referral, and integration workflow data.

create type public.alert_status as enum (
  'open',
  'acknowledged',
  'in_review',
  'resolved',
  'dismissed'
);

create type public.alert_severity as enum (
  'info',
  'low',
  'medium',
  'high',
  'critical'
);

create type public.referral_status as enum (
  'draft',
  'sent',
  'accepted',
  'declined',
  'completed',
  'cancelled'
);

create type public.medication_order_status as enum (
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled'
);

create table public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete set null,
  score_kind text not null,
  score_value numeric(10,4) not null,
  severity public.alert_severity not null,
  model_name text,
  model_version text,
  contributing_observation_ids uuid[] not null default '{}',
  explanation text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index risk_scores_patient_time_idx
  on public.risk_scores(patient_id, calculated_at desc);

create table public.clinical_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete set null,
  risk_score_id uuid references public.risk_scores(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  severity public.alert_severity not null,
  status public.alert_status not null default 'open',
  alert_kind text not null,
  title text not null,
  description text,
  recommended_action text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  acknowledged_by_user_id uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinical_alerts_patient_status_idx
  on public.clinical_alerts(patient_id, status, severity);

create index clinical_alerts_org_status_idx
  on public.clinical_alerts(organization_id, status, created_at desc)
  where organization_id is not null;

create trigger set_clinical_alerts_updated_at
before update on public.clinical_alerts
for each row execute function public.set_updated_at();

create table public.provider_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  note_kind text not null default 'clinical',
  body text not null,
  signed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_notes_patient_time_idx
  on public.provider_notes(patient_id, created_at desc);

create trigger set_provider_notes_updated_at
before update on public.provider_notes
for each row execute function public.set_updated_at();

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  source_organization_id uuid references public.organizations(id) on delete set null,
  target_organization_id uuid references public.organizations(id) on delete set null,
  clinical_alert_id uuid references public.clinical_alerts(id) on delete set null,
  referral_kind text not null,
  status public.referral_status not null default 'draft',
  reason text not null,
  priority text not null default 'routine' check (priority in ('routine','urgent','stat')),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referrals_patient_status_idx
  on public.referrals(patient_id, status, requested_at desc);

create trigger set_referrals_updated_at
before update on public.referrals
for each row execute function public.set_updated_at();

create table public.medication_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescribing_organization_id uuid references public.organizations(id) on delete set null,
  prescriber_user_id uuid references auth.users(id) on delete set null,
  medication_name text not null,
  medication_code text,
  dosage text,
  route text,
  frequency text,
  start_date date,
  end_date date,
  status public.medication_order_status not null default 'draft',
  indication text,
  instructions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index medication_orders_patient_status_idx
  on public.medication_orders(patient_id, status);

create trigger set_medication_orders_updated_at
before update on public.medication_orders
for each row execute function public.set_updated_at();

create table public.pharmacy_fulfillment_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_order_id uuid references public.medication_orders(id) on delete set null,
  pharmacy_organization_id uuid not null references public.organizations(id) on delete restrict,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'requested' check (status in ('requested','accepted','packed','dispatched','delivered','cancelled','failed')),
  delivery_room_id uuid references public.rooms(id) on delete set null,
  requested_at timestamptz not null default now(),
  delivered_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pharmacy_fulfillment_patient_idx
  on public.pharmacy_fulfillment_requests(patient_id, requested_at desc);

create index pharmacy_fulfillment_org_status_idx
  on public.pharmacy_fulfillment_requests(pharmacy_organization_id, status);

create trigger set_pharmacy_fulfillment_requests_updated_at
before update on public.pharmacy_fulfillment_requests
for each row execute function public.set_updated_at();

create table public.medication_adherence_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_order_id uuid references public.medication_orders(id) on delete set null,
  care_session_id uuid references public.robot_care_sessions(id) on delete set null,
  event_kind text not null check (event_kind in ('taken','missed','refused','unknown','side_effect_reported')),
  occurred_at timestamptz not null default now(),
  source text not null default 'robot',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index medication_adherence_patient_time_idx
  on public.medication_adherence_events(patient_id, occurred_at desc);

create table public.care_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  clinical_alert_id uuid references public.clinical_alerts(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_at timestamptz,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index care_plan_tasks_patient_status_idx
  on public.care_plan_tasks(patient_id, status, due_at);

create trigger set_care_plan_tasks_updated_at
before update on public.care_plan_tasks
for each row execute function public.set_updated_at();

alter table public.risk_scores enable row level security;
alter table public.clinical_alerts enable row level security;
alter table public.provider_notes enable row level security;
alter table public.referrals enable row level security;
alter table public.medication_orders enable row level security;
alter table public.pharmacy_fulfillment_requests enable row level security;
alter table public.medication_adherence_events enable row level security;
alter table public.care_plan_tasks enable row level security;

create policy "Care teams can access risk scores"
  on public.risk_scores for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access clinical alerts"
  on public.clinical_alerts for all
  using (public.has_patient_access(patient_id) or (organization_id is not null and public.has_org_access(organization_id)))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access provider notes"
  on public.provider_notes for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access referrals"
  on public.referrals for all
  using (
    public.has_patient_access(patient_id)
    or (source_organization_id is not null and public.has_org_access(source_organization_id))
    or (target_organization_id is not null and public.has_org_access(target_organization_id))
  )
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access medication orders"
  on public.medication_orders for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams and pharmacies can access fulfillment"
  on public.pharmacy_fulfillment_requests for all
  using (public.has_patient_access(patient_id) or public.has_org_access(pharmacy_organization_id))
  with check (public.has_patient_access(patient_id) or public.has_org_access(pharmacy_organization_id));

create policy "Care teams can access adherence events"
  on public.medication_adherence_events for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access care plan tasks"
  on public.care_plan_tasks for all
  using (public.has_patient_access(patient_id) or (organization_id is not null and public.has_org_access(organization_id)))
  with check (public.has_patient_access(patient_id));

