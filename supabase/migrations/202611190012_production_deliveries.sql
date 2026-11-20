create table public.production_deliveries (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  assignment_id uuid not null references public.production_assignments(id), received_on date not null,
  quantity integer not null check(quantity>0), notes text not null default '' check(length(notes)<=500),
  received_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.production_deliveries enable row level security;
revoke all on public.production_deliveries from public,anon,authenticated;
grant select on public.production_deliveries to authenticated;
create policy production_deliveries_admin on public.production_deliveries for select to authenticated using ((select public.is_active_admin()));
create policy production_deliveries_own on public.production_deliveries for select to authenticated using (exists(select 1 from public.production_assignments a where a.id=assignment_id and a.collaborator_id=(select auth.uid())));
create view public.production_delivery_progress with (security_invoker=true) as
 select a.id,coalesce(sum(d.quantity),0)::bigint as delivered from public.production_assignments a left join public.production_deliveries d on d.assignment_id=a.id group by a.id;
grant select on public.production_delivery_progress to authenticated;
create function public.receive_finished_production(p_key uuid,p_assignment uuid,p_date date,p_quantity integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.production_deliveries%rowtype; v_produced bigint; v_delivered bigint; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_assignment is null or p_date is null or p_quantity is null or p_quantity<=0 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid delivery'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.production_deliveries where operation_key=p_key;
  if found then
    if v_existing.assignment_id<>p_assignment or v_existing.received_on<>p_date or v_existing.quantity<>p_quantity or v_existing.notes<>trim(p_notes) or v_existing.received_by<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  perform 1 from public.production_assignments where id=p_assignment for update;
  if not found then raise exception 'assignment not found'; end if;
  select coalesce(sum(quantity),0) into v_produced from public.production_records where assignment_id=p_assignment;
  select coalesce(sum(quantity),0) into v_delivered from public.production_deliveries where assignment_id=p_assignment;
  if v_delivered+p_quantity>v_produced then raise exception 'delivery exceeds production'; end if;
  insert into public.production_deliveries(operation_key,assignment_id,received_on,quantity,notes,received_by) values(p_key,p_assignment,p_date,p_quantity,trim(p_notes),auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.receive_finished_production(uuid,uuid,date,integer,text) from public,anon;
grant execute on function public.receive_finished_production(uuid,uuid,date,integer,text) to authenticated;
