const API_BASE = "https://nova-ai-studio-v3.onrender.com";

const authPanel = document.getElementById("authPanel");
const workspace = document.getElementById("workspace");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const fullName = document.getElementById("fullName");
const nameLabel = document.getElementById("nameLabel");
const authSubmit = document.getElementById("authSubmit");
const authNote = document.getElementById("authNote");
const authForm = document.getElementById("authForm");
const logoutBtn = document.getElementById("logoutBtn");
const result = document.getElementById("result");

let isRegister = false;
let supabase = null;
let currentSession = null;

function showMessage(message, isError = false) {
  authNote.textContent = message;
  authNote.classList.toggle("error-text", isError);
}

function setMode(register) {
  isRegister = register;
  loginTab.classList.toggle("active", !register);
  registerTab.classList.toggle("active", register);
  fullName.classList.toggle("hidden", !register);
  nameLabel.classList.toggle("hidden", !register);
  fullName.required = register;
  authSubmit.textContent = register ? "Create account" : "Sign in";
  document.getElementById("password").autocomplete = register ? "new-password" : "current-password";
  showMessage(register
    ? "Create your account. You may need to confirm your email before signing in."
    : "Sign in to open your private workspace.");
}

function showWorkspace(session) {
  currentSession = session;
  window.dispatchEvent(new CustomEvent("nova-session", { detail: session }));
  authPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  document.getElementById("welcomeText").textContent =
    session.user.user_metadata?.full_name
      ? "Welcome, " + session.user.user_metadata.full_name
      : "You are signed in.";
}

function showLogin(message = "Sign in to open your private workspace.") {
  currentSession = null;
  workspace.classList.add("hidden");
  authPanel.classList.remove("hidden");
  showMessage(message);
}

async function initialize() {
  try {
    const configResponse = await fetch(API_BASE + "/api/config", { cache: "no-store" });
    const config = await configResponse.json();
    if (!configResponse.ok) throw new Error(config.error || "Authentication setup is incomplete.");

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("The sign-in service could not load. Check your connection and refresh.");
    }

    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (data.session) showWorkspace(data.session);
    else showLogin();

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) showWorkspace(session);
      else showLogin();
    });
  } catch (error) {
    showLogin(error.message || "Authentication is not ready yet.");
    authSubmit.disabled = true;
  }
}

loginTab.addEventListener("click", () => setMode(false));
registerTab.addEventListener("click", () => setMode(true));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabase) return showMessage("Sign-in is not configured yet. Please try again later.", true);

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  authSubmit.disabled = true;
  showMessage(isRegister ? "Creating your account…" : "Signing you in…");

  try {
    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.value.trim() },
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      if (data.session) showWorkspace(data.session);
      else showMessage("Account created. Check your email for the confirmation link, then return here to sign in.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showWorkspace(data.session);
    }
  } catch (error) {
    showMessage(error.message || "Unable to complete sign-in. Please try again.", true);
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!supabase) return;
  logoutBtn.disabled = true;
  const { error } = await supabase.auth.signOut();
  logoutBtn.disabled = false;
  if (error) showMessage(error.message, true);
  else showLogin("You have signed out.");
});

document.getElementById("generateBtn").addEventListener("click", async () => {
  const prompt = document.getElementById("writingPrompt").value.trim();
  const type = document.getElementById("writingType").value;

  if (!currentSession || !supabase) {
    showLogin("Please sign in before using the AI Writing Engine.");
    return;
  }
  if (!prompt) {
    result.textContent = "Please enter what you want to write first.";
    result.classList.add("error");
    return;
  }

  result.classList.remove("error");
  result.textContent = "Connecting to the secure AI backend…";

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Your session expired. Please sign in again.");

    const response = await fetch(API_BASE + "/api/write", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + sessionData.session.access_token
      },
      body: JSON.stringify({ prompt, type })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The writing service could not complete the request.");
    result.textContent = data.text || "No draft was returned.";
    window.dispatchEvent(new CustomEvent("nova-session", { detail: currentSession }));
  } catch (error) {
    result.classList.add("error");
    result.textContent = error.message || "Unable to generate writing. Please try again.";
    window.dispatchEvent(new CustomEvent("nova-session", { detail: currentSession }));
  }
});


let billingSession = null;
document.addEventListener("nova-session", async event => {
  billingSession = event.detail;
  const status = document.getElementById("billingStatus");
  const button = document.getElementById("subscribeBtn");
  if (!status || !button) return;
  try {
    const r = await fetch(API_BASE + "/api/billing/access?tool=writing", {
      headers: { Authorization: "Bearer " + billingSession.access_token }, cache: "no-store"
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Billing status unavailable.");
    status.textContent = d.subscribed ? "Subscription active until " + new Date(d.periodEnd).toLocaleDateString() : d.trialRemaining + " free trial uses remaining.";
    button.disabled = !d.paymentConfigured || d.subscribed;
    button.textContent = d.subscribed ? "Subscription active" : (d.paymentConfigured ? "Subscribe to Writing" : "Payment setup pending");
    const reference = new URLSearchParams(location.search).get("reference");
    if (reference) {
      const v = await fetch(API_BASE + "/api/billing/verify", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + billingSession.access_token },
        body: JSON.stringify({ reference })
      });
      const result = await v.json();
      if (!v.ok) throw new Error(result.error || "Payment verification failed.");
      status.textContent = result.message;
      history.replaceState({}, document.title, location.pathname);
    }
  } catch (e) { status.textContent = e.message || "Billing status unavailable."; button.disabled = true; }
});
document.getElementById("subscribeBtn")?.addEventListener("click", async () => {
  if (!billingSession) return;
  const button = document.getElementById("subscribeBtn");
  const status = document.getElementById("billingStatus");
  button.disabled = true;
  try {
    const r = await fetch(API_BASE + "/api/billing/checkout", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + billingSession.access_token },
      body: JSON.stringify({ tool: "writing", interval: document.getElementById("billingInterval").value })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Checkout could not start.");
    location.href = d.authorizationUrl;
  } catch (e) { status.textContent = e.message || "Checkout could not start."; button.disabled = false; }
});

setMode(false);
initialize();
