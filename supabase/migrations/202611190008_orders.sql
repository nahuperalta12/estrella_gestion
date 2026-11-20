-- Initial single-line orders, without payments, reservations or production links.
create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  operation_key uuid not null unique,
  customer_id uuid not null references public.customers(id),
  product_id uuid not null references public.products(id),
  ordered_on date not null,
  due_on date,
  quantity integer not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  status text not null default 'pendiente' check (status in ('pendiente','en_produccion','listo','entregado','cancelado')),
  notes text not null default '' check (length(notes) <= 2000),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.sales_orders enable row level security;
revoke all on public.sales_orders from public, anon, authenticated;
grant select on public.sales_orders to authenticated;
create policy sales_orders_admin_read on public.sales_orders for select to authenticated using ((select public.is_active_admin()));
create function public.create_sales_order(p_key uuid,p_customer uuid,p_product uuid,p_date date,p_due date,p_quantity integer,p_price numeric,p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.sales_orders%rowtype; v_id uuid; v_actor uuid := auth.uid();
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or p_customer is null or p_product is null or p_date is null or p_quantity is null or p_quantity <= 0 or p_price is null or p_price < 0 or p_price >= 10000000000000000 or p_price <> round(p_price,2) or p_notes is null or length(p_notes)>2000 then raise exception 'invalid order'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
  select * into v_existing from public.sales_orders where operation_key=p_key;
  if found then
    if v_existing.actor_id <> v_actor or v_existing.customer_id <> p_customer or v_existing.product_id <> p_product or v_existing.ordered_on <> p_date or v_existing.due_on is distinct from p_due or v_existing.quantity <> p_quantity or v_existing.unit_price <> p_price or v_existing.notes <> trim(p_notes) then raise exception 'operation key already used'; end if;
    return v_existing.id;
  end if;
  if not exists(select 1 from public.customers where id=p_customer and active) or not exists(select 1 from public.products where id=p_product and active) then raise exception 'customer or product inactive'; end if;
  insert into public.sales_orders(operation_key,customer_id,product_id,ordered_on,due_on,quantity,unit_price,notes,actor_id) values(p_key,p_customer,p_product,p_date,p_due,p_quantity,p_price,trim(p_notes),v_actor) returning id into v_id;
  return v_id;
end $$;
create function public.set_sales_order_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_status is null or p_status not in ('pendiente','en_produccion','listo','entregado','cancelado') then raise exception 'invalid status'; end if;
  update public.sales_orders set status=p_status where id=p_id;
  if not found then raise exception 'order not found'; end if;
end $$;
revoke all on function public.create_sales_order(uuid,uuid,uuid,date,date,integer,numeric,text),public.set_sales_order_status(uuid,text) from public,anon;
grant execute on function public.create_sales_order(uuid,uuid,uuid,date,date,integer,numeric,text),public.set_sales_order_status(uuid,text) to authenticated;
