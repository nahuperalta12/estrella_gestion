create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  purchase_id uuid not null references public.purchases(id), paid_on date not null,
  amount numeric(18,2) not null check(amount>0), method text not null check(length(trim(method)) between 1 and 80),
  notes text not null default '' check(length(notes)<=500), actor_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.supplier_payments enable row level security;
revoke all on public.supplier_payments from public,anon,authenticated;
grant select on public.supplier_payments to authenticated;
create policy supplier_payments_admin on public.supplier_payments for select to authenticated using ((select public.is_active_admin()));
alter table public.financial_transactions add column supplier_payment_id uuid unique references public.supplier_payments(id);
create view public.purchase_payment_progress with (security_invoker=true) as
  select p.id,coalesce(sum(s.amount),0)::numeric as paid from public.purchases p left join public.supplier_payments s on s.purchase_id=p.id group by p.id;
grant select on public.purchase_payment_progress to authenticated;
create function public.pay_supplier(p_key uuid,p_purchase uuid,p_date date,p_amount numeric,p_method text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.supplier_payments%rowtype; v_purchase public.purchases%rowtype; v_paid numeric; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_purchase is null or p_date is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000000000 or p_method is null or length(trim(p_method)) not between 1 and 80 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid payment'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.supplier_payments where operation_key=p_key;
  if found then
    if v_existing.purchase_id<>p_purchase or v_existing.paid_on<>p_date or v_existing.amount<>p_amount or v_existing.method<>trim(p_method) or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select * into v_purchase from public.purchases where id=p_purchase for update;
  if not found then raise exception 'purchase not found'; end if;
  select coalesce(sum(amount),0) into v_paid from public.supplier_payments where purchase_id=p_purchase;
  if p_amount>v_purchase.total_cost-v_paid then raise exception 'payment exceeds balance'; end if;
  insert into public.supplier_payments(operation_key,purchase_id,paid_on,amount,method,notes,actor_id) values(p_key,p_purchase,p_date,p_amount,trim(p_method),trim(p_notes),auth.uid()) returning id into v_id;
  insert into public.financial_transactions(supplier_payment_id,occurred_on,direction,amount,category,actor_id) values(v_id,p_date,'expense',p_amount,'Pago de compra',auth.uid());
  return v_id;
end $$;
revoke all on function public.pay_supplier(uuid,uuid,date,numeric,text,text) from public,anon;
grant execute on function public.pay_supplier(uuid,uuid,date,numeric,text,text) to authenticated;
