-- Reversal records keep the original payment immutable and restore its balance.
create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  collaborator_payment_id uuid unique references public.collaborator_payments(id),
  customer_payment_id uuid unique references public.customer_payments(id),
  supplier_payment_id uuid unique references public.supplier_payments(id),
  reversed_on date not null, reason text not null check(length(trim(reason)) between 1 and 500),
  actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check(num_nonnulls(collaborator_payment_id,customer_payment_id,supplier_payment_id)=1)
);
alter table public.payment_reversals enable row level security;
revoke all on public.payment_reversals from public,anon,authenticated;
grant select on public.payment_reversals to authenticated;
create policy reversals_admin_read on public.payment_reversals for select to authenticated using ((select public.is_active_admin()));
create policy reversals_own_read on public.payment_reversals for select to authenticated using (exists(select 1 from public.collaborator_payments p where p.id=collaborator_payment_id and p.collaborator_id=(select auth.uid())));

create or replace view public.collaborator_money with (security_invoker=true) as
 select p.id as collaborator_id,
   coalesce((select sum(r.earned) from public.production_records r where r.collaborator_id=p.id),0)::numeric as earned,
   coalesce((select sum(c.amount) from public.collaborator_payments c where c.collaborator_id=p.id and not exists(select 1 from public.payment_reversals r where r.collaborator_payment_id=c.id)),0)::numeric as paid
 from public.profiles p where p.role='collaborator';
create or replace view public.sales_order_payment_progress with (security_invoker=true) as
 select o.id,coalesce(sum(p.amount) filter(where r.id is null),0)::numeric as paid from public.sales_orders o left join public.customer_payments p on p.order_id=o.id left join public.payment_reversals r on r.customer_payment_id=p.id group by o.id;
create or replace view public.purchase_payment_progress with (security_invoker=true) as
 select p.id,coalesce(sum(s.amount) filter(where r.id is null),0)::numeric as paid from public.purchases p left join public.supplier_payments s on s.purchase_id=p.id left join public.payment_reversals r on r.supplier_payment_id=s.id group by p.id;

