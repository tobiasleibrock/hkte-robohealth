-- Stationary building robots, onboard devices, room visits, calibration, and consumables.

create type public.robot_status as enum (
  'commissioning',
  'active',
  'maintenance',
  'offline',
  'retired'
);

create type public.deployment_status as enum (
  'planned',
  'active',
  'paused',
  'completed',
  'cancelled'
);

create type public.device_kind as enum (
  'rgb_camera',
  'nir_camera',
  'multispectral_camera',
  'thermal_camera',
  'radar',
  'blood_pressure_cuff',
  'ppg_sensor',
  'finger_prick_analyzer',
  'cgm_reader',
  'urine_strip_reader',
  'saliva_analyzer',
  'breath_voc_sensor',
  'multiplex_pcr',
  'ecg_sensor',
  'dermatology_camera',
  'fundus_camera',
  'pupillometer',
  'environment_sensor',
  'other'
);

create type public.room_visit_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'aborted',
  'failed'
);

create table public.robot_units (
  id uuid primary key default gen_random_uuid(),
  owning_organization_id uuid not null references public.organizations(id) on delete restrict,
  serial_number text not null unique,
  display_name text not null,
  model text not null,
  firmware_version text,
  status public.robot_status not null default 'commissioning',
  capabilities text[] not null default '{}',
  commissioned_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index robot_units_org_status_idx
  on public.robot_units(owning_organization_id, status);

create trigger set_robot_units_updated_at
before update on public.robot_units
for each row execute function public.set_updated_at();

create table public.robot_deployments (
  id uuid primary key default gen_random_uuid(),
  robot_unit_id uuid not null references public.robot_units(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete restrict,
  building_id uuid references public.buildings(id) on delete set null,
  status public.deployment_status not null default 'planned',
  planned_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  docking_room_id uuid references public.rooms(id) on delete set null,
  service_window jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index robot_deployments_robot_status_idx
  on public.robot_deployments(robot_unit_id, status);

create index robot_deployments_community_idx
  on public.robot_deployments(community_id, status);

create trigger set_robot_deployments_updated_at
before update on public.robot_deployments
for each row execute function public.set_updated_at();

create table public.sensor_devices (
  id uuid primary key default gen_random_uuid(),
  robot_unit_id uuid not null references public.robot_units(id) on delete cascade,
  device_kind public.device_kind not null,
  manufacturer text,
  model text,
  serial_number text,
  regulatory_clearance text,
  firmware_version text,
  installed_at timestamptz not null default now(),
  retired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (robot_unit_id, serial_number)
);

create index sensor_devices_robot_kind_idx
  on public.sensor_devices(robot_unit_id, device_kind, retired_at);

create trigger set_sensor_devices_updated_at
before update on public.sensor_devices
for each row execute function public.set_updated_at();

create table public.device_calibrations (
  id uuid primary key default gen_random_uuid(),
  sensor_device_id uuid not null references public.sensor_devices(id) on delete cascade,
  calibrated_by_user_id uuid references auth.users(id) on delete set null,
  calibrated_at timestamptz not null default now(),
  expires_at timestamptz,
  result text not null check (result in ('pass', 'warning', 'fail')),
  certificate_url text,
  measurements jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index device_calibrations_device_time_idx
  on public.device_calibrations(sensor_device_id, calibrated_at desc);

create table public.consumable_lots (
  id uuid primary key default gen_random_uuid(),
  owning_organization_id uuid not null references public.organizations(id) on delete restrict,
  consumable_kind text not null,
  manufacturer text,
  lot_number text not null,
  expires_on date,
  regulatory_clearance text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owning_organization_id, consumable_kind, lot_number)
);

create trigger set_consumable_lots_updated_at
before update on public.consumable_lots
for each row execute function public.set_updated_at();

create table public.robot_consumable_inventory (
  id uuid primary key default gen_random_uuid(),
  robot_unit_id uuid not null references public.robot_units(id) on delete cascade,
  consumable_lot_id uuid not null references public.consumable_lots(id) on delete restrict,
  quantity_loaded integer not null check (quantity_loaded >= 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  loaded_at timestamptz not null default now(),
  unloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_remaining <= quantity_loaded)
);

create index robot_consumable_inventory_robot_idx
  on public.robot_consumable_inventory(robot_unit_id, unloaded_at);

create trigger set_robot_consumable_inventory_updated_at
before update on public.robot_consumable_inventory
for each row execute function public.set_updated_at();

create table public.robot_room_visits (
  id uuid primary key default gen_random_uuid(),
  robot_deployment_id uuid not null references public.robot_deployments(id) on delete cascade,
  robot_unit_id uuid not null references public.robot_units(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete set null,
  status public.room_visit_status not null default 'scheduled',
  scheduled_at timestamptz,
  arrived_at timestamptz,
  departed_at timestamptz,
  abort_reason text,
  route_trace jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departed_at is null or arrived_at is null or departed_at >= arrived_at)
);

create index robot_room_visits_room_time_idx
  on public.robot_room_visits(room_id, arrived_at desc);

create index robot_room_visits_patient_time_idx
  on public.robot_room_visits(patient_id, arrived_at desc)
  where patient_id is not null;

create trigger set_robot_room_visits_updated_at
before update on public.robot_room_visits
for each row execute function public.set_updated_at();

alter table public.robot_units enable row level security;
alter table public.robot_deployments enable row level security;
alter table public.sensor_devices enable row level security;
alter table public.device_calibrations enable row level security;
alter table public.consumable_lots enable row level security;
alter table public.robot_consumable_inventory enable row level security;
alter table public.robot_room_visits enable row level security;

create policy "Members can access robot units"
  on public.robot_units for all
  using (public.has_org_access(owning_organization_id))
  with check (public.has_org_access(owning_organization_id));

create policy "Members can access robot deployments"
  on public.robot_deployments for all
  using (public.has_org_access((select c.operator_organization_id from public.communities c where c.id = community_id)))
  with check (public.has_org_access((select c.operator_organization_id from public.communities c where c.id = community_id)));

create policy "Members can access sensor devices"
  on public.sensor_devices for all
  using (public.has_org_access((select r.owning_organization_id from public.robot_units r where r.id = robot_unit_id)))
  with check (public.has_org_access((select r.owning_organization_id from public.robot_units r where r.id = robot_unit_id)));

create policy "Members can access device calibrations"
  on public.device_calibrations for all
  using (public.has_org_access((select r.owning_organization_id from public.sensor_devices sd join public.robot_units r on r.id = sd.robot_unit_id where sd.id = sensor_device_id)))
  with check (public.has_org_access((select r.owning_organization_id from public.sensor_devices sd join public.robot_units r on r.id = sd.robot_unit_id where sd.id = sensor_device_id)));

create policy "Members can access consumable lots"
  on public.consumable_lots for all
  using (public.has_org_access(owning_organization_id))
  with check (public.has_org_access(owning_organization_id));

create policy "Members can access robot inventory"
  on public.robot_consumable_inventory for all
  using (public.has_org_access((select r.owning_organization_id from public.robot_units r where r.id = robot_unit_id)))
  with check (public.has_org_access((select r.owning_organization_id from public.robot_units r where r.id = robot_unit_id)));

create policy "Members can access robot room visits"
  on public.robot_room_visits for all
  using (
    public.has_org_access(public.organization_for_room(room_id))
    or (patient_id is not null and public.has_patient_access(patient_id))
  )
  with check (public.has_org_access(public.organization_for_room(room_id)));

