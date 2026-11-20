-- Dispatch moves stock from the warehouse into transit. Confirmation moves it to custody.
create table public.custody_balances (
  collaborator_id uuid not null references public.profiles(id),
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null default 0 check (quantity >= 0),
  primary key (collaborator_id, material_id)
);
create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  collaborator_id uuid not null references public.profiles(id),
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check (quantity > 0),
  notes text not null default '' check (length(notes) <= 500),
  dispatched_by uuid not null references auth.users(id),
  dispatched_at timestamptz not null default now(),
  received_at timestamptz
);
alter table public.custody_balances enable row level security;
alter table public.stock_transfers enable row level security;
revoke all on public.custody_balances, public.stock_transfers from public, anon, authenticated;
grant select on public.custody_balances, public.stock_transfers to authenticated;
create policy custody_admin_read on public.custody_balances for select to authenticated using ((select public.is_active_admin()));
create policy custody_own_read on public.custody_balances for select to authenticated using (collaborator_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy transfer_admin_read on public.stock_transfers for select to authenticated using ((select public.is_active_admin()));
create policy transfer_own_read on public.stock_transfers for select to authenticated using (collaborator_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and active));
-- Collaborators may see only names and units of materials that were dispatched to them.
create policy materials_custody_read on public.materials for select to authenticated using (exists(select 1 from public.stock_transfers t where t.material_id=materials.id and t.collaborator_id=(select auth.uid())));

create function public.dispatch_stock(p_key uuid,p_collaborator uuid,p_material uuid,p_quantity numeric,p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.stock_transfers%rowtype; v_id uuid; v_actor uuid := auth.uid();
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_collaborator is null or p_material is null or p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity,3) or p_quantity >= 1000000000000000 or p_notes is null or length(trim(p_notes)) > 500 then raise exception 'invalid transfer'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.stock_transfers where operation_key=p_key;
  if found then
    if v_existing.collaborator_id <> p_collaborator or v_existing.material_id <> p_material or v_existing.quantity <> p_quantity or v_existing.notes <> trim(p_notes) or v_existing.dispatched_by <> v_actor then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  if not exists(select 1 from public.profiles where id=p_collaborator and active and role='collaborator') then raise exception 'collaborator not found or inactive'; end if;
  insert into public.stock_transfers(operation_key,collaborator_id,material_id,quantity,notes,dispatched_by) values(p_key,p_collaborator,p_material,p_quantity,trim(p_notes),v_actor) returning id into v_id;
  perform public.adjust_warehouse_stock(v_id,p_material,-p_quantity,'Despacho de entrega ' || v_id::text);
  return v_id;
end $$;
create function public.confirm_stock_receipt(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_transfer public.stock_transfers%rowtype;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and role='collaborator') then raise exception 'access denied' using errcode='42501'; end if;
  select * into v_transfer from public.stock_transfers where id=p_id and collaborator_id=auth.uid() for update;
  if not found then raise exception 'transfer not found' using errcode='42501'; end if;
  if v_transfer.received_at is not null then return; end if;
  insert into public.custody_balances(collaborator_id,material_id,quantity) values(v_transfer.collaborator_id,v_transfer.material_id,v_transfer.quantity)
    on conflict (collaborator_id,material_id) do update set quantity=public.custody_balances.quantity+excluded.quantity;
  update public.stock_transfers set received_at=now() where id=p_id;
end $$;
revoke all on function public.dispatch_stock(uuid,uuid,uuid,numeric,text),public.confirm_stock_receipt(uuid) from public, anon;
grant execute on function public.dispatch_stock(uuid,uuid,uuid,numeric,text),public.confirm_stock_receipt(uuid) to authenticated;
