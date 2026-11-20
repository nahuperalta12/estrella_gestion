-- Payments and their cash outflows are inserted together and cannot be edited directly.
create table public.collaborator_payments (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  collaborator_id uuid not null references public.profiles(id), paid_on date not null,
  amount numeric(18,2) not null check(amount>0), method text not null check(length(trim(method)) between 1 and 80),
  notes text not null default '' check(length(notes)<=500), actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(), collaborator_payment_id uuid unique references public.collaborator_payments(id),
  occurred_on date not null, direction text not null check(direction in ('income','expense')),
  amount numeric(18,2) not null check(amount>0), category text not null,
  actor_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.collaborator_payments enable row level security;
alter table public.financial_transactions enable row level security;
revoke all on public.collaborator_payments,public.financial_transactions from public,anon,authenticated;
grant select on public.collaborator_payments,public.financial_transactions to authenticated;
create policy payments_admin on public.collaborator_payments for select to authenticated using ((select public.is_active_admin()));
create policy payments_own on public.collaborator_payments for select to authenticated using (collaborator_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and active));
create policy finances_admin on public.financial_transactions for select to authenticated using ((select public.is_active_admin()));
create view public.collaborator_money with (security_invoker=true) as
  select p.id as collaborator_id,
    coalesce((select sum(r.earned) from public.production_records r where r.collaborator_id=p.id),0)::numeric as earned,
    coalesce((select sum(c.amount) from public.collaborator_payments c where c.collaborator_id=p.id),0)::numeric as paid
  from public.profiles p where p.role='collaborator';
grant select on public.collaborator_money to authenticated;
create function public.pay_collaborator(p_key uuid,p_worker uuid,p_date date,p_amount numeric,p_method text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.collaborator_payments%rowtype; v_earned numeric; v_paid numeric; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_worker is null or p_date is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000000000 or p_method is null or length(trim(p_method)) not between 1 and 80 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid payment'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.collaborator_payments where operation_key=p_key;
  if found then
    if v_existing.collaborator_id<>p_worker or v_existing.paid_on<>p_date or v_existing.amount<>p_amount or v_existing.method<>trim(p_method) or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  perform 1 from public.profiles where id=p_worker and role='collaborator' for update;
  if not found then raise exception 'collaborator not found'; end if;
  select coalesce(sum(earned),0) into v_earned from public.production_records where collaborator_id=p_worker;
  select coalesce(sum(amount),0) into v_paid from public.collaborator_payments where collaborator_id=p_worker;
  if p_amount>v_earned-v_paid then raise exception 'payment exceeds balance'; end if;
  insert into public.collaborator_payments(operation_key,collaborator_id,paid_on,amount,method,notes,actor_id) values(p_key,p_worker,p_date,p_amount,trim(p_method),trim(p_notes),auth.uid()) returning id into v_id;
  insert into public.financial_transactions(collaborator_payment_id,occurred_on,direction,amount,category,actor_id) values(v_id,p_date,'expense',p_amount,'Pago a colaboradora',auth.uid());
  return v_id;
end $$;
revoke all on function public.pay_collaborator(uuid,uuid,date,numeric,text,text) from public,anon;
grant execute on function public.pay_collaborator(uuid,uuid,date,numeric,text,text) to authenticated;
