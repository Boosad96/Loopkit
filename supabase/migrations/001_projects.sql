begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[0-9a-f]{24}$'), kind text not null check(kind in ('poll-maker','tournament-bracket-maker','leaderboard-maker','countdown-maker','community-event-page-maker','goal-tracker','community-challenge-maker','community-link-page-maker')),
  title text not null check(length(title) between 1 and 100), config jsonb not null check(jsonb_typeof(config)='object' and octet_length(config::text)<=100000),
  owner_id uuid references auth.users on delete cascade, management_hash text,
  revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((owner_id is null and management_hash ~ '^[0-9a-f]{64}$') or (owner_id is not null and management_hash is null))
);
create index projects_owner_created on public.projects(owner_id,created_at desc);
create table public.project_memberships(project_id uuid references public.projects on delete cascade,user_id uuid references auth.users on delete cascade,role text not null check(role='organizer'),primary key(project_id,user_id));
create table public.public_pages(project_id uuid primary key references public.projects on delete cascade,visible boolean not null default true,expires_at timestamptz,approved_at timestamptz,owner_allows_index boolean not null default false);
create table public.polls(project_id uuid primary key references public.projects on delete cascade,multiple boolean not null,hide_results boolean not null,ends_at timestamptz not null);
create table public.poll_options(project_id uuid references public.polls on delete cascade,id uuid not null,label text not null,position integer not null,primary key(project_id,id));
create table public.poll_votes(project_id uuid references public.polls on delete cascade,voter text not null,created_at timestamptz not null default now(),primary key(project_id,voter));
create table public.poll_choices(project_id uuid not null,voter text not null,option_id uuid not null,primary key(project_id,voter,option_id),foreign key(project_id,voter) references public.poll_votes on delete cascade,foreign key(project_id,option_id) references public.poll_options on delete cascade);
create index poll_choices_totals on public.poll_choices(project_id,option_id);
create table public.tournaments(project_id uuid primary key references public.projects on delete cascade);
create table public.tournament_participants(project_id uuid references public.tournaments on delete cascade,id uuid not null,name text not null,seed integer not null,primary key(project_id,id));
create table public.tournament_matches(project_id uuid references public.tournaments on delete cascade,match_key text not null,a_score integer not null,b_score integer not null,primary key(project_id,match_key));
create table public.leaderboards(project_id uuid primary key references public.projects on delete cascade,tie_handling text not null);
create table public.leaderboard_entries(project_id uuid references public.leaderboards on delete cascade,id uuid not null,name text not null,score numeric not null,primary key(project_id,id));
create table public.events(project_id uuid primary key references public.projects on delete cascade,event_at timestamptz not null,timezone text not null,organizer text not null);
create table public.event_rsvps(project_id uuid references public.events on delete cascade,visitor text not null,created_at timestamptz not null default now(),primary key(project_id,visitor));
create table public.goals(project_id uuid primary key references public.projects on delete cascade,target numeric not null check(target>0),progress numeric not null check(progress>=0));
create table public.challenges(project_id uuid primary key references public.projects on delete cascade,ends_at timestamptz not null,rules text not null);
create table public.challenge_participants(project_id uuid references public.challenges on delete cascade,visitor text not null,completed boolean not null default false,created_at timestamptz not null default now(),primary key(project_id,visitor));
create table public.project_limits(bucket text primary key, period bigint not null, hits integer not null);
alter table public.projects enable row level security;
-- All writes pass through the validating API. Private configuration is available to its owner only.
revoke all on public.projects from anon, authenticated;
grant select(id,slug,kind,title,owner_id,created_at,updated_at,revision,config) on public.projects to authenticated;
create policy project_owner_read on public.projects for select to authenticated using(owner_id=(select auth.uid()));
do $$ declare rel text; begin
  foreach rel in array array['public_pages','project_memberships','polls','poll_options','poll_votes','poll_choices','tournaments','tournament_participants','tournament_matches','leaderboards','leaderboard_entries','events','event_rsvps','goals','challenges','challenge_participants','project_limits'] loop
    execute format('alter table public.%I enable row level security',rel);
    execute format('revoke all on public.%I from anon, authenticated',rel);
  end loop;
end $$;

create function public.project_take_limit(p_bucket text,p_seconds int,p_max int) returns boolean language plpgsql set search_path='' as $$
declare t bigint:=floor(extract(epoch from clock_timestamp())/p_seconds); n int;
begin
 insert into public.project_limits as l values(p_bucket,t,1)
 on conflict(bucket) do update set period=t,hits=case when l.period=t then least(l.hits+1,p_max+1) else 1 end returning hits into n;
 return n<=p_max;
end $$;

