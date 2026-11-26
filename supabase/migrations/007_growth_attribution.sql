begin;
alter table public.analytics_events
 add column growth_session uuid,
 add column growth_landing text check(length(growth_landing)<=100 and growth_landing ~ '^/[a-z0-9/:-]*$'),
 add column growth_channel text check(growth_channel in ('direct','organic','referral','campaign')),
 add column growth_campaign text check(growth_campaign in ('loopkit_growth','loopkit_widget')),
 add column growth_source text check(growth_source in ('hn','stack','github','bluesky','rss','widget')),
 add column growth_tool text check(length(growth_tool)<=60 and growth_tool ~ '^[a-z0-9-]+$');

create function public.record_attributed_usage(
 visitor uuid, kind text, project_slug text, session_key uuid, landing_page text,
 traffic_channel text, campaign_name text, campaign_source text, tool_slug text
) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if kind not in ('page_view','tool_view','tool_start','tool_complete','share','shared_visit','remix') or
    session_key is null or landing_page is null or traffic_channel is null then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(visitor::text,3));
 if (select count(*) from public.analytics_events where visitor_id=visitor and created_at>now()-interval '10 minutes')>=80 then return; end if;
 if project_slug is not null then
  select p.id into pid from public.projects p join public.public_pages pp on pp.project_id=p.id
  where p.slug=project_slug and pp.visible and (pp.expires_at is null or pp.expires_at>now());
  if pid is null then return; end if;
 end if;
 insert into public.analytics_events(visitor_id,event,project_id,growth_session,growth_landing,growth_channel,growth_campaign,growth_source,growth_tool)
 values(visitor,kind,pid,session_key,landing_page,traffic_channel,campaign_name,campaign_source,tool_slug);
end $$;

create function public.growth_attribution_summary() returns jsonb language sql stable security definer set search_path='' as $$
 with events as materialized (
  select visitor_id, event, growth_session, growth_landing, growth_channel, growth_campaign, growth_source, growth_tool, created_at, id
  from public.analytics_events where growth_session is not null and created_at >= now()-interval '48 hours'
 ), visits as (
  select distinct on (visitor_id,growth_session) visitor_id,growth_session,growth_landing,growth_channel,growth_campaign,growth_source
  from events where event='page_view' order by visitor_id,growth_session,created_at,id
 ), by_landing as (
  select growth_landing name,count(*) visits from visits group by 1 order by 2 desc,1 limit 25
 ), by_campaign as (
  select growth_campaign||':'||growth_source name,count(*) filter(where event='tool_complete') completions
  from events where growth_channel='campaign' group by 1
 ), by_source as (
  select v.growth_campaign||':'||v.growth_source name, count(*) visits,coalesce(max(c.completions),0) completions
  from visits v left join by_campaign c on c.name=v.growth_campaign||':'||v.growth_source
  where v.growth_channel='campaign' group by 1 order by 2 desc,1
 ), by_tool as (
  select growth_tool name,count(*) filter(where event='tool_start') starts,
   count(*) filter(where event='tool_complete') completions
  from events where growth_tool is not null group by 1 order by 3 desc,2 desc,1 limit 20
 ), repeat_browsers as (
  select visitor_id from events where event='page_view' group by visitor_id
  having count(distinct (created_at at time zone 'UTC')::date)>1
 )
 select jsonb_build_object(
  'window_hours',48,'visits',count(*),
  'referral_visits',count(*) filter(where growth_channel in ('referral','campaign')),
  'organic_visits',count(*) filter(where growth_channel='organic'),
  'campaign_visits',count(*) filter(where growth_channel='campaign'),
  'returning_browsers',(select count(*) from repeat_browsers),
  'tool_starts',(select count(*) from events where event='tool_start'),
  'tool_completions',(select count(*) from events where event='tool_complete'),
  'campaign_completions',(select count(*) from events where event='tool_complete' and growth_channel='campaign'),
  'landing_pages',coalesce((select jsonb_agg(to_jsonb(l) order by visits desc,name) from by_landing l),'[]'::jsonb),
  'campaign_sources',coalesce((select jsonb_agg(to_jsonb(s) order by visits desc,name) from by_source s),'[]'::jsonb),
  'tools',coalesce((select jsonb_agg(to_jsonb(t) order by completions desc,starts desc,name) from by_tool t),'[]'::jsonb)
 ) from visits;
$$;
revoke all on function public.record_attributed_usage(uuid,text,text,uuid,text,text,text,text,text), public.growth_attribution_summary()
 from public, anon, authenticated;
grant execute on function public.record_attributed_usage(uuid,text,text,uuid,text,text,text,text,text), public.growth_attribution_summary()
 to service_role;
commit;
