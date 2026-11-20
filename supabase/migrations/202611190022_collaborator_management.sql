-- Only active admins may attach or update collaborator profiles.
-- Authentication accounts are created separately by the trusted server.
create function public.register_collaborator(p_user uuid,p_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_user is null or p_name is null or length(trim(p_name)) not between 1 and 100 then raise exception 'invalid collaborator'; end if;
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'authentication user not found'; end if;
  insert into public.profiles(id,display_name,role,active) values(p_user,trim(p_name),'collaborator',true);
end $$;
create function public.update_collaborator(p_user uuid,p_name text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_active_admin() then raise exception 'access denied' using errcode='42501'; end if;
  if p_user is null or p_name is null or length(trim(p_name)) not between 1 and 100 or p_active is null then raise exception 'invalid collaborator'; end if;
  update public.profiles set display_name=trim(p_name),active=p_active,updated_at=now() where id=p_user and role='collaborator';
  if not found then raise exception 'collaborator not found'; end if;
end $$;
revoke all on function public.register_collaborator(uuid,text),public.update_collaborator(uuid,text,boolean) from public,anon;
grant execute on function public.register_collaborator(uuid,text),public.update_collaborator(uuid,text,boolean) to authenticated;
