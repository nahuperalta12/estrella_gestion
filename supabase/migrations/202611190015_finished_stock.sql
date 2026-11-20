-- Previously, "entregado" could be assigned manually without stock movements.
-- Do not silently invent a delivery history on an existing installation.
do $$ begin
  if exists(select 1 from public.sales_orders where status='entregado') then
    raise exception 'reconcile previously delivered orders before applying finished stock migration';
  end if;
end $$;
create table public.order_deliveries (
  id uuid primary key default gen_random_uuid(), operation_key uuid not null unique,
  order_id uuid not null references public.sales_orders(id), delivered_on date not null,
  quantity integer not null check(quantity>0), notes text not null default '' check(length(notes)<=500),
  actor_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.order_deliveries enable row level security;
revoke all on public.order_deliveries from public,anon,authenticated;
grant select on public.order_deliveries to authenticated;
create policy order_deliveries_admin on public.order_deliveries for select to authenticated using ((select public.is_active_admin()));

create view public.finished_stock with (security_invoker=true) as
 select p.id as product_id,
   coalesce((select sum(d.quantity) from public.production_deliveries d join public.production_assignments a on a.id=d.assignment_id where a.product_id=p.id),0)::bigint as received,
   coalesce((select sum(d.quantity) from public.order_deliveries d join public.sales_orders o on o.id=d.order_id where o.product_id=p.id),0)::bigint as delivered
 from public.products p;
create view public.order_delivery_progress with (security_invoker=true) as
 select o.id,coalesce(sum(d.quantity),0)::bigint as delivered from public.sales_orders o left join public.order_deliveries d on d.order_id=o.id group by o.id;
grant select on public.finished_stock,public.order_delivery_progress to authenticated;

create function public.deliver_order(p_key uuid,p_order uuid,p_date date,p_quantity integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing public.order_deliveries%rowtype; v_order public.sales_orders%rowtype; v_product uuid; v_received bigint; v_total_delivered bigint; v_order_delivered bigint; v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_order is null or p_date is null or p_quantity is null or p_quantity<=0 or p_notes is null or length(trim(p_notes))>500 then raise exception 'invalid delivery'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.order_deliveries where operation_key=p_key;
  if found then
    if v_existing.order_id<>p_order or v_existing.delivered_on<>p_date or v_existing.quantity<>p_quantity or v_existing.notes<>trim(p_notes) or v_existing.actor_id<>auth.uid() then raise exception 'operation key already used'; end if;
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
  select coalesce(sum(d.quantity),0) into v_total_delivered from public.order_deliveries d join public.sales_orders o on o.id=d.order_id where o.product_id=v_product;
  if v_total_delivered+p_quantity>v_received then raise exception 'insufficient finished stock'; end if;
  insert into public.order_deliveries(operation_key,order_id,delivered_on,quantity,notes,actor_id) values(p_key,p_order,p_date,p_quantity,trim(p_notes),auth.uid()) returning id into v_id;
  if v_order_delivered+p_quantity=v_order.quantity then update public.sales_orders set status='entregado' where id=p_order; end if;
  return v_id;
end $$;
revoke all on function public.deliver_order(uuid,uuid,date,integer,text) from public,anon;
grant execute on function public.deliver_order(uuid,uuid,date,integer,text) to authenticated;

create or replace function public.set_sales_order_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.sales_orders%rowtype;
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_status is null or p_status not in ('pendiente','en_produccion','listo','cancelado') then raise exception 'invalid status'; end if;
  select * into v_order from public.sales_orders where id=p_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status='entregado' then raise exception 'delivered order cannot change status'; end if;
  if p_status='cancelado' and (exists(select 1 from public.order_deliveries where order_id=p_id) or exists(select 1 from public.customer_payments where order_id=p_id)) then raise exception 'order has deliveries or payments'; end if;
  update public.sales_orders set status=p_status where id=p_id;
end $$;
