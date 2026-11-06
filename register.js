const APP_URL="https://nova-ai-studio-v3.onrender.com";
const $=id=>document.getElementById(id);
let supabaseClient=null;
let registeredEmail="";
function message(text,error=false){$("registerMessage").textContent=text;$("registerMessage").classList.toggle("error-text",error);}
function setStep(step){
  [["stepDetails",1],["stepVerify",2],["stepAccess",3]].forEach(([id,n])=>{
    $(id).classList.toggle("active",n===step);
    $(id).classList.toggle("done",n<step);
  });
}
function friendly(error){
  const m=error?.message||"Registration could not be completed. Please try again.";
  if(/already registered|already exists|user_already_exists/i.test(m))return "An account may already exist for this email. Try signing in, or use a different email address.";
  if(/rate limit|too many requests/i.test(m))return "Too many attempts. Please wait a little before trying again.";
  if(/password should be at least/i.test(m))return "Your password must contain at least 8 characters.";
  return m;
}
async function initialize(){
  try{
    const response=await fetch(APP_URL+"/api/config",{cache:"no-store"});
    const config=await response.json();
    if(!response.ok)throw new Error(config.error||"Account service is not ready.");
    if(!window.supabase?.createClient)throw new Error("The secure account library did not load. Refresh and try again.");
    supabaseClient=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey);
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;
    if(data.session){window.location.replace("/");return;}
    const params=new URLSearchParams(window.location.search);
    if(params.get("verified")==="1")message("Email verification completed. You can now sign in.");
  }catch(error){
    message(friendly(error),true);
    $("createAccountBtn").disabled=true;
  }
}
$("registerForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!supabaseClient)return message("Account service is still loading. Refresh and try again.",true);
  const username=$("username").value.trim();
  const fullName=$("fullName").value.trim();
  const email=$("email").value.trim().toLowerCase();
  const password=$("password").value;
  if(!/^[A-Za-z0-9_]{3,24}$/.test(username))return message("Username must be 3–24 characters using letters, numbers or underscores.",true);
  if(password.length<8)return message("Choose a password with at least 8 characters.",true);
  if(password!==$("confirmPassword").value)return message("Your passwords do not match.",true);
  const button=$("createAccountBtn");
  button.disabled=true;button.textContent="Creating your account…";
  try{
    const {data,error}=await supabaseClient.auth.signUp({
      email,password,
      options:{
        data:{username,full_name:fullName},
        emailRedirectTo:APP_URL+"/"
      }
    });
    if(error)throw error;
    registeredEmail=email;
    if(data.session){
      setStep(3);
      message("Your account is ready. Opening your Nova workspace…");
      window.location.replace("/");
      return;
    }
    $("registerForm").classList.add("hidden");
    $("verifySection").classList.remove("hidden");
    $("registerTitle").textContent="Verify your email";
    $("registerIntro").textContent="One final step before you can sign in.";
    $("verifyMessage").textContent="We sent a verification message to "+email+". Open that email and tap its confirmation link. Check Spam or Promotions if you cannot see it.";
    setStep(2);
    message("Account registration submitted. Email verification is required before sign-in.");
  }catch(error){
    message(friendly(error),true);
  }finally{
    button.disabled=false;button.textContent="Create my account →";
  }
});
$("resendVerificationBtn").addEventListener("click",async()=>{
  if(!supabaseClient||!registeredEmail)return;
  const button=$("resendVerificationBtn");button.disabled=true;button.textContent="Sending…";
  try{
    const {error}=await supabaseClient.auth.resend({type:"signup",email:registeredEmail,options:{emailRedirectTo:APP_URL+"/"}});
    if(error)throw error;
    message("A new verification email has been requested. Use the newest email and check Spam or Promotions.");
  }catch(error){message(friendly(error),true);}
  finally{button.disabled=false;button.textContent="Resend verification email";}
});
$("changeEmailBtn").addEventListener("click",()=>{
  $("verifySection").classList.add("hidden");
  $("registerForm").classList.remove("hidden");
  $("registerTitle").textContent="Create account";
  $("registerIntro").textContent="Complete each field below to join Nova.";
  setStep(1);message("Correct your details or enter a different email address.");
});
initialize();