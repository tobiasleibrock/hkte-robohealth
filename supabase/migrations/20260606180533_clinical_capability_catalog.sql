-- Clinical capability catalog for realistic robot-collected measurements and diagnostics.

create type public.maturity_grade as enum ('A', 'B', 'C');

create type public.modality_kind as enum (
  'contactless_vitals',
  'blood_pressure',
  'blood_finger_prick',
  'glucose',
  'urinalysis',
  'saliva_diagnostics',
  'breath_analysis',
  'swab_pathogen',
  'ecg_rhythm',
  'skin_eye_imaging',
  'environment'
);

create type public.measurement_value_kind as enum (
  'numeric',
  'boolean',
  'categorical',
  'text',
  'json'
);

create table public.clinical_modalities (
  id uuid primary key default gen_random_uuid(),
  kind public.modality_kind not null unique,
  display_name text not null,
  maturity public.maturity_grade not null,
  contact_required boolean not null,
  sample_required boolean not null default false,
  default_consent_scope public.consent_scope,
  summary text not null,
  limitations text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_clinical_modalities_updated_at
before update on public.clinical_modalities
for each row execute function public.set_updated_at();

create table public.measurement_definitions (
  id uuid primary key default gen_random_uuid(),
  modality_id uuid not null references public.clinical_modalities(id) on delete cascade,
  code text not null unique,
  display_name text not null,
  value_kind public.measurement_value_kind not null default 'numeric',
  unit text,
  specimen text,
  method text,
  maturity public.maturity_grade not null,
  normal_min numeric,
  normal_max numeric,
  precision_notes text,
  dashboard_group text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index measurement_definitions_modality_idx
  on public.measurement_definitions(modality_id, dashboard_group);

create trigger set_measurement_definitions_updated_at
before update on public.measurement_definitions
for each row execute function public.set_updated_at();

create table public.diagnostic_panels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  modality_id uuid not null references public.clinical_modalities(id) on delete restrict,
  specimen text,
  expected_turnaround_minutes integer check (expected_turnaround_minutes is null or expected_turnaround_minutes > 0),
  maturity public.maturity_grade not null,
  requires_sterile_consumable boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_diagnostic_panels_updated_at
before update on public.diagnostic_panels
for each row execute function public.set_updated_at();

create table public.panel_measurements (
  diagnostic_panel_id uuid not null references public.diagnostic_panels(id) on delete cascade,
  measurement_definition_id uuid not null references public.measurement_definitions(id) on delete cascade,
  display_order integer not null default 0,
  primary key (diagnostic_panel_id, measurement_definition_id)
);

create table public.clinical_thresholds (
  id uuid primary key default gen_random_uuid(),
  measurement_definition_id uuid not null references public.measurement_definitions(id) on delete cascade,
  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  comparator text not null check (comparator in ('lt', 'lte', 'gt', 'gte', 'eq', 'between', 'outside')),
  lower_bound numeric,
  upper_bound numeric,
  sex_at_birth public.sex_at_birth,
  min_age_years integer,
  max_age_years integer,
  label text not null,
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clinical_thresholds_measurement_idx
  on public.clinical_thresholds(measurement_definition_id, severity);

insert into public.clinical_modalities (kind, display_name, maturity, contact_required, sample_required, default_consent_scope, summary, limitations)
values
  ('contactless_vitals', 'Contactless camera and radar vitals', 'A', false, false, 'contactless_vitals', 'RGB, NIR, multispectral, thermal, and radar measurements for living-room vital signs.', 'SpO2 and stress estimates are less precise than contact sensors and depend on lighting, posture, skin tone, motion, and camera angle.'),
  ('blood_pressure', 'Blood pressure', 'B', true, false, 'blood_pressure', 'Clinically cleared upper-arm cuff readings plus cuffless PPG trend capture.', 'Cuffless PPG is useful for trends but should not replace guideline-grade cuff readings.'),
  ('blood_finger_prick', 'Finger-prick blood diagnostics', 'A', true, true, 'finger_prick_blood', 'Point-of-care analyzer cartridges for HbA1c, lipid profile, creatinine, hsCRP, and hemoglobin.', 'Requires consent, sterile supplies, trained handling, quality control, and cartridge inventory.'),
  ('glucose', 'Glucose monitoring', 'A', true, true, 'glucose_cgm', 'CGM patch placement or NFC reading, capillary glucose, and saliva glucose screening.', 'Non-invasive spot glucose remains limited and should be treated as screening unless device clearance supports diagnosis.'),
  ('urinalysis', 'Urinalysis', 'A', true, true, 'urinalysis', 'Camera or spectrometer urine-strip and albumin or hematuria screening.', 'Requires a fresh sample and contamination controls.'),
  ('saliva_diagnostics', 'Saliva diagnostics', 'B', true, true, 'saliva_test', 'Saliva hormone, glucose, pathogen, and DNA or RNA marker screening.', 'Several markers are screening-grade and require confirmatory lab pathways.'),
  ('breath_analysis', 'Breath VOC analysis', 'C', false, false, 'breath_analysis', 'VOC e-nose and photoacoustic breath screening for respiratory, metabolic, and renal signals.', 'Many indications remain research-stage and model drift must be monitored.'),
  ('swab_pathogen', 'Nasal and throat swab pathogen testing', 'A', true, true, 'swab_pathogen_test', 'Point-of-care multiplex PCR or antigen testing for respiratory pathogens.', 'Requires proper sample collection, infection control, and result confirmation policy.'),
  ('ecg_rhythm', 'ECG and cardiac rhythm', 'A', true, false, 'ecg', 'One-lead, six-lead, or patch ECG capture for rhythm screening and Holter-lite workflows.', 'Abnormal results require clinician review and may need clinical-grade ECG confirmation.'),
  ('skin_eye_imaging', 'Skin and eye imaging', 'B', false, false, 'skin_imaging', 'Dermatology imaging, wound tracking, fundus screening, and pupillometry.', 'AI triage can miss disease and should feed referral workflows rather than final diagnosis.'),
  ('environment', 'Room environment', 'A', false, false, null, 'Temperature, humidity, air quality, noise, and occupancy context for clinical interpretation.', 'Environmental readings are contextual and not diagnostic by themselves.');

insert into public.measurement_definitions
  (modality_id, code, display_name, value_kind, unit, specimen, method, maturity, normal_min, normal_max, precision_notes, dashboard_group)
select m.id, v.code, v.display_name, v.value_kind::public.measurement_value_kind, v.unit, v.specimen, v.method, v.maturity::public.maturity_grade, v.normal_min, v.normal_max, v.precision_notes, v.dashboard_group
from public.clinical_modalities m
join (
  values
    ('contactless_vitals','heart_rate_bpm','Heart rate','numeric','bpm',null,'rPPG face video','A',50,100,'Typically +/-2 to 5 bpm versus ECG.','vitals'),
    ('contactless_vitals','respiratory_rate_per_min','Respiratory rate','numeric','breaths/min',null,'Camera or radar chest movement','A',12,20,'Typically +/-1 to 2 breaths per minute.','vitals'),
    ('contactless_vitals','spo2_percent','Oxygen saturation','numeric','%',null,'Multispectral camera','B',95,100,'Typically +/-2 to 4 percentage points, lower precision than finger clip.','vitals'),
    ('contactless_vitals','skin_temperature_c','Skin temperature','numeric','degC',null,'IR thermography','A',35.5,37.5,'Typically +/-0.3 degC for skin surface.','vitals'),
    ('contactless_vitals','hrv_rmssd_ms','Heart-rate variability RMSSD','numeric','ms',null,'rPPG plus ML','B',null,null,'Trend signal; context sensitive.','vitals'),
    ('contactless_vitals','stress_index','Stress index','numeric','score',null,'rPPG plus ML','B',null,null,'Screening and trend only.','wellbeing'),
    ('contactless_vitals','pallor_score','Pallor screening score','numeric','score',null,'RGB facial color analysis','B',null,null,'Screening only; lighting sensitive.','screening'),
    ('blood_pressure','systolic_bp_mmhg','Systolic blood pressure','numeric','mmHg',null,'Upper-arm cuff or PPG trend','B',90,120,'Cuff preferred for clinical-grade readings; PPG trend MAE can be about 9 mmHg.','vitals'),
    ('blood_pressure','diastolic_bp_mmhg','Diastolic blood pressure','numeric','mmHg',null,'Upper-arm cuff or PPG trend','B',60,80,'Cuff preferred for clinical-grade readings; PPG trend MAE can be about 5 mmHg.','vitals'),
    ('blood_finger_prick','hba1c_percent','HbA1c','numeric','%', 'capillary_blood','POC cartridge','A',4,5.6,'3 to 7 minute analyzer workflow.','blood'),
    ('blood_finger_prick','total_cholesterol_mmol_l','Total cholesterol','numeric','mmol/L','capillary_blood','POC cartridge','A',null,5.2,'Part of lipid profile.','blood'),
    ('blood_finger_prick','hdl_cholesterol_mmol_l','HDL cholesterol','numeric','mmol/L','capillary_blood','POC cartridge','A',1.0,null,'Part of lipid profile.','blood'),
    ('blood_finger_prick','ldl_cholesterol_mmol_l','LDL cholesterol','numeric','mmol/L','capillary_blood','POC cartridge','A',null,3.4,'Part of lipid profile.','blood'),
    ('blood_finger_prick','triglycerides_mmol_l','Triglycerides','numeric','mmol/L','capillary_blood','POC cartridge','A',null,1.7,'Part of lipid profile.','blood'),
    ('blood_finger_prick','creatinine_umol_l','Creatinine','numeric','umol/L','capillary_blood','POC cartridge','A',null,null,'Renal function screening.','blood'),
    ('blood_finger_prick','hscrp_mg_l','High-sensitivity CRP','numeric','mg/L','capillary_blood','POC cartridge','A',null,3,'Inflammation and cardiovascular risk marker.','blood'),
    ('blood_finger_prick','hemoglobin_g_dl','Hemoglobin','numeric','g/dL','capillary_blood','POC cartridge','A',12,17.5,'Anemia screening.','blood'),
    ('glucose','interstitial_glucose_mmol_l','Interstitial glucose','numeric','mmol/L','interstitial_fluid','CGM patch or NFC reader','A',3.9,10,'Established CGM workflow.','glucose'),
    ('glucose','capillary_glucose_mmol_l','Capillary glucose','numeric','mmol/L','capillary_blood','Finger-prick strip or cartridge','A',3.9,7.8,'Spot glucose.','glucose'),
    ('glucose','saliva_glucose_mmol_l','Saliva glucose','numeric','mmol/L','saliva','Saliva assay','B',null,null,'Correlates with blood glucose for screening.','glucose'),
    ('urinalysis','urine_ph','Urine pH','numeric','pH','urine','Urine strip reader','A',4.5,8,'Dipstick marker.','urine'),
    ('urinalysis','urine_specific_gravity','Urine specific gravity','numeric','sg','urine','Urine strip reader','A',1.005,1.030,'Dipstick marker.','urine'),
    ('urinalysis','urine_glucose','Urine glucose','categorical',null,'urine','Urine strip reader','A',null,null,'Negative, trace, or positive categories.','urine'),
    ('urinalysis','urine_ketones','Urine ketones','categorical',null,'urine','Urine strip reader','A',null,null,'Negative, trace, or positive categories.','urine'),
    ('urinalysis','urine_protein','Urine protein','categorical',null,'urine','Urine strip reader','A',null,null,'Negative, trace, or positive categories.','urine'),
    ('urinalysis','urine_blood','Urine blood','categorical',null,'urine','Urine strip reader','A',null,null,'Hematuria screening.','urine'),
    ('urinalysis','urine_bilirubin','Urine bilirubin','categorical',null,'urine','Urine strip reader','A',null,null,'Dipstick marker.','urine'),
    ('urinalysis','urine_urobilinogen','Urine urobilinogen','categorical',null,'urine','Urine strip reader','A',null,null,'Dipstick marker.','urine'),
    ('urinalysis','urine_nitrite','Urine nitrite','boolean',null,'urine','Urine strip reader','A',null,null,'UTI screening with leukocytes.','urine'),
    ('urinalysis','urine_leukocytes','Urine leukocytes','categorical',null,'urine','Urine strip reader','A',null,null,'UTI screening with nitrite.','urine'),
    ('urinalysis','urine_albumin_mg_l','Urine albumin','numeric','mg/L','urine','Smartphone spectrometer','A',null,30,'CKD early-warning marker.','urine'),
    ('saliva_diagnostics','saliva_cortisol_nmol_l','Saliva cortisol','numeric','nmol/L','saliva','Saliva immunoassay','B',null,null,'Stress and endocrine screening.','saliva'),
    ('saliva_diagnostics','saliva_dhea_ng_ml','Saliva DHEA','numeric','ng/mL','saliva','Saliva immunoassay','B',null,null,'Hormone screening.','saliva'),
    ('saliva_diagnostics','saliva_melatonin_pg_ml','Saliva melatonin','numeric','pg/mL','saliva','Saliva immunoassay','B',null,null,'Sleep and circadian marker.','saliva'),
    ('saliva_diagnostics','saliva_pathogen_result','Saliva pathogen result','categorical',null,'saliva','PCR or antigen','B',null,null,'SARS-CoV-2, influenza, and other pathogen screening.','infection'),
    ('saliva_diagnostics','saliva_dna_rna_marker','Saliva DNA/RNA marker','categorical',null,'saliva','Molecular assay','B',null,null,'HPV and oral cancer marker workflows.','saliva'),
    ('breath_analysis','breath_copd_score','COPD breath VOC score','numeric','score','breath','VOC e-nose plus ML','C',null,null,'Research-stage screening.','breath'),
    ('breath_analysis','breath_asthma_score','Asthma breath VOC score','numeric','score','breath','VOC e-nose plus ML','C',null,null,'Research-stage screening.','breath'),
    ('breath_analysis','breath_lung_cancer_score','Lung cancer breath VOC score','numeric','score','breath','VOC e-nose plus ML','C',null,null,'Research-stage screening.','breath'),
    ('breath_analysis','breath_acetone_ppm','Breath acetone','numeric','ppm','breath','VOC e-nose','C',null,null,'Diabetes and metabolic screening signal.','breath'),
    ('breath_analysis','breath_ammonia_ppm','Breath ammonia','numeric','ppm','breath','VOC e-nose','C',null,null,'Renal screening signal.','breath'),
    ('swab_pathogen','sars_cov_2_result','SARS-CoV-2 result','categorical',null,'nasal_or_throat_swab','Multiplex PCR or antigen','A',null,null,'POC pathogen test.','infection'),
    ('swab_pathogen','influenza_a_result','Influenza A result','categorical',null,'nasal_or_throat_swab','Multiplex PCR or antigen','A',null,null,'POC pathogen test.','infection'),
    ('swab_pathogen','influenza_b_result','Influenza B result','categorical',null,'nasal_or_throat_swab','Multiplex PCR or antigen','A',null,null,'POC pathogen test.','infection'),
    ('swab_pathogen','rsv_result','RSV result','categorical',null,'nasal_or_throat_swab','Multiplex PCR or antigen','A',null,null,'POC pathogen test.','infection'),
    ('ecg_rhythm','ecg_heart_rate_bpm','ECG heart rate','numeric','bpm',null,'1-lead, 6-lead, or patch ECG','A',50,100,'Contact ECG.','cardiac'),
    ('ecg_rhythm','afib_probability','Atrial fibrillation probability','numeric','probability',null,'ECG algorithm','A',0,0.05,'Requires clinical review if elevated.','cardiac'),
    ('ecg_rhythm','qt_interval_ms','QT interval','numeric','ms',null,'ECG algorithm','A',null,null,'Lead and correction dependent.','cardiac'),
    ('skin_eye_imaging','skin_lesion_risk_score','Skin lesion risk score','numeric','score',null,'Dermatology camera plus AI','B',null,null,'Triage only.','imaging'),
    ('skin_eye_imaging','wound_area_cm2','Wound area','numeric','cm2',null,'Dermatology camera','B',0,null,'Wound healing trend.','imaging'),
    ('skin_eye_imaging','diabetic_retinopathy_risk','Diabetic retinopathy risk','categorical',null,null,'Fundus camera plus AI','A',null,null,'Screening workflow established in China.','imaging'),
    ('skin_eye_imaging','glaucoma_risk','Glaucoma risk','categorical',null,null,'Fundus camera plus AI','B',null,null,'Screening and referral workflow.','imaging'),
    ('skin_eye_imaging','pupil_diameter_mm','Pupil diameter','numeric','mm',null,'Pupillometry','B',null,null,'Neurological and fatigue marker.','imaging'),
    ('skin_eye_imaging','fatigue_score','Fatigue score','numeric','score',null,'Pupillometry plus ML','B',null,null,'Screening and trend only.','wellbeing'),
    ('environment','room_temperature_c','Room temperature','numeric','degC',null,'Environment sensor','A',18,26,'Context for thermal and clinical interpretation.','environment'),
    ('environment','relative_humidity_percent','Relative humidity','numeric','%',null,'Environment sensor','A',40,70,'Context for respiratory comfort.','environment'),
    ('environment','co2_ppm','Carbon dioxide','numeric','ppm',null,'Environment sensor','A',null,1000,'Ventilation context.','environment'),
    ('environment','pm25_ug_m3','PM2.5','numeric','ug/m3',null,'Environment sensor','A',null,15,'Air quality context.','environment')
) as v(modality_kind, code, display_name, value_kind, unit, specimen, method, maturity, normal_min, normal_max, precision_notes, dashboard_group)
  on m.kind::text = v.modality_kind;

insert into public.diagnostic_panels
  (code, display_name, modality_id, specimen, expected_turnaround_minutes, maturity, requires_sterile_consumable)
select v.code, v.display_name, m.id, v.specimen, v.expected_turnaround_minutes, v.maturity::public.maturity_grade, v.requires_sterile_consumable
from public.clinical_modalities m
join (
  values
    ('finger_prick_metabolic_panel','Finger-prick metabolic panel','blood_finger_prick','capillary_blood',7,'A',true),
    ('lipid_profile','Lipid profile','blood_finger_prick','capillary_blood',7,'A',true),
    ('urine_10_parameter_strip','Urine 10-parameter strip','urinalysis','urine',5,'A',true),
    ('ckd_urine_screen','CKD urine albumin and hematuria screen','urinalysis','urine',5,'A',true),
    ('saliva_hormone_panel','Saliva hormone panel','saliva_diagnostics','saliva',15,'B',true),
    ('respiratory_multiplex_pcr','Respiratory multiplex PCR','swab_pathogen','nasal_or_throat_swab',45,'A',true),
    ('breath_voc_screen','Breath VOC screen','breath_analysis','breath',3,'C',false),
    ('single_lead_ecg','Single-lead ECG rhythm screen','ecg_rhythm',null,2,'A',false),
    ('skin_eye_screen','Skin and eye imaging screen','skin_eye_imaging',null,5,'B',false)
) as v(code, display_name, modality_kind, specimen, expected_turnaround_minutes, maturity, requires_sterile_consumable)
  on m.kind::text = v.modality_kind;

insert into public.panel_measurements (diagnostic_panel_id, measurement_definition_id, display_order)
select p.id, md.id, row_number() over (partition by p.id order by md.code)
from public.diagnostic_panels p
join public.measurement_definitions md on (
  (p.code = 'finger_prick_metabolic_panel' and md.code in ('hba1c_percent','creatinine_umol_l','hscrp_mg_l','hemoglobin_g_dl','capillary_glucose_mmol_l'))
  or (p.code = 'lipid_profile' and md.code in ('total_cholesterol_mmol_l','hdl_cholesterol_mmol_l','ldl_cholesterol_mmol_l','triglycerides_mmol_l'))
  or (p.code = 'urine_10_parameter_strip' and md.code like 'urine_%' and md.code not in ('urine_albumin_mg_l'))
  or (p.code = 'ckd_urine_screen' and md.code in ('urine_albumin_mg_l','urine_blood','creatinine_umol_l'))
  or (p.code = 'saliva_hormone_panel' and md.code in ('saliva_cortisol_nmol_l','saliva_dhea_ng_ml','saliva_melatonin_pg_ml','saliva_glucose_mmol_l'))
  or (p.code = 'respiratory_multiplex_pcr' and md.code in ('sars_cov_2_result','influenza_a_result','influenza_b_result','rsv_result'))
  or (p.code = 'breath_voc_screen' and md.dashboard_group = 'breath')
  or (p.code = 'single_lead_ecg' and md.dashboard_group = 'cardiac')
  or (p.code = 'skin_eye_screen' and md.dashboard_group = 'imaging')
);

insert into public.clinical_thresholds
  (measurement_definition_id, severity, comparator, lower_bound, upper_bound, label, recommendation)
select
  md.id,
  v.severity::text,
  v.comparator::text,
  v.lower_bound::numeric,
  v.upper_bound::numeric,
  v.label::text,
  v.recommendation::text
from public.measurement_definitions md
join (
  values
    ('spo2_percent','high','lt',92,null,'Low oxygen saturation','Prompt clinical review and confirm with contact pulse oximeter.'),
    ('skin_temperature_c','medium','gte',37.8,null,'Possible fever','Repeat reading and check symptoms.'),
    ('systolic_bp_mmhg','high','gte',180,null,'Severe systolic hypertension','Escalate for urgent clinical assessment.'),
    ('diastolic_bp_mmhg','high','gte',120,null,'Severe diastolic hypertension','Escalate for urgent clinical assessment.'),
    ('hba1c_percent','medium','gte',6.5,null,'Diabetes-range HbA1c','Route to doctor review and care plan.'),
    ('hscrp_mg_l','medium','gt',10,null,'Elevated inflammatory marker','Review infection and inflammation context.'),
    ('urine_nitrite','medium','eq',1,null,'Possible urinary infection','Interpret with leukocytes and symptoms.'),
    ('urine_albumin_mg_l','medium','gt',30,null,'Elevated urine albumin','Consider CKD follow-up pathway.'),
    ('afib_probability','high','gt',0.5,null,'Possible atrial fibrillation','Send ECG strip for clinician review.'),
    ('co2_ppm','medium','gt',1200,null,'Poor ventilation','Notify building operator dashboard.')
) as v(code, severity, comparator, lower_bound, upper_bound, label, recommendation)
  on md.code = v.code;

alter table public.clinical_modalities enable row level security;
alter table public.measurement_definitions enable row level security;
alter table public.diagnostic_panels enable row level security;
alter table public.panel_measurements enable row level security;
alter table public.clinical_thresholds enable row level security;

create policy "Authenticated users can read clinical catalog"
  on public.clinical_modalities for select
  to authenticated
  using (true);

create policy "Authenticated users can read measurement catalog"
  on public.measurement_definitions for select
  to authenticated
  using (true);

create policy "Authenticated users can read diagnostic panels"
  on public.diagnostic_panels for select
  to authenticated
  using (true);

create policy "Authenticated users can read panel measurements"
  on public.panel_measurements for select
  to authenticated
  using (true);

create policy "Authenticated users can read thresholds"
  on public.clinical_thresholds for select
  to authenticated
  using (true);