-- A single transaction maintains the public configuration and its normalized activity relations.
create function public.project_sync(p uuid,k text,c jsonb) returns void language plpgsql set search_path='' as $$
begin
 case k
 when 'poll-maker' then
  if exists(select 1 from public.poll_votes where project_id=p) and
    (exists(select 1 from public.poll_options where project_id=p and not exists(select from jsonb_array_elements(c->'options') v where (v->>'id')::uuid=id and v->>'name'=label))
    or (select count(*) from public.poll_options where project_id=p)<>jsonb_array_length(c->'options')
    or exists(select from public.polls where project_id=p and multiple<>(c->>'multiple')::boolean))
  then raise exception 'Poll choices are locked after the first vote'; end if;
  insert into public.polls values(p,(c->>'multiple')::boolean,(c->>'hideResults')::boolean,(c->>'ends')::timestamptz)
  on conflict(project_id) do update set multiple=excluded.multiple,hide_results=excluded.hide_results,ends_at=excluded.ends_at;
  delete from public.poll_options where project_id=p and not exists(select from jsonb_array_elements(c->'options') v where (v->>'id')::uuid=id);
  insert into public.poll_options select p,(v->>'id')::uuid,v->>'name',i from jsonb_array_elements(c->'options') with ordinality as o(v,i)
  on conflict(project_id,id) do update set label=excluded.label,position=excluded.position;
 when 'tournament-bracket-maker' then
  insert into public.tournaments values(p) on conflict do nothing;
  delete from public.tournament_participants where project_id=p;
  insert into public.tournament_participants select p,(v->>'id')::uuid,v->>'name',i from jsonb_array_elements(c->'teams') with ordinality as o(v,i);
  delete from public.tournament_matches where project_id=p;
  insert into public.tournament_matches select p,key,(value->>0)::int,(value->>1)::int from jsonb_each(c->'scores');
 when 'leaderboard-maker' then
  insert into public.leaderboards values(p,c->>'tie') on conflict(project_id) do update set tie_handling=excluded.tie_handling;
  delete from public.leaderboard_entries where project_id=p;
  insert into public.leaderboard_entries select p,(v->>'id')::uuid,v->>'name',(v->>'score')::numeric from jsonb_array_elements(c->'entries') v;
 when 'community-event-page-maker' then
  insert into public.events values(p,(c->>'ends')::timestamptz,c->>'timezone',c->>'organizer') on conflict(project_id) do update set event_at=excluded.event_at,timezone=excluded.timezone,organizer=excluded.organizer;
 when 'goal-tracker' then
  insert into public.goals values(p,(c->>'target')::numeric,(c->>'progress')::numeric) on conflict(project_id) do update set target=excluded.target,progress=excluded.progress;
 when 'community-challenge-maker' then
  insert into public.challenges values(p,(c->>'ends')::timestamptz,c->>'rules') on conflict(project_id) do update set ends_at=excluded.ends_at,rules=excluded.rules;
 else null; end case;
end $$;

create function public.project_save(p_slug text,p_kind text,p_cfg jsonb,p_user uuid,p_hash text,p_rev int,p_days int,p_cap int)
returns int language plpgsql set search_path='' as $$
declare rec public.projects%rowtype; is_owner boolean;
begin
 if p_rev=0 then
  if p_user is not null then
   perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
   if (select count(*) from public.projects where owner_id=p_user)>=p_cap then raise exception 'Project limit reached'; end if;
  end if;
  insert into public.projects(slug,kind,title,config,owner_id,management_hash) values(p_slug,p_kind,p_cfg->>'title',p_cfg,p_user,case when p_user is null then p_hash end) returning * into rec;
  insert into public.public_pages(project_id,expires_at) values(rec.id,case when p_user is null then now()+make_interval(days=>p_days) end);
 else
  select * into rec from public.projects where slug=p_slug for update;
  is_owner:=coalesce(rec.owner_id=p_user,false) or coalesce(rec.management_hash=p_hash,false) or exists(select from public.project_memberships where project_id=rec.id and user_id=p_user);
  if rec.id is null or not is_owner then raise exception 'Permission denied'; end if;
  if rec.revision<>p_rev then raise exception 'Revision conflict'; end if;
  if rec.kind<>p_kind then raise exception 'Project type mismatch'; end if;
  update public.projects set config=p_cfg,title=p_cfg->>'title',revision=revision+1,updated_at=now() where id=rec.id returning * into rec;
 end if;
 perform public.project_sync(rec.id,rec.kind,p_cfg);
 return rec.revision;
end $$;

