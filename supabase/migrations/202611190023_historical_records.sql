-- Historical facts may be known without their original date or stock history.
alter table public.customer_payments alter column paid_on drop not null;
alter table public.customer_payments add column is_historical boolean not null default false;
alter table public.customer_payments add constraint payment_date_or_historical check (paid_on is not null or is_historical);
alter table public.order_deliveries alter column delivered_on drop not null;
alter table public.order_deliveries add column affects_stock boolean not null default true;
alter table public.order_deliveries add constraint delivery_date_or_historical check (delivered_on is not null or not affects_stock);

create or replace view public.finished_stock with (security_invoker=true) as
 select p.id as product_id,
   coalesce((select sum(d.quantity) from public.production_deliveries d join public.production_assignments a on a.id=d.assignment_id where a.product_id=p.id),0)::bigint as received,
   coalesce((select sum(d.quantity) from public.order_deliveries d join public.sales_orders o on o.id=d.order_id where o.product_id=p.id and d.affects_stock),0)::bigint as delivered
 from public.products p;

create function public.record_historical_customer_payment(p_key uuid,p_order uuid,p_date date,p_amount numeric,p_method text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.customer_payments%rowtype; v_order public.sales_orders%rowtype; v_paid numeric; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_order is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000000000 or p_method is null or length(trim(p_method)) not between 1 and 80 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid payment'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.customer_payments where operation_key=p_key;
  if found then
    if not v_existing.is_historical or v_existing.order_id is distinct from p_order or v_existing.paid_on is distinct from p_date or v_existing.amount is distinct from p_amount or v_existing.method is distinct from trim(p_method) or v_existing.notes is distinct from trim(p_notes) or v_existing.actor_id is distinct from auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select * into v_order from public.sales_orders where id=p_order for update;
  if not found or v_order.status='cancelado' then raise exception 'order not found or cancelled'; end if;
  select coalesce(sum(c.amount),0) into v_paid from public.customer_payments c where c.order_id=p_order and not exists(select 1 from public.payment_reversals r where r.customer_payment_id=c.id);
  if p_amount>v_order.quantity*v_order.unit_price-v_paid then raise exception 'payment exceeds balance'; end if;
  insert into public.customer_payments(operation_key,order_id,paid_on,amount,method,notes,actor_id,is_historical) values(p_key,p_order,p_date,p_amount,trim(p_method),trim(p_notes),auth.uid(),true) returning id into v_id;
  if p_date is not null then
    insert into public.financial_transactions(customer_payment_id,occurred_on,direction,amount,category,notes,actor_id) values(v_id,p_date,'income',p_amount,'Cobro de pedido',trim(p_notes),auth.uid());
  end if;
  return v_id;
end $$;
revoke all on function public.record_historical_customer_payment(uuid,uuid,date,numeric,text,text) from public,anon;
grant execute on function public.record_historical_customer_payment(uuid,uuid,date,numeric,text,text) to authenticated;

create function public.record_historical_order_delivery(p_key uuid,p_order uuid,p_quantity integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.order_deliveries%rowtype; v_order public.sales_orders%rowtype; v_order_delivered bigint; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_order is null or p_quantity is null or p_quantity<=0 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid delivery'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.order_deliveries where operation_key=p_key;
  if found then
    if v_existing.affects_stock or v_existing.delivered_on is not null or v_existing.order_id is distinct from p_order or v_existing.quantity is distinct from p_quantity or v_existing.notes is distinct from trim(p_notes) or v_existing.actor_id is distinct from auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  select * into v_order from public.sales_orders where id=p_order for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status='cancelado' then raise exception 'order cancelled'; end if;
  select coalesce(sum(quantity),0) into v_order_delivered from public.order_deliveries where order_id=p_order;
  if v_order_delivered+p_quantity>v_order.quantity then raise exception 'delivery exceeds order'; end if;
  insert into public.order_deliveries(operation_key,order_id,delivered_on,quantity,notes,actor_id,affects_stock) values(p_key,p_order,null,p_quantity,trim(p_notes),auth.uid(),false) returning id into v_id;
  if v_order_delivered+p_quantity=v_order.quantity then update public.sales_orders set status='entregado' where id=p_order; end if;
  return v_id;
end $$;
revoke all on function public.record_historical_order_delivery(uuid,uuid,integer,text) from public,anon;
grant execute on function public.record_historical_order_delivery(uuid,uuid,integer,text) to authenticated;

-- Keep normal operations separate from historical imports and count only actual stock movements.
create or replace function public.deliver_order(p_key uuid,p_order uuid,p_date date,p_quantity integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.order_deliveries%rowtype; v_order public.sales_orders%rowtype; v_product uuid; v_received bigint; v_total_delivered bigint; v_order_delivered bigint; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_order is null or p_date is null or p_quantity is null or p_quantity<=0 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid delivery'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.order_deliveries where operation_key=p_key;
  if found then
    if not v_existing.affects_stock or v_existing.order_id<>p_order or v_existing.delivered_on is distinct from p_date or v_existing.quantity<>p_quantity or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  -- A shared product lock serializes deliveries for different orders of the same product.
  select product_id into v_product from public.sales_orders where id=p_order;
  if not found then raise exception 'order not found'; end if;
  perform 1 from public.products where id=v_product for update;
  select * into v_order from public.sales_orders where id=p_order for update;
  if v_order.status='cancelado' then raise exception 'order cancelled'; end if;
  select coalesce(sum(quantity),0) into v_order_delivered from public.order_deliveries where order_id=p_order;
  if v_order_delivered+p_quantity>v_order.quantity then raise exception 'delivery exceeds order'; end if;
  select coalesce(sum(d.quantity),0) into v_received from public.production_deliveries d join public.production_assignments a on a.id=d.assignment_id where a.product_id=v_product;
  select coalesce(sum(d.quantity),0) into v_total_delivered from public.order_deliveries d join public.sales_orders o on o.id=d.order_id where o.product_id=v_product and d.affects_stock;
  if v_total_delivered+p_quantity>v_received then raise exception 'insufficient finished stock'; end if;
  insert into public.order_deliveries(operation_key,order_id,delivered_on,quantity,notes,actor_id) values(p_key,p_order,p_date,p_quantity,trim(p_notes),auth.uid()) returning id into v_id;
  if v_order_delivered+p_quantity=v_order.quantity then update public.sales_orders set status='entregado' where id=p_order; end if;
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
    if v_existing.is_historical or v_existing.order_id<>p_order or v_existing.paid_on is distinct from p_date or v_existing.amount<>p_amount or v_existing.method<>trim(p_method) or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
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

-- Undated historical payments have no cash entry to reverse.
create or replace function public.reverse_linked_payment(p_key uuid,p_kind text,p_payment uuid,p_date date,p_reason text)
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
  if not found and not (p_kind='customer' and exists(select 1 from public.customer_payments where id=p_payment and is_historical and paid_on is null)) then raise exception 'linked cash transaction not found'; end if;
  if exists(select 1 from public.payment_reversals where collaborator_payment_id=case when p_kind='collaborator' then p_payment end or customer_payment_id=case when p_kind='customer' then p_payment end or supplier_payment_id=case when p_kind='supplier' then p_payment end) then raise exception 'payment already reversed'; end if;
  insert into public.payment_reversals(operation_key,collaborator_payment_id,customer_payment_id,supplier_payment_id,reversed_on,reason,actor_id)
    values(p_key,case when p_kind='collaborator' then p_payment end,case when p_kind='customer' then p_payment end,case when p_kind='supplier' then p_payment end,p_date,trim(p_reason),auth.uid()) returning id into v_id;
  if v_cash.id is not null then
    insert into public.financial_transactions(reversal_of,occurred_on,direction,amount,category,notes,actor_id)
      values(v_cash.id,p_date,case when v_cash.direction='income' then 'expense' else 'income' end,v_cash.amount,v_cash.category,trim(p_reason),auth.uid());
  end if;
  return v_id;
end $$;
