-- Initial warehouse inventory. Every balance change goes through an atomic RPC.
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  unit text not null check (length(trim(unit)) between 1 and 30),
  minimum_stock numeric(18,3) not null default 0 check (minimum_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index materials_unique_name on public.materials (lower(trim(name)));
create table public.warehouse_balances (
  material_id uuid primary key references public.materials(id),
  quantity numeric(18,3) not null default 0 check (quantity >= 0)
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check (quantity <> 0),
  reason text not null check (length(trim(reason)) between 1 and 500),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.materials enable row level security;
alter table public.warehouse_balances enable row level security;
alter table public.inventory_movements enable row level security;
revoke all on public.materials, public.warehouse_balances, public.inventory_movements from anon, authenticated;
grant select on public.materials, public.warehouse_balances, public.inventory_movements to authenticated;
create policy materials_admin_read on public.materials for select to authenticated using ((select public.is_active_admin()));
create policy balances_admin_read on public.warehouse_balances for select to authenticated using ((select public.is_active_admin()));
create policy movements_admin_read on public.inventory_movements for select to authenticated using ((select public.is_active_admin()));

-- SECURITY DEFINER functions provide the only write path. All names are qualified,
-- caller authorization is checked inside the transaction, and EXECUTE is restricted.
create function public.create_material(p_name text, p_unit text, p_minimum_stock numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_name is null or p_unit is null or p_minimum_stock is null or p_minimum_stock < 0 then raise exception 'invalid material'; end if;
  insert into public.materials(name, unit, minimum_stock) values (trim(p_name), trim(p_unit), p_minimum_stock) returning id into v_id;
  insert into public.warehouse_balances(material_id) values (v_id);
  return v_id;
end $$;

create function public.adjust_warehouse_stock(p_key uuid, p_material uuid, p_quantity numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.inventory_movements%rowtype; v_balance numeric; v_id uuid; v_actor uuid := auth.uid();
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_key is null or p_material is null or p_quantity is null or p_quantity = 0 or p_quantity <> round(p_quantity, 3) or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid movement'; end if;
  -- Serialize retries even if the same key is sent with different material IDs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text, 0));
  select * into v_existing from public.inventory_movements where operation_key = p_key;
  if found then
    if v_existing.material_id <> p_material or v_existing.quantity <> p_quantity or v_existing.reason <> trim(p_reason) or v_existing.actor_id <> v_actor then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select b.quantity into v_balance from public.warehouse_balances b join public.materials m on m.id = b.material_id where b.material_id = p_material and m.active for update of b;
  if not found then raise exception 'material not found or inactive'; end if;
  if v_balance + p_quantity < 0 then raise exception 'insufficient stock'; end if;
  update public.warehouse_balances set quantity = quantity + p_quantity where material_id = p_material;
  insert into public.inventory_movements(operation_key, material_id, quantity, reason, actor_id) values (p_key, p_material, p_quantity, trim(p_reason), v_actor) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_material(text,text,numeric) from public, anon;
revoke all on function public.adjust_warehouse_stock(uuid,uuid,numeric,text) from public, anon;
grant execute on function public.create_material(text,text,numeric) to authenticated;
grant execute on function public.adjust_warehouse_stock(uuid,uuid,numeric,text) to authenticated;
