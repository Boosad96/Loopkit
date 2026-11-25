begin;
-- Test-mode financial records. All financial mutations run under server credentials.
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;
create table public.billing_prices (
  product text primary key check (product in ('pro','featured','category','homepage')),
  amount integer not null check (amount between 1 and 10000000),
  currency text not null default 'USD' check (currency in ('USD','INR')),
  updated_at timestamptz not null default now()
);
insert into public.billing_prices(product,amount) values ('pro',599),('featured',499),('category',1499),('homepage',2999);
create table public.promotional_slots (
  id text primary key, product text not null references public.billing_prices(product), category text,
  unique(product, category), check (product <> 'pro')
);
insert into public.promotional_slots values ('homepage','homepage',null),('featured','featured',null);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete set null,
  request_id uuid not null, product text not null references public.billing_prices,
  amount integer not null check(amount>0), currency text not null, provider text not null default 'razorpay_test',
  provider_id text unique, status text not null default 'creating' check(status in ('creating','pending','paid','failed','expired','review','refunded')),
  created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index orders_by_user on public.orders(user_id,created_at desc);
create table public.subscriptions (
  order_id uuid primary key references public.orders, user_id uuid references auth.users on delete set null,
  status text not null default 'created', paid_until timestamptz, cancel_scheduled boolean not null default false,
  last_event_at timestamptz, updated_at timestamptz not null default now()
);
create unique index subscriptions_one_open on public.subscriptions(user_id) where status not in ('cancelled','completed','expired');
create table public.sponsorships (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders,
  listing_id uuid references public.community_listings on delete set null, slot_id text not null references public.promotional_slots,
  starts_at timestamptz not null, ends_at timestamptz not null, hold_until timestamptz not null default now()+interval '15 minutes',
  status text not null default 'held' check(status in ('held','confirmed','expired','cancelled')),
  check (ends_at>starts_at),
  exclude using gist (slot_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (status in ('held','confirmed'))
);
create table public.payments (
  id text primary key, order_id uuid not null references public.orders, amount integer not null, currency text not null,
  status text not null check(status in ('captured','failed','refunded','partial_refund')), refunded_amount integer not null default 0,
  service_until timestamptz, created_at timestamptz not null default now()
);
create index payments_by_order on public.payments(order_id);
create table public.billing_refunds (
  id text primary key, payment_id text not null references public.payments, amount integer not null check(amount>0),
  status text not null check(status in ('created','failed','processed')), updated_at timestamptz not null default now()
);
create table public.webhook_events (
  provider text not null, event_id text not null, digest text not null, kind text not null, received_at timestamptz not null default now(),
  primary key(provider,event_id), unique(provider,digest)
);
create table public.sponsorship_metrics (
  sponsorship_id uuid not null references public.sponsorships, day date not null default current_date,
  views integer not null default 0, clicks integer not null default 0, primary key(sponsorship_id,day)
);
create table public.sponsorship_metric_receipts (
  sponsorship_id uuid not null references public.sponsorships, day date not null default current_date,
  kind text not null check(kind in ('view','click')), visitor_hash text not null, primary key(sponsorship_id,day,kind,visitor_hash)
);
do $$ declare tbl text; begin
  foreach tbl in array array['billing_prices','promotional_slots','orders','subscriptions','sponsorships','payments','billing_refunds','webhook_events','sponsorship_metrics','sponsorship_metric_receipts'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
  end loop;
end $$;
grant select on public.directory_entries,public.community_listings,public.profiles to service_role;
grant insert on public.moderation_actions to service_role;
grant usage on sequence public.moderation_actions_id_seq to service_role;
grant select on public.orders,public.subscriptions,public.payments,public.billing_refunds to authenticated;
create policy own_orders on public.orders for select to authenticated using(user_id=auth.uid());
create policy own_subscriptions on public.subscriptions for select to authenticated using(user_id=auth.uid());
create policy own_payments on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy own_refunds on public.billing_refunds for select to authenticated using(exists(select 1 from public.payments p where p.id=payment_id));

create function public.billing_reserve(p_user uuid,p_request uuid,p_product text,p_listing uuid,p_start date,p_amount integer default null,p_currency text default null)
returns jsonb language plpgsql set search_path=public as $$
declare o orders; price billing_prices; listing community_listings; slot text; start_time timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select * into o from orders where user_id=p_user and request_id=p_request;
  if found then return jsonb_build_object('order',to_jsonb(o),'new',false); end if;
  -- A live subscription/order already prevents duplicate charges if a browser retries with another key.
  if (select count(*) from orders where user_id=p_user and created_at>now()-interval '1 hour') >= 12 then raise exception 'rate_limit'; end if;
  select * into strict price from billing_prices where product=p_product;
  if p_amount is not null and (p_amount<>price.amount or p_currency is distinct from price.currency) then raise exception 'price_changed'; end if;
  update sponsorships set status='expired' where status='held' and hold_until<=now();
  update subscriptions s set status='expired' from orders a where s.order_id=a.id and s.status='created' and a.provider_id is null and a.created_at < now()-interval '20 minutes';
  if p_product<>'pro' then
    select * into listing from community_listings where id=p_listing and owner_id=p_user and status='approved';
    if not found or not exists(select 1 from directory_entries d where d.id=p_listing) then raise exception 'listing_unavailable'; end if;
    if p_start is null or p_start < (now() at time zone 'UTC')::date+1 or p_start>(now() at time zone 'UTC')::date+90 then raise exception 'invalid_date'; end if;
    slot:=p_product;
    if p_product='category' then
      slot:='category:'||listing.category;
      insert into promotional_slots(id,product,category) values(slot,'category',listing.category) on conflict do nothing;
    end if;
    start_time:=p_start::timestamp at time zone 'UTC';
  end if;
  insert into orders(user_id,request_id,product,amount,currency) values(p_user,p_request,p_product,price.amount,price.currency) returning * into o;
  if p_product='pro' then
    if exists(select 1 from subscriptions where user_id=p_user and paid_until>now()) then raise exception 'existing_subscription'; end if;
    insert into subscriptions(order_id,user_id) values(o.id,p_user);
  else
    insert into sponsorships(order_id,listing_id,slot_id,starts_at,ends_at) values(o.id,p_listing,slot,start_time,start_time+interval '168 hours');
  end if;
  return jsonb_build_object('order',to_jsonb(o),'new',true);
end $$;
create function public.billing_has_pro(p_user uuid) returns boolean language sql stable set search_path=public as $$
  select exists(select 1 from subscriptions where user_id=p_user and paid_until>now());
$$;
create function public.billing_apply_event(p_event text,p_digest text,p_kind text,p_data jsonb)
returns text language plpgsql set search_path=public as $$
declare o orders; pay payments; s sponsorships; evt timestamptz; period_end timestamptz; total integer; added integer;
begin
  insert into webhook_events(provider,event_id,digest,kind) values('razorpay_test',p_event,p_digest,p_kind) on conflict do nothing;
  get diagnostics added=row_count;
  if added=0 then return 'duplicate'; end if;
  evt:=to_timestamp((p_data->>'at')::bigint);
  if p_kind like 'refund.%' then
    select * into strict pay from payments where id=p_data->>'payment' for update;
    insert into billing_refunds(id,payment_id,amount,status) values(p_data->>'refund',pay.id,(p_data->>'amount')::integer,split_part(p_kind,'.',2))
      on conflict(id) do update set status=excluded.status,updated_at=now() where billing_refunds.status<>'processed' and excluded.status<>'created';
    select coalesce(sum(amount),0) into total from billing_refunds where payment_id=pay.id and status='processed';
    if total>pay.amount then raise exception 'refund_amount_mismatch'; end if;
    update payments set refunded_amount=total,status=case when total=pay.amount then 'refunded' when total>0 then 'partial_refund' else status end where id=pay.id;
    if total=pay.amount then
      update sponsorships set status='cancelled' where order_id=pay.order_id;
      update subscriptions set paid_until=(select max(service_until) from payments where order_id=pay.order_id and status in ('captured','partial_refund')) where order_id=pay.order_id;
      update orders set status='refunded' where id=pay.order_id and not exists (select 1 from payments where order_id=pay.order_id and status in ('captured','partial_refund'));
    end if;
    return 'applied';
  end if;
  select * into o from orders where provider_id=p_data->>'providerId' for update;
  -- Signed events can include unrelated orders for the merchant. A known local order whose provider
  -- assignment is still pending must roll back so Razorpay can retry delivery.
  if not found then
    if exists(select 1 from orders where id::text=p_data->>'localId') then raise exception 'provider_assignment_pending'; end if;
    return 'unrelated';
  end if;
  if p_kind like 'subscription.%' and o.product <> 'pro' then raise exception 'product_mismatch'; end if;
  if p_kind='payment.failed' then
    insert into payments(id,order_id,amount,currency,status) values(p_data->>'payment',o.id,(p_data->>'amount')::integer,p_data->>'currency','failed') on conflict do nothing;
    return 'applied';
  end if;
  if p_kind in ('payment.captured','subscription.charged') then
    if o.product='pro' and p_kind='payment.captured' then return 'unrelated'; end if;
    if (p_data->>'amount')::integer<>o.amount or p_data->>'currency'<>o.currency then raise exception 'amount_mismatch'; end if;
    if p_kind='subscription.charged' then
      period_end:=to_timestamp((p_data->>'until')::bigint);
      if period_end is null then raise exception 'period_missing'; end if;
    end if;
    insert into payments(id,order_id,amount,currency,status,service_until) values(p_data->>'payment',o.id,o.amount,o.currency,'captured',period_end)
      on conflict(id) do update set status='captured', service_until=excluded.service_until where payments.status='failed' and payments.order_id=excluded.order_id;
    get diagnostics added=row_count;
    if added=0 then return 'duplicate_payment'; end if;
    if o.product='pro' then
      update subscriptions set paid_until=greatest(paid_until,period_end), status=case when status in ('cancelled','completed') then status when last_event_at is null or last_event_at<=evt then 'active' else status end,
        last_event_at=greatest(last_event_at,evt),updated_at=now() where order_id=o.id;
    else
      select * into strict s from sponsorships where order_id=o.id for update;
      if s.status<>'held' or s.hold_until<=now() or not exists(select 1 from directory_entries where id=s.listing_id) then
        update orders set status='review' where id=o.id;
        return 'manual_review';
      end if;
      update sponsorships set status='confirmed' where id=s.id;
    end if;
    update orders set status='paid' where id=o.id;
  elsif p_kind like 'subscription.%' then
    update subscriptions set status=split_part(p_kind,'.',2),last_event_at=evt,updated_at=now()
      where order_id=o.id and (last_event_at is null or last_event_at<=evt) and status not in ('cancelled','completed');
  end if;
  return 'applied';
end $$;
create function public.billing_record_metric(p_id uuid,p_kind text,p_hash text) returns void language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from sponsorships s join directory_entries l on l.id=s.listing_id where s.id=p_id and s.status='confirmed' and now()>=s.starts_at and now()<s.ends_at)
    then return; end if;
  insert into sponsorship_metric_receipts(sponsorship_id,kind,visitor_hash) values(p_id,p_kind,p_hash) on conflict do nothing;
  if not found then return; end if;
  insert into sponsorship_metrics(sponsorship_id,day,views,clicks) values(p_id,current_date,(p_kind='view')::int,(p_kind='click')::int)
    on conflict(sponsorship_id,day) do update set views=sponsorship_metrics.views+excluded.views,clicks=sponsorship_metrics.clicks+excluded.clicks;
  delete from sponsorship_metric_receipts where day < current_date - 2;
end $$;
revoke all on function public.billing_reserve(uuid,uuid,text,uuid,date,integer,text),public.billing_apply_event(text,text,text,jsonb),public.billing_has_pro(uuid),public.billing_record_metric(uuid,text,text) from public,anon,authenticated;
grant execute on function public.billing_reserve(uuid,uuid,text,uuid,date,integer,text),public.billing_apply_event(text,text,text,jsonb),public.billing_has_pro(uuid),public.billing_record_metric(uuid,text,text) to service_role;
create function public.billing_set_price(p_actor uuid,p_product text,p_amount integer,p_currency text) returns void language plpgsql set search_path=public as $$
begin
  if not exists (select 1 from profiles where id=p_actor and role='admin' and suspended_at is null) then raise exception 'admin_required'; end if;
  update billing_prices set amount=p_amount,currency=p_currency,updated_at=now() where product=p_product;
  if not found then raise exception 'product_missing'; end if;
  insert into moderation_actions(actor_id,action,target_id,details) values(p_actor,'billing_price_updated',p_actor,jsonb_build_object('product',p_product,'minor_units',p_amount,'currency',p_currency));
end $$;
revoke all on function public.billing_set_price(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.billing_set_price(uuid,text,integer,text) to service_role;

-- Administrators can withdraw a campaign from rotation while preserving the payment ledger.
create function public.billing_withdraw_placement(p_actor uuid,p_sponsor uuid) returns void language plpgsql set search_path=public as $$
begin
  if not exists (select 1 from profiles where id=p_actor and role='admin' and suspended_at is null) then raise exception 'admin_required'; end if;
  update sponsorships set status='cancelled' where id=p_sponsor and status in ('held','confirmed');
  if not found then raise exception 'inactive_reservation'; end if;
  insert into moderation_actions(actor_id,action,target_id) values(p_actor,'billing_placement_withdrawn',p_sponsor);
end $$;
revoke all on function public.billing_withdraw_placement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_withdraw_placement(uuid,uuid) to service_role;

commit;
