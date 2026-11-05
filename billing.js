const crypto = require("crypto");

const TOOL_CONFIG = {
  writing: {
    name: "AI Writing Engine",
    trialLimit: Number.parseInt(process.env.TRIAL_WRITING_LIMIT || "3", 10),
    plans: {
      monthly: { code: process.env.PAYSTACK_PLAN_WRITING_MONTHLY, amount: Number(process.env.PAYSTACK_PRICE_WRITING_MONTHLY_KOBO || 0) },
      yearly: { code: process.env.PAYSTACK_PLAN_WRITING_YEARLY, amount: Number(process.env.PAYSTACK_PRICE_WRITING_YEARLY_KOBO || 0) }
    }
  }
};

function addPeriod(interval) {
  const date = new Date();
  if (interval === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function registerBillingRoutes(app, { requireUser, supabaseAdmin }) {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  async function recordSuccessfulPayment(payment) {
    const meta = payment.metadata || {};
    const userId = meta.nova_user_id;
    const toolId = meta.nova_tool_id;
    const interval = meta.nova_interval;
    const config = TOOL_CONFIG[toolId];
    const plan = config && config.plans[interval];
    if (!userId || !config || !plan || !plan.code) throw new Error("Payment metadata or plan is invalid.");
    if (payment.status !== "success" || payment.currency !== "NGN" || Number(payment.amount) !== plan.amount) {
      throw new Error("Payment status, currency, or amount did not match the configured plan.");
    }

    const reference = String(payment.reference || "");
    if (!reference) throw new Error("Payment reference is missing.");
    const { error: txError } = await supabaseAdmin.from("billing_transactions").insert({
      reference, user_id: userId, tool_id: toolId, plan_interval: interval,
      amount: Number(payment.amount), currency: "NGN", status: "success"
    });
    if (txError) {
      if (txError.code === "23505") return { duplicate: true };
      throw txError;
    }

    const { error: subError } = await supabaseAdmin.from("tool_subscriptions").upsert({
      user_id: userId, tool_id: toolId, plan_interval: interval, plan_code: plan.code,
      status: "active", current_period_end: addPeriod(interval), provider: "paystack",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,tool_id" });
    if (subError) throw subError;
    return { duplicate: false };
  }

  app.get("/api/billing/access", requireUser, async (req, res) => {
    const toolId = String(req.query.tool || "");
    const config = TOOL_CONFIG[toolId];
    if (!config) return res.status(400).json({ error: "Unknown tool." });
    const [{ data: trial, error: trialError }, { data: sub, error: subError }] = await Promise.all([
      supabaseAdmin.from("tool_trials").select("usage_count").eq("user_id", req.user.id).eq("tool_id", toolId).maybeSingle(),
      supabaseAdmin.from("tool_subscriptions").select("status,current_period_end,plan_interval").eq("user_id", req.user.id).eq("tool_id", toolId).maybeSingle()
    ]);
    if (trialError || subError) return res.status(503).json({ error: "Billing status is temporarily unavailable." });
    const active = !!sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();
    const used = trial?.usage_count || 0;
    return res.json({ tool: toolId, toolName: config.name, subscribed: active, periodEnd: active ? sub.current_period_end : null, trialLimit: config.trialLimit, trialUsed: used, trialRemaining: active ? null : Math.max(config.trialLimit - used, 0), paymentConfigured: !!(secret && config.plans.monthly.code && config.plans.yearly.code) });
  });

  app.post("/api/billing/checkout", requireUser, async (req, res) => {
    if (!secret) return res.status(503).json({ error: "Paystack is not configured yet." });
    const toolId = String(req.body?.tool || "");
    const interval = String(req.body?.interval || "");
    const config = TOOL_CONFIG[toolId];
    const plan = config && config.plans[interval];
    if (!config || !plan || !["monthly", "yearly"].includes(interval)) return res.status(400).json({ error: "Choose a valid tool and subscription interval." });
    if (!plan.code || !Number.isSafeInteger(plan.amount) || plan.amount <= 0) return res.status(503).json({ error: "This subscription plan has not been configured yet." });

    try {
      const reference = "NOVA-" + crypto.randomUUID().replace(/-/g, "");
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: req.user.email,
          amount: plan.amount,
          currency: "NGN",
          plan: plan.code,
          reference,
          callback_url: process.env.PAYSTACK_CALLBACK_URL || "https://chughiefeconfidence0-maker.github.io/nova-ai-studio-v3/",
          metadata: { nova_user_id: req.user.id, nova_tool_id: toolId, nova_interval: interval }
        }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await response.json();
      if (!response.ok || !data.status || !data.data?.authorization_url) {
        console.error("Paystack initialization failed:", response.status);
        return res.status(502).json({ error: "Unable to start checkout. Please try again." });
      }
      return res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
    } catch (error) {
      console.error("Paystack checkout error:", error.name);
      return res.status(502).json({ error: "Payment service is temporarily unavailable." });
    }
  });

  app.post("/api/billing/verify", requireUser, async (req, res) => {
    if (!secret) return res.status(503).json({ error: "Paystack is not configured yet." });
    const reference = String(req.body?.reference || "");
    if (!/^[A-Za-z0-9.=-]{8,100}$/.test(reference)) return res.status(400).json({ error: "Invalid payment reference." });
    try {
      const response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
        headers: { Authorization: "Bearer " + secret }, signal: AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (!response.ok || !result.status || !result.data) return res.status(502).json({ error: "Unable to verify payment yet." });
      if (result.data.metadata?.nova_user_id !== req.user.id) return res.status(403).json({ error: "This payment does not belong to your account." });
      if (result.data.status !== "success") return res.status(402).json({ error: "Payment has not been confirmed." });
      await recordSuccessfulPayment(result.data);
      return res.json({ verified: true, message: "Payment verified. Your tool subscription is active." });
    } catch (error) {
      console.error("Paystack verification failed:", error.message || error.name);
      return res.status(502).json({ error: "Payment could not be verified. Please contact support if you were charged." });
    }
  });

  app.post("/api/billing/webhook", async (req, res) => {
    if (!secret || !req.rawBody) return res.sendStatus(503);
    const signature = req.headers["x-paystack-signature"] || "";
    const expected = crypto.createHmac("sha512", secret).update(req.rawBody).digest();
    let supplied;
    try { supplied = Buffer.from(signature, "hex"); } catch { return res.sendStatus(401); }
    if (!/^[a-f0-9]{128}$/i.test(signature) || supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) return res.sendStatus(401);
    const event = req.body || {};
    if (event.event === "charge.success") {
      try {
        await recordSuccessfulPayment(event.data || {});
      } catch (error) {
        console.error("Paystack webhook processing failed:", error.message || error.name);
        return res.sendStatus(500);
      }
    }
    return res.sendStatus(200);
  });
}

module.exports = { registerBillingRoutes };
