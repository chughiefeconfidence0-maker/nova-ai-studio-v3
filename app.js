const API_BASE = "https://nova-ai-studio-v3.onrender.com";
const $ = id => document.getElementById(id);

const authPanel = $("authPanel");
const workspace = $("workspace");
const passwordForm = $("passwordForm");
const codeRequestForm = $("codeRequestForm");
const verifyForm = $("verifyForm");
const resetRequestForm = $("resetRequestForm");
const newPasswordForm = $("newPasswordForm");
const authNote = $("authNote");
const result = $("result");

let supabase = null;
let currentSession = null;
let isRegister = false;
let pendingCodeEmail = "";
let codeRequestMode = false;

function showMessage(message, isError = false) {
  authNote.textContent = message;
  authNote.classList.toggle("error-text", isError);
}
function showAuthForm(form) {
  [passwordForm, codeRequestForm, verifyForm, resetRequestForm, newPasswordForm].forEach(item => item.classList.add("hidden"));
  if (form) form.classList.remove("hidden");
}
function setMode(register) {
  isRegister = register;
  $("loginTab").classList.toggle("active", !register);
  $("registerTab").classList.toggle("active", register);
  $("nameField").classList.toggle("hidden", !register);
  $("confirmPasswordField").classList.toggle("hidden", !register);
  $("fullName").required = register;
  $("confirmPassword").required = register;
  $("password").autocomplete = register ? "new-password" : "current-password";
  $("authTitle").textContent = register ? "Create your Nova account" : "Welcome back";
  $("authIntro").textContent = register
    ? "Create your account with your email and a secure password."
    : "Sign in with the email and password linked to your account.";
  $("passwordSubmitBtn").textContent = register ? "Create account →" : "Sign in securely →";
  $("loginLinks").classList.toggle("hidden", register);
  showAuthForm(passwordForm);
  showMessage(register ? "Use a password you have not used on another website." : "Welcome back. Your Nova account is waiting.");
}
function showWorkspace(session) {
  currentSession = session;
  authPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  $("welcomeText").textContent = session.user.user_metadata?.full_name
    ? "Welcome, " + session.user.user_metadata.full_name
    : "Signed in as " + (session.user.email || "your account");
}
function showLogin(message = "Sign in with your email and password.") {
  currentSession = null;
  workspace.classList.add("hidden");
  authPanel.classList.remove("hidden");
  $("authTabs").classList.remove("hidden");
  $("loginLinks").classList.remove("hidden");
  setMode(false);
  showMessage(message);
}
function friendlyAuthError(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Please wait a little and try again.";
  if (/invalid.*otp|otp.*expired|token.*expired/i.test(message)) return "That code is incorrect or expired. Request a fresh code and try again.";
  if (/email.*not confirmed/i.test(message)) return "Please verify your email using the confirmation message we sent.";
  if (/already registered|already exists|user_already_exists/i.test(message)) return "We could not complete account creation with those details. Check the information and try again, or use the sign-in option.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect. If this is an older email-code account, choose email-code sign-in.";
  if (/password should be at least/i.test(message)) return "Choose a password with at least 8 characters.";
  return message;
}

async function handlePasswordSubmit(event) {
  event.preventDefault();
  if (!supabase) return showMessage("Secure account service is loading. Refresh and try again.", true);
  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  if (password.length < 8) return showMessage("Your password must contain at least 8 characters.", true);
  $("passwordSubmitBtn").disabled = true;
  try {
    if (isRegister) {
      if (password !== $("confirmPassword").value) throw new Error("The passwords do not match.");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: $("fullName").value.trim() },
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      if (data.session) {
        showWorkspace(data.session);
      } else {
        showAuthForm(passwordForm);
        showMessage("Account created. Check your email and confirm your address before signing in. If the email is missing, check Spam and Promotions.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sign-in did not create a session. Please try again.");
      showWorkspace(data.session);
    }
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("passwordSubmitBtn").disabled = false;
  }
}

