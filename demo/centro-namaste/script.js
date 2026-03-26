const businessNameEl = document.getElementById("businessName");
const headlineEl = document.getElementById("headline");
const locationEl = document.getElementById("location");
const aboutTextEl = document.getElementById("aboutText");

const primaryCtaEl = document.getElementById("primaryCta");
const secondaryCtaEl = document.getElementById("secondaryCta");

const servicesListEl = document.getElementById("servicesList");
const benefitsListEl = document.getElementById("benefitsList");

const ctaTitleEl = document.getElementById("ctaTitle");
const ctaTextEl = document.getElementById("ctaText");
const ctaButtonEl = document.getElementById("ctaButton");

function createCard(item) {
  const article = document.createElement("article");
  article.className = "card";

  const title = document.createElement("h3");
  title.textContent = item.title;

  const text = document.createElement("p");
  text.textContent = item.text;

  article.append(title, text);
  return article;
}

function renderList(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    container.appendChild(createCard(item));
  });
}

function initDemo() {
  document.title = `${data.businessName} | Wellness Demo`;

  businessNameEl.textContent = data.businessName;
  headlineEl.textContent = data.headline;
  locationEl.textContent = data.city;
  aboutTextEl.textContent = data.about;

  primaryCtaEl.textContent = data.primaryCtaLabel;
  primaryCtaEl.href = data.primaryCtaLink;

  secondaryCtaEl.textContent = data.secondaryCtaLabel;
  secondaryCtaEl.href = data.secondaryCtaLink;

  ctaTitleEl.textContent = data.ctaTitle;
  ctaTextEl.textContent = data.ctaText;
  ctaButtonEl.textContent = data.ctaButtonLabel;
  ctaButtonEl.href = data.ctaButtonLink;

  renderList(servicesListEl, data.services);
  renderList(benefitsListEl, data.benefits);
}

initDemo();