-- Administrative corrections keep existing payments and deliveries consistent.
create table public.sales_order_changes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id),
  actor_id uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  previous_values jsonb not null,
  new_values jsonb not null
);
alter table public.sales_order_changes enable row level security;
revoke all on public.sales_order_changes from public, anon, authenticated;
grant select on public.sales_order_changes to authenticated;
create policy sales_order_changes_admin_read on public.sales_order_changes
  for select to authenticated using ((select public.is_active_admin()));

create function public.update_sales_order(
  p_id uuid, p_customer uuid, p_product uuid, p_date date, p_due date,
  p_quantity integer, p_price numeric, p_notes text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.sales_orders%rowtype;
  v_updated public.sales_orders%rowtype;
  v_paid numeric;
  v_delivered bigint;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_id is null or p_customer is null or p_product is null or p_date is null
    or p_quantity is null or p_quantity <= 0 or p_price is null or p_price < 0
    or p_price >= 10000000000000000 or p_price <> round(p_price,2)
    or p_notes is null or length(p_notes) > 2000 then
    raise exception 'invalid order';
  end if;

  -- Payment creation, payment reversal and deliveries lock this same row.
  select * into v_order from public.sales_orders where id=p_id for update;
  if not found then raise exception 'order not found'; end if;
  if p_customer <> v_order.customer_id and not exists(select 1 from public.customers where id=p_customer and active)
     or p_product <> v_order.product_id and not exists(select 1 from public.products where id=p_product and active) then
    raise exception 'customer or product inactive';
  end if;
  select coalesce(sum(c.amount),0) into v_paid from public.customer_payments c
    where c.order_id=p_id and not exists(select 1 from public.payment_reversals r where r.customer_payment_id=c.id);
  select coalesce(sum(d.quantity),0) into v_delivered from public.order_deliveries d where d.order_id=p_id;
  if p_quantity::numeric * p_price < v_paid then raise exception 'order total below payments'; end if;
  if p_quantity < v_delivered then raise exception 'order quantity below deliveries'; end if;
  if v_delivered > 0 and p_product <> v_order.product_id then raise exception 'order has deliveries'; end if;
  if v_order.status='entregado' and p_quantity <> v_order.quantity then raise exception 'delivered order quantity cannot change'; end if;

  update public.sales_orders set customer_id=p_customer, product_id=p_product, ordered_on=p_date,
    due_on=p_due, quantity=p_quantity, unit_price=p_price, notes=trim(p_notes),
    status=case when v_delivered > 0 and p_quantity=v_delivered then 'entregado' else status end
    where id=p_id returning * into v_updated;
  if v_updated is distinct from v_order then
    insert into public.sales_order_changes(order_id,actor_id,previous_values,new_values)
      values(p_id,auth.uid(),to_jsonb(v_order),to_jsonb(v_updated));
  end if;
end $$;
revoke all on function public.update_sales_order(uuid,uuid,uuid,date,date,integer,numeric,text) from public,anon;
grant execute on function public.update_sales_order(uuid,uuid,uuid,date,date,integer,numeric,text) to authenticated;

-- Do not charge stock to a stale product during a concurrent order edit.
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
  -- A concurrent edit may have changed the product after the initial lookup.
  if v_order.product_id <> v_product then raise exception 'order product changed; retry delivery'; end if;
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
