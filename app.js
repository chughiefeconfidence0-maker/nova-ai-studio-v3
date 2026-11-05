const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const fullName = document.getElementById("fullName");
const nameLabel = document.getElementById("nameLabel");
const authSubmit = document.getElementById("authSubmit");
const authNote = document.getElementById("authNote");
let isRegister = false;

function setMode(register) {
  isRegister = register;
  loginTab.classList.toggle("active", !register);
  registerTab.classList.toggle("active", register);
  fullName.classList.toggle("hidden", !register);
  nameLabel.classList.toggle("hidden", !register);
  fullName.required = register;
  authSubmit.textContent = register ? "Create account" : "Sign in";
  authNote.textContent = "Starter interface only: connect a secure authentication provider before launch.";
}
loginTab.addEventListener("click", () => setMode(false));
registerTab.addEventListener("click", () => setMode(true));
document.getElementById("authForm").addEventListener("submit", event => {
  event.preventDefault();
  authNote.textContent = "This form is a visual starter and does not create or store accounts yet.";
});

document.getElementById("generateBtn").addEventListener("click", async () => {
  const prompt = document.getElementById("writingPrompt").value.trim();
  const type = document.getElementById("writingType").value;
  const result = document.getElementById("result");
  if (!prompt) {
    result.textContent = "Please enter what you want to write first.";
    result.classList.add("error");
    return;
  }
  result.classList.remove("error");
  result.textContent = "Connecting to the secure AI backend…";
  try {
    const response = await fetch("https://nova-ai-studio-v3.onrender.com/api/write", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({prompt, type})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The writing service could not complete the request.");
    result.textContent = data.text || "No draft was returned.";
  } catch (error) {
    result.classList.add("error");
    result.textContent = "The AI backend is not connected yet. This page is ready for the next setup step. Your prompt was not sent to an AI provider.";
  }
});
