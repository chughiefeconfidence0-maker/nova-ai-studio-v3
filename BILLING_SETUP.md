# Nova AI Studio V4.0 — Billing setup

The V4.0 branch contains Paystack checkout, payment verification, signed webhook validation, per-tool trial tracking, and server-side subscription access checks. The AI Writing Engine is the first registered paid tool.

## Supabase
The billing migrations are in `supabase/migrations/` and have been applied to the connected Supabase project. Billing tables use RLS and deny direct access to browser roles. The backend needs the service-role key; never expose it in frontend code or GitHub.

## Render environment variables
Add these in Render → Environment (server only):
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY` (use test mode first)
- `PAYSTACK_PLAN_WRITING_MONTHLY`
- `PAYSTACK_PLAN_WRITING_YEARLY`
- `PAYSTACK_PRICE_WRITING_MONTHLY_KOBO`
- `PAYSTACK_PRICE_WRITING_YEARLY_KOBO`
- Optional: `TRIAL_WRITING_LIMIT` (defaults to 1) and `PAYSTACK_CALLBACK_URL`

Create monthly and annual plans in Paystack and enter their plan codes. Amount variables must match the plans and be in kobo (₦1,000 = 100000).

Set Paystack's webhook URL to:
`https://nova-ai-studio-v3.onrender.com/api/billing/webhook`

The webhook verifies Paystack's `x-paystack-signature` using the server-side secret. Test registration, checkout, payment verification, duplicate webhooks, exhausted trials, renewals and cancellation in test mode before live payments.

Only the AI Writing Engine is currently configured as a billable tool. New tools need their own server-side tool registry entry, trial limit, and Paystack monthly/yearly plans. No merchant credentials or prices are committed. This branch has not been deployed or runtime-tested.
