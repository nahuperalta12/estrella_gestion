-- Security-invoker views preserve the caller's RLS policies.
create view public.dashboard_administration with (security_invoker=true) as
 select
   (select coalesce(sum(quantity),0) from public.production_records)::bigint as produced,
   (select coalesce(sum(a.assigned_quantity-coalesce(p.produced,0)),0) from public.production_assignments a left join public.production_assignment_progress p on p.id=a.id)::bigint as pending,
   (select coalesce(sum(coalesce(p.produced,0)-coalesce(d.delivered,0)),0) from public.production_assignments a left join public.production_assignment_progress p on p.id=a.id left join public.production_delivery_progress d on d.id=a.id)::bigint as awaiting_receipt,
   (select count(*) from public.materials m join public.warehouse_balances b on b.material_id=m.id where m.active and b.quantity<=m.minimum_stock)::bigint as low_stock,
   (select count(*) from public.profiles where active and role='collaborator')::bigint as active_collaborators,
   (select count(*) from public.sales_orders where status not in ('entregado','cancelado'))::bigint as open_orders,
   (select coalesce(sum(quantity*unit_price),0) from public.sales_orders where status<>'cancelado' and date_trunc('month',ordered_on::timestamp)=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'))::numeric as agreed_sales_month,
   (select coalesce(sum(amount),0) from public.financial_transactions where direction='income' and date_trunc('month',occurred_on::timestamp)=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'))::numeric as cash_income_month,
   (select coalesce(sum(amount),0) from public.financial_transactions where direction='expense' and date_trunc('month',occurred_on::timestamp)=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'))::numeric as cash_expense_month,
   (select coalesce(sum(earned-paid),0) from public.collaborator_money)::numeric as owed_collaborators;
create view public.dashboard_collaborator with (security_invoker=true) as
 select
   (select coalesce(sum(a.assigned_quantity-coalesce(p.produced,0)),0) from public.production_assignments a left join public.production_assignment_progress p on p.id=a.id)::bigint as pending,
   (select coalesce(sum(quantity),0) from public.production_records)::bigint as produced,
   (select coalesce(sum(quantity),0) from public.production_records where date_trunc('month',produced_on::timestamp)=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'))::bigint as produced_month,
   (select coalesce(sum(earned-paid),0) from public.collaborator_money)::numeric as owed,
   (select count(*) from public.stock_transfers where received_at is null)::bigint as pending_transfers;
grant select on public.dashboard_administration,public.dashboard_collaborator to authenticated;