async function requestEmailCode(event) {
  event.preventDefault();
  const email = $("codeEmail").value.trim().toLowerCase();
  if (!email || !supabase) return showMessage("Enter your account email and try again.", true);
  $("sendCodeBtn").disabled = true;
  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw error;
    pendingCodeEmail = email;
    $("sentToEmail").textContent = email;
    showAuthForm(verifyForm);
    $("authTitle").textContent = "Check your email";
    $("authIntro").textContent = "Enter the latest 6-digit sign-in code.";
    $("otpCode").value = "";
    showMessage("If this email has a Nova account, a sign-in code has been sent. Check Spam and Promotions too.");
    $("otpCode").focus();
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("sendCodeBtn").disabled = false;
  }
}
async function verifyEmailCode(event) {
  event.preventDefault();
  const token = $("otpCode").value.trim();
  if (!/^\d{6}$/.test(token)) return showMessage("Enter the 6-digit code from your email.", true);
  $("verifyCodeBtn").disabled = true;
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: pendingCodeEmail, token, type: "email" });
    if (error) throw error;
    if (!data.session) throw new Error("The code was accepted but no session was created. Request a new code.");
    showWorkspace(data.session);
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("verifyCodeBtn").disabled = false;
  }
}
async function resendEmailCode() {
  if (!pendingCodeEmail || !supabase) return;
  $("resendCodeBtn").disabled = true;
  try {
    const { error } = await supabase.auth.signInWithOtp({ email: pendingCodeEmail, options: { shouldCreateUser: false } });
    if (error) throw error;
    $("otpCode").value = "";
    showMessage("A fresh code has been requested. Use the newest email.");
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("resendCodeBtn").disabled = false;
  }
}
async function requestPasswordReset(event) {
  event.preventDefault();
  const email = $("resetEmail").value.trim().toLowerCase();
  $("resetRequestBtn").disabled = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
    showMessage("If a Nova account exists for that email, a password-reset link has been sent. Check your inbox and Spam folder.");
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("resetRequestBtn").disabled = false;
  }
}
async function saveNewPassword(event) {
  event.preventDefault();
  const password = $("newPassword").value;
  if (password.length < 8) return showMessage("Use at least 8 characters for your new password.", true);
  if (password !== $("newPasswordConfirm").value) return showMessage("The passwords do not match.", true);
  $("saveNewPasswordBtn").disabled = true;
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    showMessage("Your password has been updated. You can now use it to sign in.");
    await supabase.auth.signOut();
    showLogin("Password updated successfully. Sign in with your new password.");
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("saveNewPasswordBtn").disabled = false;
  }
}
async function setAccountPassword(event) {
  event.preventDefault();
  const password = $("accountNewPassword").value;
  if (password.length < 8) return showMessage("Use at least 8 characters.", true);
  if (password !== $("accountConfirmPassword").value) return showMessage("The passwords do not match.", true);
  $("setPasswordBtn").disabled = true;
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    $("accountNewPassword").value = "";
    $("accountConfirmPassword").value = "";
    showMessage("Password saved. You can now sign in with your email and password next time.");
  } catch (error) {
    showMessage(friendlyAuthError(error), true);
  } finally {
    $("setPasswordBtn").disabled = false;
  }
}

async function initialize() {
  try {
    const response = await fetch(API_BASE + "/api/config", { cache: "no-store" });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "Secure account service is not configured.");
    if (!window.supabase?.createClient) throw new Error("The secure account library could not load. Check your connection and refresh.");
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        authPanel.classList.remove("hidden");
        workspace.classList.add("hidden");
        $("authTabs").classList.add("hidden");
        $("loginLinks").classList.add("hidden");
        $("authTitle").textContent = "Choose a new password";
        $("authIntro").textContent = "Your recovery link is valid. Set a new password below.";
        showAuthForm(newPasswordForm);
        showMessage("Choose a new password for your account.");
      } else if (session && event !== "SIGNED_OUT") {
        showWorkspace(session);
      } else if (!session) {
        showLogin();
      }
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) {
      if (window.location.hash.includes("type=recovery")) {
        $("authTabs").classList.add("hidden");
        $("loginLinks").classList.add("hidden");
        $("authTitle").textContent = "Choose a new password";
        showAuthForm(newPasswordForm);
      } else {
        showWorkspace(data.session);
      }
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin(error.message || "Secure account service is not ready.");
    $("passwordSubmitBtn").disabled = true;
    $("sendCodeBtn").disabled = true;
  }
}

