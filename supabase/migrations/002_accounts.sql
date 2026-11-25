begin;
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (length(display_name) between 1 and 80),
  role text not null default 'member' check (role in ('member','moderator','admin')),
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);
create function public.initialize_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end $$;
revoke all on function public.initialize_profile() from public,anon,authenticated;
create trigger loopkit_new_user after insert on auth.users for each row execute function public.initialize_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create function public.is_loopkit_admin() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and suspended_at is null) $$;
create function public.is_loopkit_moderator() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('moderator','admin') and suspended_at is null) $$;
create function public.is_loopkit_member() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and suspended_at is null) $$;
revoke all on function public.is_loopkit_admin(),public.is_loopkit_moderator(),public.is_loopkit_member() from public,anon;
grant execute on function public.is_loopkit_admin(),public.is_loopkit_moderator(),public.is_loopkit_member() to authenticated,service_role;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy profile_view on public.profiles for select to authenticated using (id=(select auth.uid()) or (select public.is_loopkit_admin()));
create policy profile_edit on public.profiles for update to authenticated using (id=(select auth.uid()) and suspended_at is null) with check(id=(select auth.uid()));

create table public.community_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  slug text unique not null default gen_random_uuid()::text,
  name text not null check(length(name) between 3 and 80),
  description text not null check(length(description) between 30 and 1800),
  platform text not null check(platform in ('discord','telegram-channel','telegram-bot')),
  category text not null check (category in ('Gaming','Esports','Development','Education','Creative','Social','Business','Other')),
  official_link text not null check(length(official_link)<=250),
  logo_path text,
  tags text[] not null default '{}' check(cardinality(tags)<=6),
  language text not null check(length(language) between 2 and 40),
  status text not null default 'pending' check(status in ('pending','approved','rejected','removed')),
  vote_count integer not null default 0 check(vote_count>=0),
  indexing_consent boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((platform='discord' and official_link ~* '^https://(discord[.]gg/|discord[.]com/invite/)[a-z0-9-]{2,80}/?$') or
    (platform='telegram-channel' and official_link ~* '^https://t[.]me/[a-z][a-z0-9_]{3,31}/?$') or
    (platform='telegram-bot' and official_link ~* '^https://t[.]me/[a-z][a-z0-9_]{0,28}bot/?$'))
);
create index listings_public_rank on public.community_listings(platform, vote_count desc,created_at desc) where status='approved';
create index listings_owner on public.community_listings(owner_id,created_at desc);
create index listings_review on public.community_listings(status,created_at);
alter table public.community_listings enable row level security;
revoke all on public.community_listings from anon,authenticated;
grant select on public.community_listings to authenticated;
create policy private_listing_read on public.community_listings for select to authenticated using(owner_id=(select auth.uid()) or (select public.is_loopkit_moderator()));
-- Definer-owned projection intentionally exposes only approved, current records and public fields.
create view public.directory_entries with (security_barrier=true) as
select l.id,l.slug,l.name,l.description,l.platform,l.category,l.official_link,l.logo_path,l.tags,l.language,l.vote_count,l.created_at,l.updated_at
from public.community_listings l join public.profiles p on p.id=l.owner_id
where l.status='approved' and (l.expires_at is null or l.expires_at>now()) and p.suspended_at is null;
revoke all on public.directory_entries from public,anon,authenticated;
grant select on public.directory_entries to anon,authenticated;

