-- Recipes and assignments are immutable snapshots; changes create new versions.
create table public.product_recipes (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  version integer not null check (version > 0), created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id), unique(product_id,version)
);
create table public.recipe_items (
  recipe_id uuid not null references public.product_recipes(id), material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check(quantity > 0), primary key(recipe_id,material_id)
);
create table public.production_assignments (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  collaborator_id uuid not null references public.profiles(id), product_id uuid not null references public.products(id),
  recipe_id uuid not null references public.product_recipes(id), product_label text not null, assigned_quantity integer not null check(assigned_quantity > 0),
  unit_rate numeric(18,2) not null check(unit_rate >= 0), due_on date, notes text not null default '' check(length(notes)<=500),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.production_records (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  assignment_id uuid not null references public.production_assignments(id), collaborator_id uuid not null references public.profiles(id),
  produced_on date not null, quantity integer not null check(quantity > 0), notes text not null default '' check(length(notes)<=500),
  unit_rate numeric(18,2) not null check(unit_rate >= 0), earned numeric(20,2) not null check(earned >= 0), created_at timestamptz not null default now()
);
create table public.production_consumptions (
  production_id uuid not null references public.production_records(id), material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check(quantity > 0), primary key(production_id,material_id)
);
alter table public.product_recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_assignments enable row level security;
alter table public.production_records enable row level security;
alter table public.production_consumptions enable row level security;
revoke all on public.product_recipes,public.recipe_items,public.production_assignments,public.production_records,public.production_consumptions from public,anon,authenticated;
grant select on public.product_recipes,public.recipe_items,public.production_assignments,public.production_records,public.production_consumptions to authenticated;
create policy recipes_admin on public.product_recipes for select to authenticated using ((select public.is_active_admin()));
create policy recipe_items_admin on public.recipe_items for select to authenticated using ((select public.is_active_admin()));
create policy assignments_admin on public.production_assignments for select to authenticated using ((select public.is_active_admin()));
create policy assignments_own on public.production_assignments for select to authenticated using (collaborator_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy recipes_own on public.product_recipes for select to authenticated using (exists(select 1 from public.production_assignments a where a.recipe_id=product_recipes.id and a.collaborator_id=(select auth.uid())));
create policy recipe_items_own on public.recipe_items for select to authenticated using (exists(select 1 from public.production_assignments a where a.recipe_id=recipe_items.recipe_id and a.collaborator_id=(select auth.uid())));
create policy production_admin on public.production_records for select to authenticated using ((select public.is_active_admin()));
create policy production_own on public.production_records for select to authenticated using (collaborator_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy consumptions_admin on public.production_consumptions for select to authenticated using ((select public.is_active_admin()));
create policy consumptions_own on public.production_consumptions for select to authenticated using (exists(select 1 from public.production_records r where r.id=production_id and r.collaborator_id=(select auth.uid())));
create view public.production_assignment_progress with (security_invoker=true) as
  select a.id,coalesce(sum(r.quantity),0)::bigint as produced
  from public.production_assignments a left join public.production_records r on r.assignment_id=a.id group by a.id;
grant select on public.production_assignment_progress to authenticated;

create function public.create_recipe(p_product uuid,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_item jsonb; v_material uuid; v_quantity numeric; v_version integer;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_product is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid recipe'; end if;
  perform 1 from public.products where id=p_product and active for update;
  if not found then raise exception 'product not found or inactive'; end if;
  select coalesce(max(version),0)+1 into v_version from public.product_recipes where product_id=p_product;
  insert into public.product_recipes(product_id,version,created_by) values(p_product,v_version,auth.uid()) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_material := (v_item->>'material')::uuid; v_quantity := (v_item->>'quantity')::numeric;
    if v_material is null or v_quantity is null or v_quantity <= 0 or v_quantity <> round(v_quantity,3) or v_quantity >= 1000000000000000 or not exists(select 1 from public.materials where id=v_material and active) then raise exception 'invalid recipe item'; end if;
    insert into public.recipe_items(recipe_id,material_id,quantity) values(v_id,v_material,v_quantity);
  end loop;
  return v_id;
end $$;

create function public.create_production_assignment(p_key uuid,p_worker uuid,p_product uuid,p_quantity integer,p_rate numeric,p_due date,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.production_assignments%rowtype; v_recipe uuid; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_worker is null or p_product is null or p_quantity is null or p_quantity<=0 or p_rate is null or p_rate<0 or p_rate<>round(p_rate,2) or p_rate>=10000000000000000 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid assignment'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.production_assignments where operation_key=p_key;
  if found then
    if v_existing.collaborator_id<>p_worker or v_existing.product_id<>p_product or v_existing.assigned_quantity<>p_quantity or v_existing.unit_rate<>p_rate or v_existing.due_on is distinct from p_due or v_existing.notes<>trim(p_notes) or v_existing.created_by<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  if not exists(select 1 from public.profiles where id=p_worker and active and role='collaborator') or not exists(select 1 from public.products where id=p_product and active) then raise exception 'worker or product inactive'; end if;
  select id into v_recipe from public.product_recipes where product_id=p_product order by version desc limit 1;
  if v_recipe is null then raise exception 'product has no recipe'; end if;
  insert into public.production_assignments(operation_key,collaborator_id,product_id,recipe_id,product_label,assigned_quantity,unit_rate,due_on,notes,created_by)
    select p_key,p_worker,p_product,v_recipe,concat_ws(' · ',name,size,color),p_quantity,p_rate,p_due,trim(p_notes),auth.uid() from public.products where id=p_product returning id into v_id;
  return v_id;
end $$;

create function public.record_production(p_key uuid,p_assignment uuid,p_date date,p_quantity integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.production_records%rowtype; v_assignment public.production_assignments%rowtype; v_done bigint; v_item record; v_available numeric; v_id uuid; v_user uuid:=auth.uid();
begin
  if not exists(select 1 from public.profiles where id=v_user and active and role='collaborator') then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_assignment is null or p_date is null or p_quantity is null or p_quantity<=0 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid production'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.production_records where operation_key=p_key;
  if found then
    if v_existing.assignment_id<>p_assignment or v_existing.collaborator_id<>v_user or v_existing.produced_on<>p_date or v_existing.quantity<>p_quantity or v_existing.notes<>trim(p_notes) then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select * into v_assignment from public.production_assignments where id=p_assignment and collaborator_id=v_user for update;
  if not found then raise exception 'assignment not found' using errcode='42501'; end if;
  select coalesce(sum(quantity),0) into v_done from public.production_records where assignment_id=p_assignment;
  if v_done+p_quantity>v_assignment.assigned_quantity then raise exception 'quantity exceeds assignment'; end if;
  -- Lock all balances in material UUID order before validating or consuming.
  perform b.material_id from public.custody_balances b join public.recipe_items i on i.material_id=b.material_id where i.recipe_id=v_assignment.recipe_id and b.collaborator_id=v_user order by b.material_id for update of b;
  for v_item in select material_id,quantity from public.recipe_items where recipe_id=v_assignment.recipe_id order by material_id loop
    select quantity into v_available from public.custody_balances where collaborator_id=v_user and material_id=v_item.material_id;
    if not found or v_available < v_item.quantity*p_quantity then raise exception 'insufficient custody stock'; end if;
  end loop;
  insert into public.production_records(operation_key,assignment_id,collaborator_id,produced_on,quantity,notes,unit_rate,earned) values(p_key,p_assignment,v_user,p_date,p_quantity,trim(p_notes),v_assignment.unit_rate,v_assignment.unit_rate*p_quantity) returning id into v_id;
  for v_item in select material_id,quantity from public.recipe_items where recipe_id=v_assignment.recipe_id order by material_id loop
    update public.custody_balances set quantity=quantity-v_item.quantity*p_quantity where collaborator_id=v_user and material_id=v_item.material_id;
    insert into public.production_consumptions(production_id,material_id,quantity) values(v_id,v_item.material_id,v_item.quantity*p_quantity);
  end loop;
  return v_id;
end $$;
revoke all on function public.create_recipe(uuid,jsonb),public.create_production_assignment(uuid,uuid,uuid,integer,numeric,date,text),public.record_production(uuid,uuid,date,integer,text) from public,anon;
grant execute on function public.create_recipe(uuid,jsonb),public.create_production_assignment(uuid,uuid,uuid,integer,numeric,date,text),public.record_production(uuid,uuid,date,integer,text) to authenticated;