$("loginTab").addEventListener("click", () => setMode(false));
$("registerTab").addEventListener("click", () => setMode(true));
passwordForm.addEventListener("submit", handlePasswordSubmit);
codeRequestForm.addEventListener("submit", requestEmailCode);
verifyForm.addEventListener("submit", verifyEmailCode);
resetRequestForm.addEventListener("submit", requestPasswordReset);
newPasswordForm.addEventListener("submit", saveNewPassword);
$("forgotLink").addEventListener("click", () => {
  showAuthForm(resetRequestForm);
  $("authTitle").textContent = "Reset your password";
  $("authIntro").textContent = "We'll send a secure recovery link to your email.";
  $("resetEmail").value = $("email").value.trim();
  showMessage("Enter the email linked to your Nova account.");
});
$("useCodeLink").addEventListener("click", () => {
  $("authTabs").classList.add("hidden");
  $("loginLinks").classList.add("hidden");
  showAuthForm(codeRequestForm);
  $("authTitle").textContent = "Sign in with an email code";
  $("authIntro").textContent = "For existing Nova accounts created using email codes.";
  showMessage("This keeps older passwordless accounts accessible.");
});
$("backToPasswordLink").addEventListener("click", () => {
  $("authTabs").classList.remove("hidden");
  $("loginLinks").classList.remove("hidden");
  setMode(false);
});
$("backFromResetLink").addEventListener("click", () => {
  $("authTabs").classList.remove("hidden");
  $("loginLinks").classList.remove("hidden");
  setMode(false);
});
$("changeCodeEmailBtn").addEventListener("click", () => {
  showAuthForm(codeRequestForm);
  $("authTitle").textContent = "Sign in with an email code";
  showMessage("Enter the email address linked to your account.");
});
$("resendCodeBtn").addEventListener("click", resendEmailCode);
$("logoutBtn").addEventListener("click", async () => {
  if (!supabase) return;
  $("logoutBtn").disabled = true;
  const { error } = await supabase.auth.signOut();
  $("logoutBtn").disabled = false;
  if (error) showMessage(friendlyAuthError(error), true);
});
$("setPasswordForm").addEventListener("submit", setAccountPassword);

$("generateBtn").addEventListener("click", async () => {
  const prompt = $("writingPrompt").value.trim();
  const type = $("writingType").value;
  if (!currentSession || !supabase) {
    showLogin("Please sign in before using the AI Writing Engine.");
    return;
  }
  if (!prompt) {
    result.textContent = "Please enter what you want to write first.";
    result.classList.add("error");
    return;
  }
  const generateButton = $("generateBtn");
  generateButton.disabled = true;
  generateButton.textContent = "Generating…";
  result.classList.remove("error");
  result.textContent = "Connecting to the secure AI backend…";
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Your session expired. Please sign in again.");
    const response = await fetch(API_BASE + "/api/write", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + data.session.access_token },
      body: JSON.stringify({ prompt, type })
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("The writing service returned an unreadable response. Please try again.");
    }
    if (!response.ok) throw new Error(body.error || "The writing service could not complete the request.");
    if (typeof body.text !== "string" || !body.text.trim()) {
      throw new Error("The AI returned an empty draft. Please try again.");
    }
    result.textContent = body.text;
  } catch (error) {
    result.classList.add("error");
    result.textContent = error.message || "Unable to generate writing. Please try again.";
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Generate draft ↗";
  }
});

showAuthForm(passwordForm);
setMode(false);
initialize();
