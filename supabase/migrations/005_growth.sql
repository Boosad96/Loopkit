begin;
create function public.growth_report() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare report jsonb;
begin
 if not public.is_loopkit_admin() then raise exception 'Unauthorized'; end if;
 with browser_cohort as (
  select visitor_id,bool_or(event='page_view') visited,bool_or(event='tool_start') started,bool_or(event='tool_complete') completed,
   bool_or(event='project_create') created,bool_or(event='share') shared,
   min(created_at) filter(where event='shared_visit') first_referred,
   max(created_at) filter(where event='project_create') last_created
  from public.analytics_events where created_at >= now()-interval '30 days' group by visitor_id
 ), totals as (
  select count(*) filter(where visited) visitors,count(*) filter(where started) starters,
   count(*) filter(where started and completed) activated,count(*) filter(where created) creators,
   count(*) filter(where created and shared) sharers,count(*) filter(where visited and created) converted,
   count(*) filter(where first_referred is not null) referred,
   count(*) filter(where first_referred is not null and last_created>=first_referred) referred_creators from browser_cohort
 ), finance as (
  select o.currency,sum(o.amount) as amount from public.subscriptions s join public.orders o on o.id=s.order_id
  where s.paid_until>now() and not s.cancel_scheduled and s.status not in ('cancelled','completed','expired') group by o.currency
 ), accounts as (
  select count(*) registered,count(*) filter(where exists(select 1 from public.orders o join public.payments p on p.order_id=o.id
   where o.user_id=a.id and p.status in ('captured','partial_refund') and p.amount>p.refunded_amount)) payers
  from public.profiles a where a.created_at>=now()-interval '30 days'
 )
 select jsonb_build_object('visitors',visitors,'activation',round(100.0*activated/nullif(starters,0),1),
 'share_rate',round(100.0*sharers/nullif(creators,0),1),
 'shared_visits_per_share',round((select count(*) from public.analytics_events where event='shared_visit' and created_at>=now()-interval '30 days')::numeric/nullif((select count(*) from public.analytics_events where event='share' and created_at>=now()-interval '30 days'),0),2),
 'visitor_creator',round(100.0*converted/nullif(visitors,0),1),'viral_coefficient',round(referred_creators::numeric/nullif(creators,0),2),
 'returning_creators',(select count(*) from (select owner_id from public.projects where owner_id is not null and created_at>=now()-interval '30 days' group by owner_id having count(distinct (created_at at time zone 'UTC')::date)>1) r),
 'registered',registered,'paid_conversion',round(100.0*payers/nullif(registered,0),1),
 'mrr',coalesce((select jsonb_object_agg(currency,amount) from finance),'{}'::jsonb),
 'submissions',(select count(*) from public.community_listings where created_at>=now()-interval '30 days'),
 'projects',(select count(*) from public.projects where created_at>=now()-interval '30 days'),
 'purchases',(select count(*) from public.payments where status in ('captured','partial_refund') and created_at>=now()-interval '30 days'))
 into report from totals cross join accounts;
 return report;
end $$;
revoke all on function public.growth_report() from public,anon,authenticated;
grant execute on function public.growth_report() to authenticated;
commit;
