-- Manual entries cover other cash flows only; linked payments use their own RPCs.
alter table public.financial_transactions add column operation_key uuid unique;
alter table public.financial_transactions add column notes text not null default '' check(length(notes)<=500);
create function public.record_other_cash(p_key uuid,p_date date,p_direction text,p_amount numeric,p_category text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.financial_transactions%rowtype; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_date is null or p_direction is null or p_direction not in ('income','expense') or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000000000 or p_category is null or length(trim(p_category)) not between 1 and 80 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid cash entry'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.financial_transactions where operation_key=p_key;
  if found then
    if v_existing.occurred_on<>p_date or v_existing.direction<>p_direction or v_existing.amount<>p_amount or v_existing.category<>trim(p_category) or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  insert into public.financial_transactions(operation_key,occurred_on,direction,amount,category,notes,actor_id) values(p_key,p_date,p_direction,p_amount,trim(p_category),trim(p_notes),auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_other_cash(uuid,date,text,numeric,text,text) from public,anon;
grant execute on function public.record_other_cash(uuid,date,text,numeric,text,text) to authenticated;