create table public.listing_votes (
  listing_id uuid not null references public.community_listings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(), primary key(listing_id,user_id)
);
create index votes_by_user on public.listing_votes(user_id,created_at desc);
create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.community_listings on delete cascade,
  reporter_id uuid references auth.users on delete set null,
  reason text not null check(length(reason) between 12 and 1000),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now()
);
create index listing_reports_queue on public.listing_reports(status,created_at);
create unique index one_open_report_per_user on public.listing_reports(listing_id,reporter_id) where status='open';
create table public.moderation_actions (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users on delete set null,
  action text not null, target_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index moderation_log_time on public.moderation_actions(created_at desc);
alter table public.listing_votes enable row level security;
alter table public.listing_reports enable row level security;
alter table public.moderation_actions enable row level security;
revoke all on public.listing_votes,public.listing_reports,public.moderation_actions from public,anon,authenticated;
grant select on public.listing_votes,public.listing_reports,public.moderation_actions to authenticated;
create policy own_votes on public.listing_votes for select to authenticated using(user_id=(select auth.uid()));
create policy view_reports on public.listing_reports for select to authenticated using(reporter_id=(select auth.uid()) or (select public.is_loopkit_moderator()));
create policy view_audit on public.moderation_actions for select to authenticated using((select public.is_loopkit_moderator()));

-- Server-only submission. Subject comes from a verified Supabase Auth session.
create function public.save_directory_listing(subject uuid, listing uuid, fields jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; clean_tags text[];
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(subject::text,1));
 if not exists(select 1 from public.profiles where id=subject and suspended_at is null) then raise exception 'Inactive account'; end if;
 select coalesce(array_agg(value),'{}'::text[]) into clean_tags from jsonb_array_elements_text(fields->'tags') t(value);
 if exists(select 1 from unnest(clean_tags) t where length(t) not between 1 and 24) then raise exception 'Invalid tags'; end if;
 if listing is null then
   if (select count(*) from public.community_listings where owner_id=subject and created_at>now()-interval '24 hours')>=4 then raise exception 'Daily submission limit reached'; end if;
   insert into public.community_listings(owner_id,name,description,platform,category,language,official_link,tags,logo_path)
   values(subject,fields->>'name',fields->>'description',fields->>'platform',fields->>'category',fields->>'language',fields->>'link',clean_tags,fields->>'logo') returning id into result;
 else
   update public.community_listings set name=fields->>'name',description=fields->>'description',platform=fields->>'platform',
    category=fields->>'category',language=fields->>'language',official_link=fields->>'link',tags=clean_tags,
    logo_path=fields->>'logo',status='pending',updated_at=now()
   where id=listing and owner_id=subject and status<>'removed' returning id into result;
   if result is null then raise exception 'Listing unavailable'; end if;
 end if;
 return result;
end $$;

create function public.vote_listing(subject uuid,listing uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(subject::text,2));
 if not exists(select 1 from public.profiles where id=subject and suspended_at is null) or
  not exists(select 1 from public.directory_entries where id=listing) or exists(select 1 from public.community_listings where id=listing and owner_id=subject) then raise exception 'Vote unavailable'; end if;
 if (select count(*) from public.listing_votes where user_id=subject and created_at>now()-interval '1 hour')>=20 then raise exception 'Vote limit reached'; end if;
 insert into public.listing_votes(listing_id,user_id) values(listing,subject);
end $$;
create function public.adjust_vote_count() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then update public.community_listings set vote_count=vote_count+1 where id=new.listing_id; return new; end if;
 update public.community_listings set vote_count=greatest(0,vote_count-1) where id=old.listing_id; return old;
end $$;
revoke all on function public.adjust_vote_count() from public,anon,authenticated;
create trigger count_listing_votes after insert or delete on public.listing_votes for each row execute function public.adjust_vote_count();

create function public.moderate_listing(listing uuid, decision text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_loopkit_moderator() or decision not in ('approved','rejected','removed') then raise exception 'Unauthorized'; end if;
 update public.community_listings set status=decision,updated_at=now() where id=listing and owner_id<>auth.uid();
 if not found then raise exception 'Listing unavailable'; end if;
 update public.listing_reports set status='resolved' where listing_id=listing and status='open';
 insert into public.moderation_actions(actor_id,action,target_id) values(auth.uid(),'listing.'||decision,listing);
end $$;
create function public.change_suspension(subject uuid, suspend boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_loopkit_admin() then raise exception 'Unauthorized'; end if;
 update public.profiles set suspended_at=case when suspend then now() else null end where id=subject and role='member';
 if not found then raise exception 'Account unavailable'; end if;
 insert into public.moderation_actions(actor_id,action,target_id) values(auth.uid(),case when suspend then 'account.suspend' else 'account.restore' end,subject);
end $$;
revoke all on function public.save_directory_listing(uuid,uuid,jsonb),public.vote_listing(uuid,uuid),public.moderate_listing(uuid,text),public.change_suspension(uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_directory_listing(uuid,uuid,jsonb),public.vote_listing(uuid,uuid) to service_role;
grant execute on function public.moderate_listing(uuid,text),public.change_suspension(uuid,boolean) to authenticated;
commit;

begin;
create function public.report_directory_entry(subject uuid, listing uuid, explanation text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(listing::text,5));
 if not exists(select 1 from public.directory_entries where id=listing)
 or (select count(*) from public.listing_reports where listing_id=listing and created_at>now()-interval '1 hour')>=10
 then raise exception 'Report unavailable'; end if;
 insert into public.listing_reports(listing_id,reporter_id,reason) values(listing,subject,explanation);
end $$;
revoke all on function public.report_directory_entry(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.report_directory_entry(uuid,uuid,text) to service_role;
commit;
