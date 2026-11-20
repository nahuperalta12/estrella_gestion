-- Conversion reference values are configuration, not recorded stock movements.
create table public.inventory_settings (
  id boolean primary key default true check (id),
  glue_grams_per_pot numeric(18,3) not null check (glue_grams_per_pot > 0),
  glue_grams_per_feather numeric(18,3) not null check (glue_grams_per_feather > 0),
  holographic_rods_per_kg numeric(18,3) not null check (holographic_rods_per_kg > 0),
  fiberglass_segments_per_rod integer not null check (fiberglass_segments_per_rod > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.inventory_settings(id, glue_grams_per_pot, glue_grams_per_feather, holographic_rods_per_kg, fiberglass_segments_per_rod)
values (true, 250, 3, 600, 3);
alter table public.inventory_settings enable row level security;
revoke all on public.inventory_settings from anon, authenticated;
grant select on public.inventory_settings to authenticated;
create policy inventory_settings_admin_read on public.inventory_settings for select to authenticated using ((select public.is_active_admin()));

create function public.update_inventory_settings(p_pot numeric, p_glue numeric, p_rods numeric, p_segments integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode = '42501'; end if;
  if p_pot is null or p_glue is null or p_rods is null or p_segments is null
    or p_pot <= 0 or p_glue <= 0 or p_rods <= 0 or p_segments <= 0
    or p_pot <> round(p_pot, 3) or p_glue <> round(p_glue, 3) or p_rods <> round(p_rods, 3)
    or p_pot >= 1000000000000000 or p_glue >= 1000000000000000 or p_rods >= 1000000000000000
    then raise exception 'invalid settings'; end if;
  update public.inventory_settings set glue_grams_per_pot=p_pot, glue_grams_per_feather=p_glue,
    holographic_rods_per_kg=p_rods, fiberglass_segments_per_rod=p_segments, updated_at=now(), updated_by=auth.uid()
  where id=true;
end $$;
revoke all on function public.update_inventory_settings(numeric,numeric,numeric,integer) from public, anon;
grant execute on function public.update_inventory_settings(numeric,numeric,numeric,integer) to authenticated;
