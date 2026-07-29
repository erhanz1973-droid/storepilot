-- Webhook delivery idempotency must not consume a delivery that failed to process.
--
-- Deliveries are now claimed as 'processing' before the handler runs and marked
-- 'completed' only after it succeeds. A failed attempt is released so a Shopify
-- retry can claim the same webhook id again.

alter table public.shopify_webhook_deliveries
  add column if not exists status text,
  add column if not exists claimed_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists attempts integer not null default 1;

-- Existing rows predate status tracking. They were recorded when a delivery was
-- accepted, so treat them as completed to preserve current dedupe behaviour.
update public.shopify_webhook_deliveries
   set status = 'completed',
       completed_at = coalesce(completed_at, processed_at)
 where status is null;

alter table public.shopify_webhook_deliveries
  alter column status set default 'processing';

alter table public.shopify_webhook_deliveries
  alter column status set not null;

alter table public.shopify_webhook_deliveries
  drop constraint if exists shopify_webhook_deliveries_status_check;

alter table public.shopify_webhook_deliveries
  add constraint shopify_webhook_deliveries_status_check
  check (status in ('processing', 'completed'));

-- Supports reclaiming deliveries abandoned by a crashed/timed-out invocation.
create index if not exists shopify_webhook_deliveries_status_claimed_at_idx
  on public.shopify_webhook_deliveries (status, claimed_at);
