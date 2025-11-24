// ===== Smooth scroll for internal links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;
  
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;
  
      event.preventDefault();
      targetEl.scrollIntoView({ behavior: 'smooth' });
    });
  });
  
  // ===== Reveal-on-scroll animations =====
  const revealElements = document.querySelectorAll('.reveal');
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target); // animate only once
        }
      });
    }, { threshold: 0.15 });
  
    revealElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: show all if observer not supported
    revealElements.forEach(el => el.classList.add('show'));
  }
  
  // ===== Button micro-interaction on click =====
  const buttons = document.querySelectorAll('.btn-accent, .btn-outline-accent');
  
  buttons.forEach(btn => {
    btn.addEventListener('mousedown', () => {
      btn.classList.add('btn-press');
    });
  
    ['mouseup', 'mouseleave'].forEach(ev =>
      btn.addEventListener(ev, () => btn.classList.remove('btn-press'))
    );
  });
  
  // ===== Optional: slight parallax on neon glow =====
  const glow = document.querySelector('.neon-glow');
  if (glow) {
    document.addEventListener('mousemove', e => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 15;
      glow.style.transform = `translate(${x}px, ${y}px)`;
    });
  }