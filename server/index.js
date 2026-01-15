import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
const PORT = process.env.PORT || 5050;

// --------------------
// CORS
// --------------------
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);

app.use(express.json({ limit: "200kb" }));

app.get("/health", (_, res) => res.json({ ok: true }));

// --------------------
// Helpers
// --------------------
function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractEmail(from) {
  // 'CraftLab Studio <info@craftlab-studio.com>' -> info@craftlab-studio.com
  const match = String(from || "").match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return String(from || "").trim();
}

function extractName(from) {
  // 'CraftLab Studio <...>' -> CraftLab Studio
  const s = String(from || "");
  const idx = s.indexOf("<");
  if (idx > 0) return s.slice(0, idx).trim().replace(/^"|"$/g, "");
  return "";
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --------------------
// SMTP transporter (local/dev only)
// --------------------
async function createTransporter() {
  const mode = (process.env.MAIL_MODE || "test").toLowerCase();

  if (mode === "test") {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  if (mode === "smtp") {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("SMTP config missing. Fill SMTP_HOST/SMTP_USER/SMTP_PASS in env.");
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      logger: true,
      debug: true,
    });
  }

  return nodemailer.createTransport({ jsonTransport: true });
}

// --------------------
// ZeptoMail (recommended on Render)
// IMPORTANT: ZEPTO_URL must be .../v1.1/md/email (not /email)
// --------------------
async function sendViaZepto({ to, from, subject, text, replyTo }) {
  const url =
    process.env.ZEPTO_URL || "https://api.zeptomail.eu/v1.1/md/email";
  const token = process.env.ZEPTO_TOKEN;

  if (!token) throw new Error("ZEPTO_TOKEN missing on server.");
  if (!to) throw new Error("MAIL_TO missing on server.");
  if (!from) throw new Error("MAIL_FROM missing on server.");

  const fromEmail = extractEmail(from);
  const fromName = extractName(from) || "CraftLab Studio";

  const payload = {
    message: {
      subject,
      from_email: fromEmail,
      from_name: fromName,
      to: [{ email: to, name: to, type: "to" }],
      // send HTML (safe) so line breaks render properly
      html: `<pre style="font-family: ui-monospace, Menlo, monospace; white-space: pre-wrap;">${escapeHtml(
        text
      )}</pre>`,
    },
  };

  if (replyTo) payload.message.reply_to = replyTo;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await resp.text();

    if (!resp.ok) {
      console.error("ZEPTO RESP STATUS:", resp.status);
      console.error("ZEPTO RESP BODY:", bodyText);
      throw new Error(`ZeptoMail error ${resp.status}: ${bodyText || resp.statusText}`);
    }

    return { ok: true, raw: bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

// --------------------
// Route
// --------------------
app.post("/api/contact", async (req, res) => {
  console.log("➡️  /api/contact HIT", new Date().toISOString());
  console.log("BODY:", req.body);
  console.log("MAIL_MODE:", process.env.MAIL_MODE);
  console.log("MAIL_TO:", process.env.MAIL_TO);
  console.log("MAIL_FROM:", process.env.MAIL_FROM);
  console.log("ZEPTO_URL:", process.env.ZEPTO_URL);

  try {
    const { name, email, brand, budget, message, website, company } = req.body || {};

    // honeypot anti-bot
    if (website || company) return res.status(200).json({ ok: true });

    // validation
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
    const mailFrom =
      (process.env.MAIL_FROM || "").trim() ||
      `CraftLab Studio <${process.env.SMTP_USER || "no-reply@craftlab-studio.com"}>`;

    const subjectOwner = `CraftLab Contact — ${name} (${email})`;
    const textOwner = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Brand/Project: ${brand || "-"}`,
      `Budget: ${budget || "-"}`,
      `Message:\n${message}`,
    ].join("\n");

    // ---- TEST MODE
    if (mode === "test") {
      console.log("✅ CONTACT FORM (TEST MODE):", { name, email, brand, budget, message });
      return res.json({ ok: true, mode: "test" });
    }

    // ---- ZEPTO MODE
    if (mode === "zepto") {
      if (!mailTo) return res.status(500).json({ ok: false, error: "MAIL_TO missing on server." });
      if (!mailFrom) return res.status(500).json({ ok: false, error: "MAIL_FROM missing on server." });

      // 1) email to you
      const r1 = await sendViaZepto({
        to: mailTo,
        from: mailFrom,
        subject: subjectOwner,
        text: textOwner,
        replyTo: email,
      });
      console.log("✅ ZEPTO SENT (owner):", r1.raw);

      // 2) auto-reply to user
      const subjectUser = "Thanks — I got your message (CraftLab Studio)";
      const textUser = [
        `Hi ${name},`,
        ``,
        `Thanks for reaching out — I received your message and I’ll reply within 24–48 hours.`,
        ``,
        `— CraftLab Studio`,
      ].join("\n");

      const r2 = await sendViaZepto({
        to: email,
        from: mailFrom,
        subject: subjectUser,
        text: textUser,
      });
      console.log("✅ ZEPTO SENT (auto-reply):", r2.raw);

      return res.json({ ok: true });
    }

    // ---- SMTP MODE (local)
    if (!mailTo) return res.status(500).json({ ok: false, error: "MAIL_TO missing on server." });

    const transporter = await createTransporter();
    await transporter.verify();
    console.log("✅ SMTP verify OK");

    const info = await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: email,
      subject: subjectOwner,
      text: textOwner,
    });

    console.log("✅ SMTP MAIL SENT:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ CONTACT ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message || "Server error. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Contact API running on port ${PORT}`);
  console.log(`✅ Health check: /health`);
});