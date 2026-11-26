begin;
create function public.activity_trend() returns table(day date,visits bigint,shares bigint)
language plpgsql stable security definer set search_path='' as $$
declare subject uuid:=auth.uid(); staff boolean:=public.is_loopkit_admin();
begin
 if not public.is_loopkit_member() or not(staff or public.billing_has_pro(subject)) then
   raise exception 'Access restricted';
 end if;
 return query
 select (a.created_at at time zone 'UTC')::date,
        count(*) filter(where a.event='shared_visit'),count(*) filter(where a.event='share')
 from public.analytics_events a join public.projects p on p.id=a.project_id
 where a.created_at >= ((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC'
   and a.event in ('shared_visit','share') and (staff or p.owner_id=subject)
 group by 1 order by 1;
end $$;
revoke all on function public.activity_trend() from public,anon,authenticated;
grant execute on function public.activity_trend() to authenticated;
commit;
