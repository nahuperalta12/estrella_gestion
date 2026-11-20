-- Keep units immutable: existing movements and balances use the original unit.
create function public.update_material(p_id uuid, p_name text, p_minimum_stock numeric, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 120
    or p_minimum_stock is null or p_minimum_stock < 0 or p_minimum_stock <> round(p_minimum_stock, 3)
    or p_active is null then raise exception 'invalid material'; end if;
  update public.materials set name = trim(p_name), minimum_stock = p_minimum_stock, active = p_active where id = p_id;
  if not found then raise exception 'material not found'; end if;
end $$;
revoke all on function public.update_material(uuid,text,numeric,boolean) from public, anon;
grant execute on function public.update_material(uuid,text,numeric,boolean) to authenticated;
