-- Only manually entered cash movements can be reversed here. Linked payments
-- require dedicated reversals that also restore the corresponding balances.
alter table public.financial_transactions add column reversal_of uuid unique references public.financial_transactions(id);
alter table public.financial_transactions add constraint cash_reversal_not_self check (reversal_of is null or reversal_of<>id);

create function public.reverse_other_cash(p_key uuid,p_original uuid,p_date date,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.financial_transactions%rowtype; v_original public.financial_transactions%rowtype; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_original is null or p_date is null or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid reversal'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.financial_transactions where operation_key=p_key;
  if found then
    if v_existing.reversal_of is distinct from p_original or v_existing.occurred_on<>p_date or v_existing.notes<>trim(p_reason) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select * into v_original from public.financial_transactions where id=p_original for update;
  if not found or v_original.operation_key is null or v_original.reversal_of is not null then raise exception 'cash entry cannot be reversed'; end if;
  if exists(select 1 from public.financial_transactions where reversal_of=p_original) then raise exception 'cash entry already reversed'; end if;
  insert into public.financial_transactions(operation_key,reversal_of,occurred_on,direction,amount,category,notes,actor_id)
    values(p_key,p_original,p_date,case when v_original.direction='income' then 'expense' else 'income' end,v_original.amount,v_original.category,trim(p_reason),auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reverse_other_cash(uuid,uuid,date,text) from public,anon;
grant execute on function public.reverse_other_cash(uuid,uuid,date,text) to authenticated;

-- Do not treat the key of a reversal as a successful retry of an ordinary entry.
create or replace function public.record_other_cash(p_key uuid,p_date date,p_direction text,p_amount numeric,p_category text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.financial_transactions%rowtype; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_date is null or p_direction is null or p_direction not in ('income','expense') or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000000000 or p_category is null or length(trim(p_category)) not between 1 and 80 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid cash entry'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.financial_transactions where operation_key=p_key;
  if found then
    if v_existing.reversal_of is not null or v_existing.occurred_on<>p_date or v_existing.direction<>p_direction or v_existing.amount<>p_amount or v_existing.category<>trim(p_category) or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  insert into public.financial_transactions(operation_key,occurred_on,direction,amount,category,notes,actor_id) values(p_key,p_date,p_direction,p_amount,trim(p_category),trim(p_notes),auth.uid()) returning id into v_id;
  return v_id;
end $$;
