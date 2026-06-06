-- Robot encounters, observations, diagnostic results, media metadata, and sample provenance.

create type public.session_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'failed'
);

create type public.observation_status as enum (
  'preliminary',
  'final',
  'amended',
  'entered_in_error'
);

create type public.sample_status as enum (
  'requested',
  'collected',
  'loaded',
  'processed',
  'rejected',
  'disposed'
);

create type public.result_flag as enum (
  'normal',
  'low',
  'high',
  'critical',
  'abnormal',
  'inconclusive'
);

create type public.media_kind as enum (
  'rgb_video',
  'nir_video',
  'thermal_image',
  'radar_trace',
  'dermatology_image',
  'fundus_image',
  'ecg_waveform',
  'audio',
  'document',
  'other'
);

create table public.robot_care_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  robot_room_visit_id uuid references public.robot_room_visits(id) on delete set null,
  robot_unit_id uuid references public.robot_units(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  status public.session_status not null default 'scheduled',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  initiated_by_user_id uuid references auth.users(id) on delete set null,
  purpose text,
  patient_reported_symptoms text[] not null default '{}',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index robot_care_sessions_patient_time_idx
  on public.robot_care_sessions(patient_id, started_at desc);

create index robot_care_sessions_room_time_idx
  on public.robot_care_sessions(room_id, started_at desc)
  where room_id is not null;

create trigger set_robot_care_sessions_updated_at
before update on public.robot_care_sessions
for each row execute function public.set_updated_at();

create table public.session_consents (
  id uuid primary key default gen_random_uuid(),
  care_session_id uuid not null references public.robot_care_sessions(id) on delete cascade,
  patient_consent_id uuid not null references public.patient_consents(id) on delete restrict,
  scope public.consent_scope not null,
  attested_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (care_session_id, scope)
);

create table public.media_artifacts (
  id uuid primary key default gen_random_uuid(),
  care_session_id uuid references public.robot_care_sessions(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  robot_unit_id uuid references public.robot_units(id) on delete set null,
  sensor_device_id uuid references public.sensor_devices(id) on delete set null,
  media_kind public.media_kind not null,
  storage_bucket text not null,
  storage_path text not null,
  captured_at timestamptz not null default now(),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  checksum_sha256 text,
  contains_phi boolean not null default true,
  retention_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index media_artifacts_session_idx
  on public.media_artifacts(care_session_id, captured_at desc);

create index media_artifacts_patient_idx
  on public.media_artifacts(patient_id, captured_at desc)
  where patient_id is not null;

create table public.clinical_observations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete cascade,
  measurement_definition_id uuid not null references public.measurement_definitions(id) on delete restrict,
  robot_unit_id uuid references public.robot_units(id) on delete set null,
  sensor_device_id uuid references public.sensor_devices(id) on delete set null,
  media_artifact_id uuid references public.media_artifacts(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  observed_at timestamptz not null default now(),
  status public.observation_status not null default 'final',
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  categorical_value text,
  json_value jsonb,
  unit text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  result_flag public.result_flag,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    numeric_value is not null
    or text_value is not null
    or boolean_value is not null
    or categorical_value is not null
    or json_value is not null
  )
);

create index clinical_observations_patient_time_idx
  on public.clinical_observations(patient_id, observed_at desc);

create index clinical_observations_measurement_time_idx
  on public.clinical_observations(measurement_definition_id, observed_at desc);

create index clinical_observations_session_idx
  on public.clinical_observations(care_session_id)
  where care_session_id is not null;

create trigger set_clinical_observations_updated_at
before update on public.clinical_observations
for each row execute function public.set_updated_at();

create table public.sample_collections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete cascade,
  robot_unit_id uuid references public.robot_units(id) on delete set null,
  collected_by_user_id uuid references auth.users(id) on delete set null,
  specimen text not null,
  status public.sample_status not null default 'requested',
  consumable_lot_id uuid references public.consumable_lots(id) on delete set null,
  collected_at timestamptz,
  processed_at timestamptz,
  disposed_at timestamptz,
  rejection_reason text,
  barcode text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sample_collections_patient_time_idx
  on public.sample_collections(patient_id, collected_at desc);

create trigger set_sample_collections_updated_at
before update on public.sample_collections
for each row execute function public.set_updated_at();

create table public.diagnostic_test_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete cascade,
  diagnostic_panel_id uuid not null references public.diagnostic_panels(id) on delete restrict,
  ordered_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'ordered' check (status in ('ordered','collected','processing','resulted','cancelled','failed')),
  priority text not null default 'routine' check (priority in ('routine','urgent','stat')),
  ordered_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index diagnostic_test_orders_patient_idx
  on public.diagnostic_test_orders(patient_id, ordered_at desc);

create trigger set_diagnostic_test_orders_updated_at
before update on public.diagnostic_test_orders
for each row execute function public.set_updated_at();

create table public.diagnostic_test_results (
  id uuid primary key default gen_random_uuid(),
  diagnostic_test_order_id uuid not null references public.diagnostic_test_orders(id) on delete cascade,
  sample_collection_id uuid references public.sample_collections(id) on delete set null,
  robot_unit_id uuid references public.robot_units(id) on delete set null,
  resulted_at timestamptz not null default now(),
  status public.observation_status not null default 'final',
  summary text,
  raw_payload jsonb not null default '{}'::jsonb,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_diagnostic_test_results_updated_at
before update on public.diagnostic_test_results
for each row execute function public.set_updated_at();

create table public.diagnostic_result_items (
  id uuid primary key default gen_random_uuid(),
  diagnostic_test_result_id uuid not null references public.diagnostic_test_results(id) on delete cascade,
  clinical_observation_id uuid references public.clinical_observations(id) on delete set null,
  measurement_definition_id uuid not null references public.measurement_definitions(id) on delete restrict,
  value_text text,
  value_numeric numeric,
  value_boolean boolean,
  unit text,
  result_flag public.result_flag,
  reference_range text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index diagnostic_result_items_result_idx
  on public.diagnostic_result_items(diagnostic_test_result_id);

create table public.imaging_findings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_session_id uuid references public.robot_care_sessions(id) on delete cascade,
  media_artifact_id uuid not null references public.media_artifacts(id) on delete cascade,
  finding_kind text not null,
  body_site text,
  laterality text,
  risk_score numeric(6,4),
  severity text check (severity is null or severity in ('info','low','medium','high','critical')),
  description text,
  recommendation text,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index imaging_findings_patient_time_idx
  on public.imaging_findings(patient_id, created_at desc);

create trigger set_imaging_findings_updated_at
before update on public.imaging_findings
for each row execute function public.set_updated_at();

alter table public.robot_care_sessions enable row level security;
alter table public.session_consents enable row level security;
alter table public.media_artifacts enable row level security;
alter table public.clinical_observations enable row level security;
alter table public.sample_collections enable row level security;
alter table public.diagnostic_test_orders enable row level security;
alter table public.diagnostic_test_results enable row level security;
alter table public.diagnostic_result_items enable row level security;
alter table public.imaging_findings enable row level security;

create policy "Care teams can access robot care sessions"
  on public.robot_care_sessions for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access session consents"
  on public.session_consents for all
  using (public.has_patient_access((select rcs.patient_id from public.robot_care_sessions rcs where rcs.id = care_session_id)))
  with check (public.has_patient_access((select rcs.patient_id from public.robot_care_sessions rcs where rcs.id = care_session_id)));

create policy "Care teams can access media artifacts"
  on public.media_artifacts for all
  using (patient_id is not null and public.has_patient_access(patient_id))
  with check (patient_id is not null and public.has_patient_access(patient_id));

create policy "Care teams can access clinical observations"
  on public.clinical_observations for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access samples"
  on public.sample_collections for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access diagnostic orders"
  on public.diagnostic_test_orders for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access diagnostic results"
  on public.diagnostic_test_results for all
  using (public.has_patient_access((select dto.patient_id from public.diagnostic_test_orders dto where dto.id = diagnostic_test_order_id)))
  with check (public.has_patient_access((select dto.patient_id from public.diagnostic_test_orders dto where dto.id = diagnostic_test_order_id)));

create policy "Care teams can access diagnostic result items"
  on public.diagnostic_result_items for all
  using (public.has_patient_access((
    select dto.patient_id
    from public.diagnostic_test_results dtr
    join public.diagnostic_test_orders dto on dto.id = dtr.diagnostic_test_order_id
    where dtr.id = diagnostic_test_result_id
  )))
  with check (public.has_patient_access((
    select dto.patient_id
    from public.diagnostic_test_results dtr
    join public.diagnostic_test_orders dto on dto.id = dtr.diagnostic_test_order_id
    where dtr.id = diagnostic_test_result_id
  )));

create policy "Care teams can access imaging findings"
  on public.imaging_findings for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

