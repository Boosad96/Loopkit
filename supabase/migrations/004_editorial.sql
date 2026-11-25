begin;
create table public.editorial_guides (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{2,70}$'),
  draft jsonb not null,
  approved jsonb,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.editorial_guides enable row level security;
revoke all on public.editorial_guides from public,anon,authenticated;
grant select on public.editorial_guides to authenticated,service_role;
create policy editorial_admin_read on public.editorial_guides for select to authenticated using((select public.is_loopkit_admin()));

create function public.edit_guide(guide_slug text, expected_revision integer, intent text, copy jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare
  item jsonb;
  current_version integer;
begin
  if not public.is_loopkit_admin() then raise exception 'Unauthorized'; end if;
  if guide_slug is null or guide_slug !~ '^[a-z][a-z0-9-]{2,70}$' or
     expected_revision is null or expected_revision < 0 or intent is null or
     intent not in ('save','approve','withdraw') or copy is null or
     jsonb_typeof(copy) <> 'object' or octet_length(copy::text) > 32000 or
     jsonb_typeof(copy->'title') is distinct from 'string' or length(trim(copy->>'title')) not between 3 and 140 or
     jsonb_typeof(copy->'summary') is distinct from 'string' or length(trim(copy->>'summary')) not between 10 and 400 or
     jsonb_typeof(copy->'sections') is distinct from 'array' or
     jsonb_array_length(copy->'sections') <> 3 then raise exception 'Invalid guide'; end if;
  for item in select value from jsonb_array_elements(copy->'sections') loop
    if jsonb_typeof(item) <> 'array' or jsonb_array_length(item) <> 2 or
       jsonb_typeof(item->0) is distinct from 'string' or length(trim(item->>0)) not between 3 and 120 or
       jsonb_typeof(item->1) is distinct from 'string' or length(trim(item->>1)) not between 15 and 1800 then
      raise exception 'Invalid section';
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(guide_slug,98391));
  select revision into current_version from public.editorial_guides where slug=guide_slug;
  if coalesce(current_version,0) <> expected_revision then raise exception 'Stale revision'; end if;
  insert into public.editorial_guides(slug,draft,approved,revision)
    values(guide_slug,copy,case when intent='approve' then copy else null end,1)
    on conflict(slug) do update set draft=excluded.draft,
      approved=case when intent='save' then editorial_guides.approved else excluded.approved end,
      revision=editorial_guides.revision+1, updated_at=now();
  insert into public.moderation_actions(actor_id,action,details)
    values(auth.uid(),'editorial.'||intent,jsonb_build_object('slug',guide_slug,'revision',expected_revision+1));
  return expected_revision+1;
end $$;
revoke all on function public.edit_guide(text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.edit_guide(text,integer,text,jsonb) to authenticated;
commit;
