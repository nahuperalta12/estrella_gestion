-- Totals include only recorded cash transactions, not accrued sales or purchases.
create view public.cash_summary with (security_invoker=true) as
  select coalesce(sum(amount) filter(where direction='income'),0)::numeric as income,
    coalesce(sum(amount) filter(where direction='expense'),0)::numeric as expense
  from public.financial_transactions;
grant select on public.cash_summary to authenticated;