create function public.reverse_linked_payment(p_key uuid,p_kind text,p_payment uuid,p_date date,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.payment_reversals%rowtype; v_parent uuid; v_cash public.financial_transactions%rowtype; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_kind is null or p_kind not in ('collaborator','customer','supplier') or p_payment is null or p_date is null or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'invalid reversal'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.payment_reversals where operation_key=p_key;
  if found then
    if (case p_kind when 'collaborator' then v_existing.collaborator_payment_id when 'customer' then v_existing.customer_payment_id else v_existing.supplier_payment_id end) is distinct from p_payment or v_existing.reversed_on<>p_date or v_existing.reason<>trim(p_reason) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  -- Lock the same parent row used by payment creation, before checking its balance.
  if p_kind='collaborator' then
    select collaborator_id into v_parent from public.collaborator_payments where id=p_payment;
    if not found then raise exception 'payment not found'; end if;
    perform 1 from public.profiles where id=v_parent for update;
    select * into v_cash from public.financial_transactions where collaborator_payment_id=p_payment;
  elsif p_kind='customer' then
    select order_id into v_parent from public.customer_payments where id=p_payment;
    if not found then raise exception 'payment not found'; end if;
    perform 1 from public.sales_orders where id=v_parent for update;
    select * into v_cash from public.financial_transactions where customer_payment_id=p_payment;
  else
    select purchase_id into v_parent from public.supplier_payments where id=p_payment;
    if not found then raise exception 'payment not found'; end if;
    perform 1 from public.purchases where id=v_parent for update;
    select * into v_cash from public.financial_transactions where supplier_payment_id=p_payment;
  end if;
  if not found then raise exception 'linked cash transaction not found'; end if;
  if exists(select 1 from public.payment_reversals where collaborator_payment_id=case when p_kind='collaborator' then p_payment end or customer_payment_id=case when p_kind='customer' then p_payment end or supplier_payment_id=case when p_kind='supplier' then p_payment end) then raise exception 'payment already reversed'; end if;
  insert into public.payment_reversals(operation_key,collaborator_payment_id,customer_payment_id,supplier_payment_id,reversed_on,reason,actor_id)
    values(p_key,case when p_kind='collaborator' then p_payment end,case when p_kind='customer' then p_payment end,case when p_kind='supplier' then p_payment end,p_date,trim(p_reason),auth.uid()) returning id into v_id;
  insert into public.financial_transactions(reversal_of,occurred_on,direction,amount,category,notes,actor_id)
    values(v_cash.id,p_date,case when v_cash.direction='income' then 'expense' else 'income' end,v_cash.amount,v_cash.category,trim(p_reason),auth.uid());
  return v_id;
end $$;
revoke all on function public.reverse_linked_payment(uuid,text,uuid,date,text) from public,anon;
grant execute on function public.reverse_linked_payment(uuid,text,uuid,date,text) to authenticated;


create or replace function public.pay_collaborator(p_key uuid,p_worker uuid,p_date date,p_amount numeric,p_method text,p_notes text)
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
  select coalesce(sum(c.amount),0) into v_paid from public.collaborator_payments c where c.collaborator_id=p_worker and not exists(select 1 from public.payment_reversals r where r.collaborator_payment_id=c.id);
  if p_amount>v_earned-v_paid then raise exception 'payment exceeds balance'; end if;
  insert into public.collaborator_payments(operation_key,collaborator_id,paid_on,amount,method,notes,actor_id) values(p_key,p_worker,p_date,p_amount,trim(p_method),trim(p_notes),auth.uid()) returning id into v_id;
  insert into public.financial_transactions(collaborator_payment_id,occurred_on,direction,amount,category,actor_id) values(v_id,p_date,'expense',p_amount,'Pago a colaboradora',auth.uid());
  return v_id;
end $$;

create or replace function public.record_customer_payment(p_key uuid,p_order uuid,p_date date,p_amount numeric,p_method text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.customer_payments%rowtype; v_order public.sales_orders%rowtype; v_paid numeric; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_order is null or p_date is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000000000 or p_method is null or length(trim(p_method)) not between 1 and 80 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid payment'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.customer_payments where operation_key=p_key;
  if found then
    if v_existing.order_id<>p_order or v_existing.paid_on<>p_date or v_existing.amount<>p_amount or v_existing.method<>trim(p_method) or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select * into v_order from public.sales_orders where id=p_order for update;
  if not found or v_order.status='cancelado' then raise exception 'order not found or cancelled'; end if;
  select coalesce(sum(c.amount),0) into v_paid from public.customer_payments c where c.order_id=p_order and not exists(select 1 from public.payment_reversals r where r.customer_payment_id=c.id);
  if p_amount > v_order.quantity*v_order.unit_price-v_paid then raise exception 'payment exceeds balance'; end if;
  insert into public.customer_payments(operation_key,order_id,paid_on,amount,method,notes,actor_id) values(p_key,p_order,p_date,p_amount,trim(p_method),trim(p_notes),auth.uid()) returning id into v_id;
  insert into public.financial_transactions(customer_payment_id,occurred_on,direction,amount,category,actor_id) values(v_id,p_date,'income',p_amount,'Cobro de pedido',auth.uid());
  return v_id;
end $$;

create or replace function public.pay_supplier(p_key uuid,p_purchase uuid,p_date date,p_amount numeric,p_method text,p_notes text)
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
  select coalesce(sum(s.amount),0) into v_paid from public.supplier_payments s where s.purchase_id=p_purchase and not exists(select 1 from public.payment_reversals r where r.supplier_payment_id=s.id);
  if p_amount>v_purchase.total_cost-v_paid then raise exception 'payment exceeds balance'; end if;
  insert into public.supplier_payments(operation_key,purchase_id,paid_on,amount,method,notes,actor_id) values(p_key,p_purchase,p_date,p_amount,trim(p_method),trim(p_notes),auth.uid()) returning id into v_id;
  insert into public.financial_transactions(supplier_payment_id,occurred_on,direction,amount,category,actor_id) values(v_id,p_date,'expense',p_amount,'Pago de compra',auth.uid());
  return v_id;
end $$;

create or replace function public.set_sales_order_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.sales_orders%rowtype;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_status is null or p_status not in ('pendiente','en_produccion','listo','cancelado') then raise exception 'invalid status'; end if;
  select * into v_order from public.sales_orders where id=p_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status='entregado' then raise exception 'delivered order cannot change status'; end if;
  if p_status='cancelado' and (exists(select 1 from public.order_deliveries where order_id=p_id) or exists(select 1 from public.customer_payments c where c.order_id=p_id and not exists(select 1 from public.payment_reversals r where r.customer_payment_id=c.id))) then raise exception 'order has deliveries or payments'; end if;
  update public.sales_orders set status=p_status where id=p_id;
end $$;
