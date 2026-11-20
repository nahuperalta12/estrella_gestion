-- Administrative catalogs; operational orders and recipe versions are separate.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  phone text check (length(phone) <= 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  size text check (length(size) <= 80),
  color text check (length(color) <= 80),
  description text check (length(description) <= 2000),
  suggested_price numeric(18,2) not null default 0 check (suggested_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;
alter table public.products enable row level security;
revoke all on public.customers, public.products from public, anon, authenticated;
grant select on public.customers, public.products to authenticated;
create policy customers_admin_read on public.customers for select to authenticated using ((select public.is_active_admin()));
create policy products_admin_read on public.products for select to authenticated using ((select public.is_active_admin()));

create function public.save_customer(p_id uuid, p_name text, p_phone text, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 or length(p_phone) > 40 or p_active is null then raise exception 'invalid customer'; end if;
  if p_id is null then
    insert into public.customers(name,phone,active) values (trim(p_name),nullif(trim(p_phone),''),p_active) returning id into v_id;
  else
    update public.customers set name=trim(p_name),phone=nullif(trim(p_phone),''),active=p_active,updated_at=now() where id=p_id returning id into v_id;
    if not found then raise exception 'customer not found'; end if;
  end if;
  return v_id;
end $$;
create function public.save_product(p_id uuid, p_name text, p_size text, p_color text, p_description text, p_price numeric, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 or length(p_size)>80 or length(p_color)>80 or length(p_description)>2000 or p_price is null or p_price < 0 or p_price <> round(p_price,2) or p_price >= 10000000000000000 or p_active is null then raise exception 'invalid product'; end if;
  if p_id is null then
    insert into public.products(name,size,color,description,suggested_price,active) values(trim(p_name),nullif(trim(p_size),''),nullif(trim(p_color),''),nullif(trim(p_description),''),p_price,p_active) returning id into v_id;
  else
    update public.products set name=trim(p_name),size=nullif(trim(p_size),''),color=nullif(trim(p_color),''),description=nullif(trim(p_description),''),suggested_price=p_price,active=p_active,updated_at=now() where id=p_id returning id into v_id;
    if not found then raise exception 'product not found'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.save_customer(uuid,text,text,boolean) from public, anon;
revoke all on function public.save_product(uuid,text,text,text,text,numeric,boolean) from public, anon;
grant execute on function public.save_customer(uuid,text,text,boolean), public.save_product(uuid,text,text,text,text,numeric,boolean) to authenticated;
