export function initCookies() {
    const CONSENT_KEY = "craftlab_cookie_consent";
  
    function loadOptionalScripts() {
      console.log("✅ Optional scripts enabled");
    }
  
    const modalEl = document.getElementById("cookieModal");
    const acceptBtn = document.getElementById("cookieAccept");
    const rejectBtn = document.getElementById("cookieReject");
  
    if (!modalEl || typeof bootstrap === "undefined") return;
  
    const consent = localStorage.getItem(CONSENT_KEY);
  
    // If already accepted → load scripts
    if (consent === "accepted") {
      loadOptionalScripts();
    }
  
    // If no decision → show modal
    if (!consent) {
      bootstrap.Modal.getOrCreateInstance(modalEl, {
        backdrop: "static",
        keyboard: false,
      }).show();
    }
  
    // Accept
    acceptBtn?.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "accepted");
      loadOptionalScripts();
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    });
  
    // Reject
    rejectBtn?.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "rejected");
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    });
  }