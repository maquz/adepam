-- Create the customers table
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tailor_id uuid not null references auth.users(id) on delete cascade,
  date text,
  name text not null,
  contact text,
  charge text,
  unit text,
  m jsonb,
  material text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.customers enable row level security;

-- Policy: Tailors can only see their own customers
create policy "Tailors can view own customers"
  on public.customers for select
  using ( auth.uid() = tailor_id );

-- Policy: Tailors can only insert their own customers
create policy "Tailors can insert own customers"
  on public.customers for insert
  with check ( auth.uid() = tailor_id );

-- Policy: Tailors can only update their own customers
create policy "Tailors can update own customers"
  on public.customers for update
  using ( auth.uid() = tailor_id );

-- Policy: Tailors can only delete their own customers
create policy "Tailors can delete own customers"
  on public.customers for delete
  using ( auth.uid() = tailor_id );
