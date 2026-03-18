import { I18N } from "./i18n.js";

function getApiBase() {
  return "https://craftlab-studio-backend.onrender.com";
}

export function initContact() {
  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("contactStatus");
  const btn = document.getElementById("contactBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const lang = localStorage.getItem("craftlab_lang") || "en";
    const dict = I18N[lang] || I18N.en;

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = dict["btn.sending"];
      }

      if (statusEl) {
        statusEl.className = "form-status info mt-2";
        statusEl.textContent = dict["status.sending"];
      }

      const apiBase = getApiBase();
      const res = await fetch("/.netlify/functions/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || dict["status.error"]);

      if (statusEl) {
        statusEl.className = "form-status success mt-2";
        statusEl.textContent = dict["status.sent"];
      }

      form.reset();
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.className = "form-status error mt-2";
        statusEl.textContent = `❌ ${err.message || dict["status.error"]}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = dict["contact.send"];
      }
    }
  });
}