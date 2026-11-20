-- Initial purchase workflow: one material per record, receipt separate from purchase.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  supplier_id uuid references public.suppliers(id),
  material_id uuid not null references public.materials(id),
  purchased_on date not null,
  quantity numeric(18,3) not null check (quantity > 0),
  total_cost numeric(18,2) not null check (total_cost >= 0),
  notes text not null default '' check (length(notes) <= 2000),
  received_at timestamptz,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
revoke all on public.purchases from public, anon, authenticated;
grant select on public.purchases to authenticated;
create policy purchases_admin_read on public.purchases for select to authenticated using ((select public.is_active_admin()));

create function public.create_purchase(p_key uuid, p_supplier uuid, p_material uuid, p_date date, p_quantity numeric, p_total numeric, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.purchases%rowtype; v_id uuid; v_actor uuid := auth.uid();
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_material is null or p_date is null or p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity,3) or p_quantity >= 1000000000000000 or p_total is null or p_total < 0 or p_total <> round(p_total,2) or p_total >= 10000000000000000 or p_notes is null or length(p_notes)>2000 then raise exception 'invalid purchase'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.purchases where operation_key=p_key;
  if found then
    if v_existing.actor_id <> v_actor or v_existing.supplier_id is distinct from p_supplier or v_existing.material_id <> p_material or v_existing.purchased_on <> p_date or v_existing.quantity <> p_quantity or v_existing.total_cost <> p_total or v_existing.notes <> trim(p_notes) then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  if not exists(select 1 from public.materials where id=p_material and active) then raise exception 'material not found or inactive'; end if;
  if p_supplier is not null and not exists(select 1 from public.suppliers where id=p_supplier and active) then raise exception 'supplier not found or inactive'; end if;
  insert into public.purchases(operation_key,supplier_id,material_id,purchased_on,quantity,total_cost,notes,actor_id) values(p_key,p_supplier,p_material,p_date,p_quantity,p_total,trim(p_notes),v_actor) returning id into v_id;
  return v_id;
end $$;

create function public.receive_purchase(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_purchase public.purchases%rowtype;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  select * into v_purchase from public.purchases where id=p_id for update;
  if not found then raise exception 'purchase not found'; end if;
  if v_purchase.received_at is not null then return; end if;
  -- The purchase UUID is the movement key, so retries cannot duplicate the receipt.
  perform public.adjust_warehouse_stock(v_purchase.id, v_purchase.material_id, v_purchase.quantity, 'Recepción de compra ' || v_purchase.id::text);
  update public.purchases set received_at=now() where id=p_id;
end $$;
revoke all on function public.create_purchase(uuid,uuid,uuid,date,numeric,numeric,text), public.receive_purchase(uuid) from public, anon;
grant execute on function public.create_purchase(uuid,uuid,uuid,date,numeric,numeric,text), public.receive_purchase(uuid) to authenticated;
