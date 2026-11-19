-- Supplier records are only visible and writable to active administrators.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  contact text check (contact is null or length(contact) <= 120),
  phone text check (phone is null or length(phone) <= 40),
  email text check (email is null or length(email) <= 254),
  notes text check (notes is null or length(notes) <= 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index suppliers_unique_name on public.suppliers (lower(trim(name)));
alter table public.suppliers enable row level security;
revoke all on public.suppliers from anon, authenticated;
grant select on public.suppliers to authenticated;
create policy suppliers_admin_read on public.suppliers for select to authenticated
  using ((select public.is_active_admin()));

-- The sole write path checks the current user's active admin role.
create function public.save_supplier(p_id uuid, p_name text, p_contact text, p_phone text, p_email text, p_notes text, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 or p_active is null then raise exception 'invalid supplier'; end if;
  if p_id is null then
    insert into public.suppliers(name, contact, phone, email, notes, active)
    values (trim(p_name), nullif(trim(p_contact), ''), nullif(trim(p_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_notes), ''), p_active)
    returning id into v_id;
  else
    update public.suppliers set name=trim(p_name), contact=nullif(trim(p_contact), ''), phone=nullif(trim(p_phone), ''), email=nullif(trim(p_email), ''), notes=nullif(trim(p_notes), ''), active=p_active, updated_at=now()
    where id=p_id returning id into v_id;
    if not found then raise exception 'supplier not found'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.save_supplier(uuid,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.save_supplier(uuid,text,text,text,text,text,boolean) to authenticated;
