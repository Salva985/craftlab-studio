import { initLang } from "./i18n.js";
import { initCookies } from "./cookies.js";
import { initUI } from "./ui.js";
import { initContact } from "./contact.js";

document.addEventListener("DOMContentLoaded", () => {
  initLang();
  initCookies();
  initUI();
  initContact();
});