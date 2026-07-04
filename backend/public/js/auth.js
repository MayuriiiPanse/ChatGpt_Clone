function showError(message) {
  const banner = document.getElementById("errorBanner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.add("show");
}

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait…" : label;
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    setLoading(btn, true, "Log in");

    try {
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const data = await api("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      setCurrentUser(data.user);
      window.location.href = "chat.html";
    } catch (err) {
      showError(err.message || "Couldn't log in. Check your details and try again.");
      setLoading(btn, false, "Log in");
    }
  });
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    setLoading(btn, true, "Sign up");

    try {
      const firstName = document.getElementById("firstName").value.trim();
      const lastName = document.getElementById("lastName").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const data = await api("/api/auth/register", {
        method: "POST",
        body: { fullName: { firstName, lastName }, email, password },
      });

      setCurrentUser(data.user);
      window.location.href = "chat.html";
    } catch (err) {
      showError(err.message || "Couldn't create your account. Try again.");
      setLoading(btn, false, "Sign up");
    }
  });
}
