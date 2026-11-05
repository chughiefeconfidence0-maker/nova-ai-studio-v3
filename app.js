const API_BASE = "https://nova-ai-studio-v3.onrender.com";

const authPanel = document.getElementById("authPanel");
const workspace = document.getElementById("workspace");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const emailForm = document.getElementById("emailForm");
const verifyForm = document.getElementById("verifyForm");
const fullName = document.getElementById("fullName");
const nameField = document.getElementById("nameField");
const emailInput = document.getElementById("email");
const otpCode = document.getElementById("otpCode");
const authTitle = document.getElementById("authTitle");
const authIntro = document.getElementById("authIntro");
const authNote = document.getElementById("authNote");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const resendCodeBtn = document.getElementById("resendCodeBtn");
const sentToEmail = document.getElementById("sentToEmail");
const forgotLink = document.getElementById("forgotLink");
const recoveryHelp = document.getElementById("recoveryHelp");
const result = document.getElementById("result");

let isRegister = false;
let supabase = null;
let currentSession = null;
let pendingEmail = "";

function showMessage(message, isError = false) {
  authNote.textContent = message;
  authNote.classList.toggle("error-text", isError);
}

function setMode(register) {
  isRegister = register;
  loginTab.classList.toggle("active", !register);
  registerTab.classList.toggle("active", register);
  nameField.classList.toggle("hidden", !register);
  fullName.required = register;
  authTitle.textContent = register ? "Create your Nova account" : "Welcome back";
  authIntro.textContent = register
    ? "Enter your name and email. We'll send a 6-digit code to verify your address."
    : "Enter your email. We'll send you a secure 6-digit sign-in code.";
  sendCodeBtn.textContent = register ? "Create account and send code →" : "Email me a sign-in code →";
  recoveryHelp.classList.add("hidden");
  showMessage("Your email code is private. Never share it with anyone.");
}

function showWorkspace(session) {
  currentSession = session;
  authPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  document.getElementById("welcomeText").textContent =
    session.user.user_metadata?.full_name
      ? "Welcome, " + session.user.user_metadata.full_name
      : "Signed in as " + (session.user.email || "your account");
}

function showLogin(message = "Enter your email to receive a secure sign-in code.") {
  currentSession = null;
  workspace.classList.add("hidden");
  authPanel.classList.remove("hidden");
  emailForm.classList.remove("hidden");
  verifyForm.classList.add("hidden");
  showMessage(message);
}

function friendlyAuthError(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/rate limit|too many requests/i.test(message)) return "Please wait a little before requesting another code.";
  if (/invalid.*otp|otp.*expired|token.*expired/i.test(message)) return "That code is incorrect or expired. Request a new code and try again.";
  if (/email.*not confirmed/i.test(message)) return "Please verify your email using the latest code we sent.";
  return message;
}

async function requestCode() {
  if (!supabase) return showMessage("Secure sign-in is still loading. Refresh and try again.", true);
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return showMessage("Enter your email address first.", true);

  sendCodeBtn.disabled = true;
  showMessage(isRegister ? "Creating your account and sending your code…" : "Sending your secure sign-in code…");

  try {
    const options = { shouldCreateUser: isRegister };
    if (isRegister) options.data = { full_name: fullName.value.trim() };
    const { error } = await supabase.auth.signInWithOtp({ email, options });
    if (error) throw error;

    pendingEmail = email;
    sentToEmail.textContent = email;
    emailForm.classList.add("hidden");
    verifyForm.classList.remove("hidden");
    otpCode.value = "";
    otpCode.focus();
    authTitle.textContent = "Check your email";
    authIntro.textContent = "We sent a one-time verification code. It expires, so enter the latest code.";
    showMessage("Code sent. Check your inbox, Spam, and Promotions folders.");
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    sendCodeBtn.disabled = false;
  }
}

async function verifyCode(event) {
  event.preventDefault();
  const token = otpCode.value.trim();
  if (!/^\d{6}$/.test(token)) return showMessage("Enter the 6-digit code from your email.", true);

  verifyCodeBtn.disabled = true;
  showMessage("Verifying your code…");
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token,
      type: "email"
    });
    if (error) throw error;
    if (!data.session) throw new Error("The code was accepted but no session was created. Please request a new code.");
    showWorkspace(data.session);
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    verifyCodeBtn.disabled = false;
  }
}

async function resendCode() {
  if (!pendingEmail || !supabase) return;
  resendCodeBtn.disabled = true;
  showMessage("Requesting a fresh code…");
  try {
    const options = { shouldCreateUser: isRegister };
    if (isRegister) options.data = { full_name: fullName.value.trim() };
    const { error } = await supabase.auth.signInWithOtp({ email: pendingEmail, options });
    if (error) throw error;
    otpCode.value = "";
    showMessage("A new code has been sent. Use the newest email; older codes may no longer work.");
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    resendCodeBtn.disabled = false;
  }
}

async function initialize() {
  try {
    const configResponse = await fetch(API_BASE + "/api/config", { cache: "no-store" });
    const config = await configResponse.json();
    if (!configResponse.ok) throw new Error(config.error || "Secure sign-in is not configured yet.");
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("The secure sign-in service could not load. Check your connection and refresh.");
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
    showLogin(error.message || "Secure sign-in is not ready yet.");
    sendCodeBtn.disabled = true;
  }
}

loginTab.addEventListener("click", () => setMode(false));
registerTab.addEventListener("click", () => setMode(true));
emailForm.addEventListener("submit", event => {
  event.preventDefault();
  requestCode();
});
verifyForm.addEventListener("submit", verifyCode);
resendCodeBtn.addEventListener("click", resendCode);
document.getElementById("changeEmailBtn").addEventListener("click", () => {
  verifyForm.classList.add("hidden");
  emailForm.classList.remove("hidden");
  authTitle.textContent = isRegister ? "Create your Nova account" : "Welcome back";
  authIntro.textContent = "Check the email address and request a new code.";
  showMessage("You can change the email address and request another code.");
});
forgotLink.addEventListener("click", () => {
  recoveryHelp.classList.toggle("hidden");
});
document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (!supabase) return;
  const button = document.getElementById("logoutBtn");
  button.disabled = true;
  const { error } = await supabase.auth.signOut();
  button.disabled = false;
  if (error) showMessage(error.message, true);
  else showLogin("You have signed out safely.");
});

document.getElementById("generateBtn").addEventListener("click", async () => {
  const prompt = document.getElementById("writingPrompt").value.trim();
  const type = document.getElementById("writingType").value;
  if (!currentSession || !supabase) {
    showLogin("Please verify your email before using the AI Writing Engine.");
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
    if (sessionError || !sessionData.session) throw new Error("Your session expired. Request a new email code to sign in again.");
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
  } catch (error) {
    result.classList.add("error");
    result.textContent = error.message || "Unable to generate writing. Please try again.";
  }
});

setMode(false);
initialize();
