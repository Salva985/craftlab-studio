import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
const PORT = process.env.PORT || 5050;

// ---------------- CORS ----------------
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman/curl/no-origin
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);

app.use(express.json({ limit: "200kb" }));

app.get("/health", (_, res) => res.json({ ok: true }));

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractEmail(from) {
  // "CraftLab Studio <info@craftlab-studio.com>" -> info@craftlab-studio.com
  const match = String(from || "").match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return String(from || "").trim();
}

function extractName(from) {
  // "CraftLab Studio <...>" -> CraftLab Studio
  const s = String(from || "");
  const idx = s.indexOf("<");
  if (idx > 0) return s.slice(0, idx).trim().replace(/^"|"$/g, "");
  return "";
}

// --------------- SMTP (local/dev) ---------------
async function createTransporter() {
  const mode = (process.env.MAIL_MODE || "test").toLowerCase();

  if (mode === "test") return nodemailer.createTransport({ jsonTransport: true });

  if (mode === "smtp") {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error("SMTP config missing. Fill SMTP_HOST/SMTP_USER/SMTP_PASS in env.");
    }

    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      logger: true,
      debug: true,
    });
  }

  return nodemailer.createTransport({ jsonTransport: true });
}

// --------------- ZEPTO (Render recommended) ---------------
function normalizeZeptoAuth(tokenRaw) {
  const t = String(tokenRaw || "").trim().replace(/^"+|"+$/g, ""); // remove quotes
  if (!t) return "";
  // Accept either "yA6K..." OR "Zoho-enczapikey yA6K..."
  if (t.toLowerCase().startsWith("zoho-enczapikey")) return t;
  return `Zoho-enczapikey ${t}`;
}

async function sendViaZepto({ to, from, subject, text, replyTo }) {
  const url = (process.env.ZEPTO_URL || "https://api.zeptomail.eu/v1.1/email").trim();
  const token = normalizeZeptoAuth(process.env.ZEPTO_TOKEN);

  if (!url) throw new Error("ZEPTO_URL missing on server.");
  if (!token) throw new Error("ZEPTO_TOKEN missing on server.");
  if (!to) throw new Error("MAIL_TO missing on server.");
  if (!from) throw new Error("MAIL_FROM missing on server.");

  const payload = {
    from: {
      address: extractEmail(from),
      name: extractName(from) || "CraftLab Studio",
    },
    to: [
      {
        email_address: {
          address: to,
          name: to,
        },
      },
    ],
    subject,
    textbody: text,
  };

  if (replyTo && isEmail(replyTo)) {
    payload.reply_to = [{ address: replyTo }];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await resp.text(); // sometimes Zepto returns non-json on error
    if (!resp.ok) {
      console.error("ZEPTO URL:", url);
      console.error("ZEPTO STATUS:", resp.status);
      console.error("ZEPTO BODY:", bodyText);
      throw new Error(`ZeptoMail error ${resp.status}: ${bodyText || resp.statusText}`);
    }

    return { ok: true, raw: bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------- ROUTE ----------------
app.post("/api/contact", async (req, res) => {
  console.log("➡️  /api/contact HIT", new Date().toISOString());
  console.log("BODY:", req.body);

  try {
    const { name, email, brand, budget, message, website, company } = req.body || {};

    // honeypot anti-bot
    if (website || company) return res.status(200).json({ ok: true });

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ ok: false, error: "Please enter your name." });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Please enter a valid email." });
    }
    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return res.status(400).json({ ok: false, error: "Message must be at least 10 characters." });
    }

    const mode = (process.env.MAIL_MODE || "test").toLowerCase();
    const mailTo = (process.env.MAIL_TO || "").trim();
    const mailFrom = (process.env.MAIL_FROM || "").trim();

    console.log("MAIL_MODE:", mode);
    console.log("MAIL_TO:", mailTo);
    console.log("MAIL_FROM:", mailFrom);

    const subjectOwner = `CraftLab Contact — ${name} (${email})`;
    const textOwner = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Brand/Project: ${brand || "-"}`,
      `Budget: ${budget || "-"}`,
      `Message:\n${message}`,
    ].join("\n");

    if (mode === "test") {
      console.log("✅ CONTACT FORM (TEST MODE):", { name, email, brand, budget, message });
      return res.json({ ok: true, mode: "test" });
    }

    if (!mailTo) return res.status(500).json({ ok: false, error: "MAIL_TO missing on server." });
    if (!mailFrom) return res.status(500).json({ ok: false, error: "MAIL_FROM missing on server." });

    // ---- ZEPTO MODE
    if (mode === "zepto") {
      // 1) email to you
      await sendViaZepto({
        to: mailTo,
        from: mailFrom,
        subject: subjectOwner,
        text: textOwner,
        replyTo: email,
      });

      // 2) auto-reply to user
      const subjectUser = "Thanks — I got your message (CraftLab Studio)";
      const textUser = `Hi ${name},

Thanks for reaching out — I received your message and I’ll reply within 24–48 hours.

— CraftLab Studio`;

      await sendViaZepto({
        to: email,
        from: mailFrom,
        subject: subjectUser,
        text: textUser,
      });

      return res.json({ ok: true });
    }

    // ---- SMTP MODE (local)
    if (mode === "smtp") {
      const transporter = await createTransporter();
      await transporter.verify();

      await transporter.sendMail({
        from: mailFrom,
        to: mailTo,
        replyTo: email,
        subject: subjectOwner,
        text: textOwner,
      });

      return res.json({ ok: true });
    }

    return res.status(500).json({ ok: false, error: "Invalid MAIL_MODE. Use test|zepto|smtp." });
  } catch (err) {
    console.error("❌ CONTACT ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Contact API running on port ${PORT}`);
  console.log(`✅ Health check: /health`);
});