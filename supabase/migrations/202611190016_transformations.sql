-- A transformation moves quantities between two distinct warehouse materials.
-- Source and output units remain explicit, and the actual quantities are historical facts.
create table public.material_transformations (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  source_material_id uuid not null references public.materials(id),
  result_material_id uuid not null references public.materials(id),
  source_quantity numeric(18,3) not null check(source_quantity>0),
  result_quantity numeric(18,3) not null check(result_quantity>0),
  reason text not null check(length(trim(reason)) between 1 and 500),
  actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check(source_material_id<>result_material_id)
);
alter table public.material_transformations enable row level security;
revoke all on public.material_transformations from public,anon,authenticated;
grant select on public.material_transformations to authenticated;
create policy transformations_admin on public.material_transformations for select to authenticated using ((select public.is_active_admin()));
create function public.transform_material(p_key uuid,p_source uuid,p_result uuid,p_source_quantity numeric,p_result_quantity numeric,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.material_transformations%rowtype; v_id uuid; v_source_move uuid:=gen_random_uuid(); v_result_move uuid:=gen_random_uuid(); v_count integer;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_source is null or p_result is null or p_source=p_result or p_source_quantity is null or p_result_quantity is null or p_source_quantity<=0 or p_result_quantity<=0 or p_source_quantity<>round(p_source_quantity,3) or p_result_quantity<>round(p_result_quantity,3) or p_source_quantity>=1000000000000000 or p_result_quantity>=1000000000000000 or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid transformation'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.material_transformations where operation_key=p_key;
  if found then
    if v_existing.source_material_id<>p_source or v_existing.result_material_id<>p_result or v_existing.source_quantity<>p_source_quantity or v_existing.result_quantity<>p_result_quantity or v_existing.reason<>trim(p_reason) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  -- Acquire both balance locks in a stable order, including opposing transformations.
  perform b.material_id from public.warehouse_balances b join public.materials m on m.id=b.material_id where b.material_id in (p_source,p_result) and m.active order by b.material_id for update of b;
  select count(*) into v_count from public.warehouse_balances b join public.materials m on m.id=b.material_id where b.material_id in (p_source,p_result) and m.active;
  if v_count<>2 then raise exception 'material not found or inactive'; end if;
  insert into public.material_transformations(operation_key,source_material_id,result_material_id,source_quantity,result_quantity,reason,actor_id) values(p_key,p_source,p_result,p_source_quantity,p_result_quantity,trim(p_reason),auth.uid()) returning id into v_id;
  perform public.adjust_warehouse_stock(v_source_move,p_source,-p_source_quantity,'Transformación origen ' || v_id::text);
  perform public.adjust_warehouse_stock(v_result_move,p_result,p_result_quantity,'Transformación resultado ' || v_id::text);
  return v_id;
end $$;
revoke all on function public.transform_material(uuid,uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.transform_material(uuid,uuid,uuid,numeric,numeric,text) to authenticated;
