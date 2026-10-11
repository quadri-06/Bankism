create extension if not exists "pgcrypto";

-- profiles table - extended user info
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- accounts table
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_number text unique not null,
  account_name text not null,
  balance numeric default 0 not null,
  currency text default 'INR' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()
);

alter table public.accounts enable row level security;

create policy "Users can view own accounts" on public.accounts
  for select using (auth.uid() = user_id);

create policy "Users can insert own accounts" on public.accounts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own accounts" on public.accounts
  for update using (auth.uid() = user_id);

-- beneficiaries table
create table if not exists public.beneficiaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  beneficiary_name text not null,
  account_number text not null,
  account_id uuid references public.accounts on delete cascade,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()
);

alter table public.beneficiaries enable row level security;

create policy "Users can view own beneficiaries" on public.beneficiaries
  for select using (auth.uid() = user_id);

create policy "Users can insert own beneficiaries" on public.beneficiaries
  for insert with check (auth.uid() = user_id);

create policy "Users can update own beneficiaries" on public.beneficiaries
  for update using (auth.uid() = user_id);

-- transactions table
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  from_account_id uuid references public.accounts on delete set null,
  to_account_number text not null,
  amount numeric not null,
  currency text default 'INR' not null,
  memo text,
  status text default 'pending' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

-- audit_logs table (insert-only from server using service role)
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  request_id text not null,
  user_id uuid references auth.users on delete set null,
  raw_input text not null,
  normalized_input text,
  verdict jsonb not null,
  threat_category text,
  risk_level text,
  risk_score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()
);

alter table public.audit_logs enable row level security;

create policy "Service role can insert audit logs" on public.audit_logs
  for insert with check (true);

create policy "Service role can view audit logs" on public.audit_logs
  for select using (true);