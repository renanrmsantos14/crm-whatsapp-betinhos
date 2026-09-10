-- Perfil inicial da instalação Betinhos: operação diária visível, extras por código.
-- Escolhas explícitas de uma membership não são reinterpretadas.
alter table public.user_organizations
  alter column interface_settings set default '{"preset":"simplificada"}'::jsonb;

create or replace function public.fn_accept_team_invite(
  p_user uuid, p_org uuid, p_role text, p_invited_by uuid,
  p_issued_at timestamptz, p_invited_at timestamptz
) returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select public.fn_accept_team_invite(
    p_user, p_org, p_role, p_invited_by, p_issued_at, p_invited_at,
    '{"preset":"simplificada"}'::jsonb
  );
$$;
revoke all on function public.fn_accept_team_invite(uuid,uuid,text,uuid,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.fn_accept_team_invite(uuid,uuid,text,uuid,timestamptz,timestamptz)
  to service_role;

create or replace function public.fn_create_tenant_with_owner(
  p_actor uuid, p_key uuid, p_request jsonb, p_hash text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  prior public.idempotency_keys%rowtype;
  org public.organizations%rowtype;
  result jsonb;
begin
  if not exists (select 1 from public.platform_admins where user_id = p_actor
    and revoked_at is null and scope = 'full') then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || p_key::text, 0));
  select * into prior from public.idempotency_keys
    where key = p_key::text and endpoint = '/api/v1/admin/tenants:' || p_actor::text
      and expires_at > now() and tenant_creation_trusted;
  if found then
    if prior.request_hash <> decode(p_hash, 'hex') then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    if prior.response_body->>'id' is distinct from prior.organization_id::text
      or not exists (select 1 from public.organizations where id = prior.organization_id and created_by = p_actor) then
      raise exception 'idempotency_provenance_invalid' using errcode = '22023';
    end if;
    return prior.response_body || jsonb_build_object('created', false);
  end if;
  insert into public.organizations(display_name, slug, legal_name, cnpj, status, settings, created_by)
    values (p_request->>'display_name', p_request->>'slug', coalesce(nullif(p_request->>'legal_name', ''), p_request->>'display_name'),
      p_request->>'cnpj', 'active', jsonb_build_object('plan', p_request->>'plan'), p_actor)
    returning * into org;
  insert into public.user_organizations(organization_id, user_id, role, accepted_at, interface_settings)
    values (org.id, p_actor, 'admin', now(), case when lower(p_request->>'owner_email') =
      (select lower(email) from auth.users where id = p_actor)
      then coalesce(p_request->'owner_interface_settings', '{"preset":"simplificada"}'::jsonb)
      else '{"preset":"simplificada"}'::jsonb end);
  result := jsonb_build_object('id', org.id, 'slug', org.slug, 'display_name', org.display_name,
    'invite_id', gen_random_uuid(), 'issued_at', floor(extract(epoch from now()))::bigint);
  insert into public.idempotency_keys(organization_id, key, endpoint, request_hash, status_code, response_body, tenant_creation_trusted)
    values (org.id, p_key::text, '/api/v1/admin/tenants:' || p_actor::text,
      decode(p_hash, 'hex'), 201, result, true);
  return result || jsonb_build_object('created', true);
end $$;
revoke all on function public.fn_create_tenant_with_owner(uuid,uuid,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.fn_create_tenant_with_owner(uuid,uuid,jsonb,text)
  to service_role;

notify pgrst, 'reload schema';
