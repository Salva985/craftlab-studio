export function initUI() {
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (e) => {
        const targetId = anchor.getAttribute("href");
        if (!targetId || targetId === "#") return;
  
        const targetEl = document.querySelector(targetId);
        if (!targetEl) return;
  
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: "smooth" });
      });
    });
  
    // Reveal on scroll
    const revealElements = document.querySelectorAll(".reveal");
  
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("show");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
  
      revealElements.forEach((el) => observer.observe(el));
    } else {
      revealElements.forEach((el) => el.classList.add("show"));
    }
  
    // Button press micro interaction
    document
      .querySelectorAll(".btn-accent, .btn-outline-accent")
      .forEach((btn) => {
        btn.addEventListener("mousedown", () =>
          btn.classList.add("btn-press")
        );
        ["mouseup", "mouseleave"].forEach((ev) =>
          btn.addEventListener(ev, () =>
            btn.classList.remove("btn-press")
          )
        );
      });
  
    // Parallax glow (if exists)
    const glow = document.querySelector(".neon-glow");
    if (glow) {
      document.addEventListener("mousemove", (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 30;
        const y = (e.clientY / window.innerHeight - 0.5) * 15;
        glow.style.transform = `translate(${x}px, ${y}px)`;
      });
    }
  }