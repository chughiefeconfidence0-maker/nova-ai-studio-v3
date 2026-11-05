-- Nova AI Studio V4.0 billing foundation.
-- Billing data is only accessible through the server-side service-role client.
create table if not exists public.tool_trials (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);
create table if not exists public.tool_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  plan_interval text not null check (plan_interval in ('monthly','yearly')),
  plan_code text not null,
  status text not null check (status in ('active','expired','cancelled','past_due')),
  current_period_end timestamptz not null,
  provider text not null default 'paystack',
  updated_at timestamptz not null default now(),
  unique (user_id, tool_id)
);
create table if not exists public.billing_transactions (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  plan_interval text not null check (plan_interval in ('monthly','yearly')),
  amount integer not null check (amount > 0),
  currency text not null default 'NGN',
  status text not null check (status in ('success','failed')),
  created_at timestamptz not null default now()
);
alter table public.tool_trials enable row level security;
alter table public.tool_subscriptions enable row level security;
alter table public.billing_transactions enable row level security;
revoke all on public.tool_trials, public.tool_subscriptions, public.billing_transactions from anon, authenticated, public;
grant all on public.tool_trials, public.tool_subscriptions, public.billing_transactions to service_role;

create or replace function public.consume_tool_trial(p_user_id uuid, p_tool_id text, p_trial_limit integer)
returns table(allowed boolean, is_subscriber boolean, trial_used integer, trial_remaining integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_end timestamptz;
  v_usage integer;
begin
  select current_period_end into v_end from public.tool_subscriptions
  where user_id = p_user_id and tool_id = p_tool_id and status = 'active' limit 1;
  if v_end is not null and v_end > now() then
    return query select true, true, 0, 0;
    return;
  end if;
  insert into public.tool_trials(user_id, tool_id, usage_count)
  values (p_user_id, p_tool_id, 1)
  on conflict (user_id, tool_id)
  do update set usage_count = public.tool_trials.usage_count + 1, updated_at = now()
  where public.tool_trials.usage_count < p_trial_limit
  returning usage_count into v_usage;
  if v_usage is null then
    select usage_count into v_usage from public.tool_trials where user_id = p_user_id and tool_id = p_tool_id;
    return query select false, false, coalesce(v_usage, p_trial_limit), 0;
  else
    return query select true, false, v_usage, greatest(p_trial_limit - v_usage, 0);
  end if;
end;
$$;
revoke all on function public.consume_tool_trial(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.consume_tool_trial(uuid,text,integer) to service_role;
