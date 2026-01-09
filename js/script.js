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

// ===== Contact form (prevent reload + send to your API) =====
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("contactStatus");
  const btn = document.getElementById("contactBtn");

  if (!form) {
    console.warn("contactForm not found (missing id='contactForm')");
    return;
  }

  const setStatus = (msg, type = "info") => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `form-status mt-2 ${type}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (btn) btn.disabled = true;
      setStatus("Sending…", "info");

      const res = await fetch("http://localhost:5050/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send");

      setStatus("✅ Sent! I’ll reply within 24–48 hours.", "success");
      form.reset();

      // Optional: show Ethereal preview link (test mode)
      if (data?.preview) {
        console.log("Ethereal preview:", data.preview);
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ ${err.message || "Something went wrong."}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});