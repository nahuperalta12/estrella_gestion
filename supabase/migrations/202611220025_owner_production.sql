-- Owner production consumes warehouse materials and never creates remuneration.
alter table public.production_assignments add column owner_production boolean not null default false;
alter table public.production_assignments add constraint owner_production_zero_rate
  check (not owner_production or unit_rate = 0);

create function public.record_owner_production(p_key uuid,p_product uuid,p_date date,p_quantity integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid(); v_existing public.production_records%rowtype;
  v_assignment public.production_assignments%rowtype; v_recipe uuid; v_item record;
  v_assignment_id uuid; v_record_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_product is null or p_date is null or p_quantity is null or p_quantity<=0
    or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid production'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.production_records where operation_key=p_key;
  if found then
    select * into v_assignment from public.production_assignments where id=v_existing.assignment_id;
    if not v_assignment.owner_production or v_assignment.product_id<>p_product
      or v_existing.collaborator_id<>v_user or v_existing.produced_on<>p_date
      or v_existing.quantity<>p_quantity or v_existing.notes<>trim(p_notes) then
      raise exception 'operation key already used';
    end if;
    return v_existing.id;
  end if;
  if not exists(select 1 from public.products where id=p_product and active) then raise exception 'product not found or inactive'; end if;
  select id into v_recipe from public.product_recipes where product_id=p_product order by version desc limit 1;
  if v_recipe is null then raise exception 'product has no recipe'; end if;
  -- Lock balances in a stable order; the transaction rolls back all changes on failure.
  perform b.material_id from public.warehouse_balances b
    join public.recipe_items i on i.material_id=b.material_id
    where i.recipe_id=v_recipe order by b.material_id for update of b;
  insert into public.production_assignments(operation_key,collaborator_id,product_id,recipe_id,product_label,assigned_quantity,unit_rate,notes,created_by,owner_production)
    select gen_random_uuid(),v_user,p_product,v_recipe,concat_ws(' · ',name,size,color),p_quantity,0,trim(p_notes),v_user,true
    from public.products where id=p_product returning id into v_assignment_id;
  insert into public.production_records(operation_key,assignment_id,collaborator_id,produced_on,quantity,notes,unit_rate,earned)
    values(p_key,v_assignment_id,v_user,p_date,p_quantity,trim(p_notes),0,0) returning id into v_record_id;
  for v_item in select material_id,quantity from public.recipe_items where recipe_id=v_recipe order by material_id loop
    perform public.adjust_warehouse_stock(gen_random_uuid(),v_item.material_id,-v_item.quantity*p_quantity,'Producción propia ' || v_record_id::text);
    insert into public.production_consumptions(production_id,material_id,quantity)
      values(v_record_id,v_item.material_id,v_item.quantity*p_quantity);
  end loop;
  return v_record_id;
end $$;
revoke all on function public.record_owner_production(uuid,uuid,date,integer,text) from public,anon;
grant execute on function public.record_owner_production(uuid,uuid,date,integer,text) to authenticated;

create view public.owner_production_summary with (security_invoker=true) as
  select coalesce(sum(r.quantity),0)::bigint as produced
  from public.production_records r join public.production_assignments a on a.id=r.assignment_id
  where a.owner_production and r.collaborator_id=(select auth.uid()) and (select public.is_active_admin());
grant select on public.owner_production_summary to authenticated;
