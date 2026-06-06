-- Hong Kong communities, buildings, rooms, residents, patients, consents, and care teams.

create type public.patient_status as enum (
  'active',
  'temporarily_away',
  'discharged',
  'deceased',
  'opted_out'
);

create type public.sex_at_birth as enum (
  'female',
  'male',
  'intersex',
  'unknown'
);

create type public.room_kind as enum (
  'bedroom',
  'living_room',
  'kitchen',
  'bathroom',
  'corridor',
  'lobby',
  'clinic_room',
  'pharmacy_room',
  'common_area',
  'utility',
  'other'
);

create type public.consent_scope as enum (
  'robot_visit',
  'contactless_vitals',
  'blood_pressure',
  'finger_prick_blood',
  'glucose_cgm',
  'urinalysis',
  'saliva_test',
  'breath_analysis',
  'swab_pathogen_test',
  'ecg',
  'skin_imaging',
  'eye_imaging',
  'doctor_review',
  'pharmacy_fulfillment',
  'government_analytics',
  'research_export'
);

create type public.consent_status as enum (
  'granted',
  'revoked',
  'expired',
  'declined'
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  operator_organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  district text not null,
  area text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  government_estate_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operator_organization_id, name)
);

create trigger set_communities_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  block_code text,
  building_kind text,
  year_built integer check (year_built is null or year_built between 1800 and 2200),
  floors_count integer check (floors_count is null or floors_count >= 0),
  units_count integer check (units_count is null or units_count >= 0),
  accessibility_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, name)
);

create trigger set_buildings_updated_at
before update on public.buildings
for each row execute function public.set_updated_at();

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  floor_label text not null,
  floor_number integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, floor_label)
);

create trigger set_floors_updated_at
before update on public.floors
for each row execute function public.set_updated_at();

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  room_kind public.room_kind not null,
  room_number text,
  display_name text not null,
  area_square_meters numeric(8,2),
  occupancy_capacity integer check (occupancy_capacity is null or occupancy_capacity >= 0),
  is_private boolean not null default true,
  robot_accessible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (floor_id, display_name)
);

create index rooms_floor_kind_idx on public.rooms(floor_id, room_kind);

create trigger set_rooms_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  primary_room_id uuid not null references public.rooms(id) on delete restrict,
  household_code text,
  move_in_date date,
  primary_language text,
  emergency_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (primary_room_id, household_code)
);

create trigger set_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  external_patient_ref text unique,
  hk_identity_ref text,
  full_name text not null,
  preferred_name text,
  date_of_birth date,
  sex_at_birth public.sex_at_birth not null default 'unknown',
  phone text,
  email extensions.citext,
  preferred_language text,
  status public.patient_status not null default 'active',
  chronic_conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  medication_summary text,
  mobility_notes text,
  risk_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_name_idx on public.patients using gin (to_tsvector('simple', full_name));
create index patients_status_idx on public.patients(status);

create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create table public.patient_residencies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete set null,
  is_primary boolean not null default true,
  started_on date not null default current_date,
  ended_on date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

create unique index patient_primary_residency_unique_idx
  on public.patient_residencies(patient_id)
  where is_primary and ended_on is null;

create index patient_residencies_household_idx
  on public.patient_residencies(household_id, ended_on);

create trigger set_patient_residencies_updated_at
before update on public.patient_residencies
for each row execute function public.set_updated_at();

create table public.patient_contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone text,
  email extensions.citext,
  is_emergency_contact boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patient_contacts_patient_idx on public.patient_contacts(patient_id);

create trigger set_patient_contacts_updated_at
before update on public.patient_contacts
for each row execute function public.set_updated_at();

create table public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  scope public.consent_scope not null,
  status public.consent_status not null,
  granted_by_patient_id uuid references public.patients(id) on delete set null,
  granted_by_contact_id uuid references public.patient_contacts(id) on delete set null,
  captured_by_user_id uuid references auth.users(id) on delete set null,
  captured_by_robot_unit_id uuid,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  consent_document_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);

create index patient_consents_patient_scope_idx
  on public.patient_consents(patient_id, scope, status, valid_from desc);

create trigger set_patient_consents_updated_at
before update on public.patient_consents
for each row execute function public.set_updated_at();

create table public.patient_care_team_members (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role public.member_role not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patient_care_team_patient_idx
  on public.patient_care_team_members(patient_id, ended_at);

create index patient_care_team_org_idx
  on public.patient_care_team_members(organization_id, role);

create trigger set_patient_care_team_members_updated_at
before update on public.patient_care_team_members
for each row execute function public.set_updated_at();

create or replace function public.organization_for_room(target_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.operator_organization_id
  from public.rooms r
  join public.floors f on f.id = r.floor_id
  join public.buildings b on b.id = f.building_id
  join public.communities c on c.id = b.community_id
  where r.id = target_room_id
  limit 1;
$$;

create or replace function public.organization_for_household(target_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.organization_for_room(h.primary_room_id)
  from public.households h
  where h.id = target_household_id
  limit 1;
$$;

create or replace function public.has_patient_access(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patient_care_team_members pct
    where pct.patient_id = target_patient_id
      and pct.ended_at is null
      and public.has_org_access(pct.organization_id)
  )
  or exists (
    select 1
    from public.patient_residencies pr
    join public.households h on h.id = pr.household_id
    where pr.patient_id = target_patient_id
      and pr.ended_on is null
      and public.has_org_access(public.organization_for_room(h.primary_room_id))
  );
$$;

alter table public.communities enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;
alter table public.households enable row level security;
alter table public.patients enable row level security;
alter table public.patient_residencies enable row level security;
alter table public.patient_contacts enable row level security;
alter table public.patient_consents enable row level security;
alter table public.patient_care_team_members enable row level security;

create policy "Members can access communities"
  on public.communities for all
  using (public.has_org_access(operator_organization_id))
  with check (public.has_org_access(operator_organization_id));

create policy "Members can access buildings"
  on public.buildings for all
  using (public.has_org_access((select c.operator_organization_id from public.communities c where c.id = community_id)))
  with check (public.has_org_access((select c.operator_organization_id from public.communities c where c.id = community_id)));

create policy "Members can access floors"
  on public.floors for all
  using (public.has_org_access((select c.operator_organization_id from public.buildings b join public.communities c on c.id = b.community_id where b.id = building_id)))
  with check (public.has_org_access((select c.operator_organization_id from public.buildings b join public.communities c on c.id = b.community_id where b.id = building_id)));

create policy "Members can access rooms"
  on public.rooms for all
  using (public.has_org_access(public.organization_for_room(id)))
  with check (public.has_org_access(public.organization_for_room(id)));

create policy "Members can access households"
  on public.households for all
  using (public.has_org_access(public.organization_for_household(id)))
  with check (public.has_org_access(public.organization_for_room(primary_room_id)));

create policy "Care teams can access patients"
  on public.patients for all
  using (public.has_patient_access(id))
  with check (public.has_patient_access(id));

create policy "Care teams can access patient residencies"
  on public.patient_residencies for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access patient contacts"
  on public.patient_contacts for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access patient consents"
  on public.patient_consents for all
  using (public.has_patient_access(patient_id))
  with check (public.has_patient_access(patient_id));

create policy "Care teams can access care team rows"
  on public.patient_care_team_members for all
  using (public.has_patient_access(patient_id) or public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

