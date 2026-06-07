-- Create profiles table for user settings and shipping address
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  full_name text,
  shipping_street text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text default 'US',
  updated_at timestamp with time zone default now(),
  primary key (id)
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using ( auth.uid() = id );

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Users can insert their own profile
create policy "Users can insert own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger (drop first if exists)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
