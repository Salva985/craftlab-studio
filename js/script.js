// ===== Smooth scroll for internal links =====
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    if (!targetId || targetId === "#") return;

    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;

    event.preventDefault();
    targetEl.scrollIntoView({ behavior: "smooth" });
  });
});

// ===== Reveal-on-scroll animations =====
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((el) => observer.observe(el));
} else {
  revealElements.forEach((el) => el.classList.add("show"));
}

// ===== Button micro-interaction on click =====
const buttons = document.querySelectorAll(".btn-accent, .btn-outline-accent");
buttons.forEach((btn) => {
  btn.addEventListener("mousedown", () => btn.classList.add("btn-press"));
  ["mouseup", "mouseleave"].forEach((ev) =>
    btn.addEventListener(ev, () => btn.classList.remove("btn-press"))
  );
});

// ===== Optional: slight parallax on neon glow =====
const glow = document.querySelector(".neon-glow");
if (glow) {
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 30;
    const y = (e.clientY / window.innerHeight - 0.5) * 15;
    glow.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// ===== DOM Ready =====
document.addEventListener("DOMContentLoaded", () => {
  // ---------- Cookie modal ----------
  const CONSENT_KEY = "craftlab_cookie_consent"; // "accepted" | "rejected"
  const modalEl = document.getElementById("cookieModal");
  const acceptBtn = document.getElementById("cookieAccept");
  const rejectBtn = document.getElementById("cookieReject");

  if (modalEl && typeof bootstrap !== "undefined") {
    const consent = sessionStorage.getItem(CONSENT_KEY);

    // Show only if no choice yet
    if (!consent) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl, {
        backdrop: "static",
        keyboard: false,
      });
      modal.show();
    }

    const closeModal = () => {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.hide();
    };

    if (acceptBtn) {
      acceptBtn.addEventListener("click", () => {
        sessionStorage.setItem(CONSENT_KEY, "accepted");
        closeModal();
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => {
        sessionStorage.setItem(CONSENT_KEY, "rejected");
        closeModal();
      });
    }
  } else {
    console.warn("Cookie modal not found or Bootstrap not loaded.");
  }

  // ---------- Contact form ----------
  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("contactStatus");
  const btn = document.getElementById("contactBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending...";
      }
      if (statusEl) {
        statusEl.className = "form-status info mt-2";
        statusEl.textContent = "Sending…";
      }

      const res = await fetch("http://localhost:5050/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send");

      if (statusEl) {
        statusEl.className = "form-status success mt-2";
        statusEl.textContent = "✅ Sent! I’ll reply within 24–48 hours.";
      }

      form.reset();
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.className = "form-status error mt-2";
        statusEl.textContent = `❌ ${err.message || "Something went wrong. Try again."}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Send";
      }
    }
  });
});