create function public.project_claim(p_slug text,p_user uuid,p_hash text,p_cap int) returns boolean language plpgsql set search_path='' as $$
declare p uuid; begin
 if p_user is null or p_hash is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if (select count(*) from public.projects where owner_id=p_user)>=p_cap then raise exception 'Project limit reached'; end if;
 update public.projects set owner_id=p_user,management_hash=null,revision=revision+1,updated_at=now() where slug=p_slug and owner_id is null and management_hash=p_hash returning id into p;
 if p is null then return false; end if;
 update public.public_pages set expires_at=null where project_id=p;
 return true;
end $$;

create function public.project_participate(p_slug text,p_actor text,p_action text,p_options uuid[]) returns boolean language plpgsql set search_path='' as $$
declare rec public.projects%rowtype; poll public.polls%rowtype;
begin
 select pr.* into rec from public.projects pr join public.public_pages pg on pg.project_id=pr.id where pr.slug=p_slug and pg.visible and (pg.expires_at is null or pg.expires_at>now()) for share of pr,pg;
 if rec.id is null then raise exception 'Unavailable'; end if;
 if rec.kind='poll-maker' and p_action='vote' then
  select * into poll from public.polls where project_id=rec.id;
  if poll.ends_at<=now() then raise exception 'Voting has closed'; end if;
  if cardinality(p_options) not between 1 and 10 or (not poll.multiple and cardinality(p_options)<>1)
   or (select count(*) from public.poll_options where project_id=rec.id and id=any(p_options))<>cardinality(p_options) then raise exception 'Invalid choices'; end if;
  insert into public.poll_votes(project_id,voter) values(rec.id,p_actor) on conflict do nothing;
  if not found then raise exception 'Already voted'; end if;
  insert into public.poll_choices select rec.id,p_actor,unnest(p_options);
 elsif rec.kind='community-event-page-maker' and p_action in ('join','leave') and rec.config->'order' ? 'RSVP' then
  if (rec.config->>'ends')::timestamptz<=now() then raise exception 'Event has started'; end if;
  if p_action='join' then insert into public.event_rsvps(project_id,visitor) values(rec.id,p_actor) on conflict do nothing;
  else delete from public.event_rsvps where project_id=rec.id and visitor=p_actor; end if;
 elsif rec.kind='community-challenge-maker' and p_action in ('join','leave','finish') then
  if (rec.config->>'ends')::timestamptz<=now() then raise exception 'Challenge has ended'; end if;
  if p_action='join' then insert into public.challenge_participants(project_id,visitor) values(rec.id,p_actor) on conflict do nothing;
  elsif p_action='finish' then update public.challenge_participants set completed=true where project_id=rec.id and visitor=p_actor;
   if not found then raise exception 'Join first'; end if;
  else delete from public.challenge_participants where project_id=rec.id and visitor=p_actor; end if;
 else raise exception 'Unsupported action'; end if;
 return true;
end $$;
create function public.project_view(p_slug text,p_actor text) returns jsonb language plpgsql stable set search_path='' as $$
declare rec public.projects%rowtype; v boolean:=false; n bigint:=0; totals jsonb:='{}'; joined bigint:=0; finished bigint:=0; participating boolean:=false; completed boolean:=false;
begin
 select pr.* into rec from public.projects pr join public.public_pages pg on pg.project_id=pr.id where pr.slug=p_slug and pg.visible and (pg.expires_at is null or pg.expires_at>now());
 if rec.id is null then return null; end if;
 if rec.kind='poll-maker' then
  select exists(select 1 from public.poll_votes where project_id=rec.id and voter=p_actor) into v;
  if v or not (rec.config->>'hideResults')::boolean then
   select count(*) into n from public.poll_votes where project_id=rec.id;
   select coalesce(jsonb_object_agg(option_id,num),'{}'::jsonb) into totals from(select option_id,count(*) num from public.poll_choices where project_id=rec.id group by option_id) counts;
  end if;
 elsif rec.kind='community-event-page-maker' then
  select count(*),coalesce(bool_or(visitor=p_actor),false) into joined,participating from public.event_rsvps where project_id=rec.id;
 elsif rec.kind='community-challenge-maker' then
  select count(*),count(*) filter(where cp.completed),coalesce(bool_or(visitor=p_actor),false),coalesce(bool_or(visitor=p_actor and cp.completed),false) into joined,finished,participating,completed from public.challenge_participants cp where project_id=rec.id;
 end if;
 return jsonb_build_object('slug',rec.slug,'kind',rec.kind,'config',rec.config,'revision',rec.revision,'updatedAt',rec.updated_at,'votes',n,'counts',totals,'joined',joined,'finished',finished,'voted',v,'participating',participating,'completed',completed);
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname in ('project_take_limit','project_sync','project_save','project_claim','project_participate','project_view') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 execute format('grant execute on function %s to service_role',f.sig);
 end loop;
end $$;
commit;
