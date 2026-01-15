import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

const PORT = process.env.PORT || 5050;

// ---- CORS
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

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---- SMTP transporter (local/dev only, NOT reliable on Render)
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
      // timeouts help you fail fast instead of hanging forever
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      logger: true,
      debug: true,
    });
  }

  return nodemailer.createTransport({ jsonTransport: true });
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

async function sendViaZepto({ to, from, subject, text, replyTo }) {
  const url = process.env.ZEPTO_URL || "https://api.zeptomail.eu/v1.1/pm/email";
  const token = process.env.ZEPTO_TOKEN;

  if (!token) throw new Error("ZEPTO_TOKEN missing on server.");
  if (!to) throw new Error("MAIL_TO missing on server.");

  const payload = {
    from: { address: extractEmail(from), name: extractName(from) || "CraftLab Studio" },
    to: [{ email_address: { address: to } }],
    subject,
    textbody: text,
  };

  if (replyTo) payload.reply_to = [{ address: replyTo }]

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

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
      // this will finally show the real Zepto error message in Render logs
      throw new Error(`ZeptoMail error ${resp.status}: ${bodyText || resp.statusText}`);
    }

    return { ok: true, raw: bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractEmail(from) {
  // "CraftLab Studio <info@craftlab-studio.com>" -> info@craftlab-studio.com
  const match = String(from || "").match(/<([^>]+)>/);
  if (match?.[1]) return match[1];
  return String(from || "").trim();
}

app.post("/api/contact", async (req, res) => {
  console.log("➡️  /api/contact HIT", new Date().toISOString());
  console.log("BODY:", req.body);
  console.log("MAIL_MODE:", process.env.MAIL_MODE);
  console.log("MAIL_TO:", process.env.MAIL_TO);

  console.log("MAIL_FROM env raw:", JSON.stringify(process.env.MAIL_FROM));
  console.log("MAIL_FROM env len:", (process.env.MAIL_FROM || "").length);

  try {
    const { name, email, brand, budget, message, website, company } = req.body || {};

    // honeypot anti-bot
    if (website || company) {
      return res.status(200).json({ ok: true });
    }

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
    const mailTo = process.env.MAIL_TO || "";
    const mailFrom = process.env.MAIL_FROM || `CraftLab Studio <${process.env.SMTP_USER || "no-reply@craftlab-studio.com"}>`;

    console.log("mailFrom computed:", JSON.stringify(mailFrom));
    console.log("mailFrom len:", (mailFrom || "").length);

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

    // ---- ZEPTO MODE (recommended on Render)
    if (mode === "zepto") {
      const mailTo = process.env.MAIL_TO;
      if (!mailTo) return res.status(500).json({ ok: false, error: "MAIL_TO missing on server." });
    
      const fromEmail = "info@craftlab-studio.com";
    
      // 1) email para ti (owner)
      const r1 = await sendViaZepto({
        to: mailTo,
        fromEmail,
        subject: subjectOwner,
        text: textOwner,
        replyTo: email,
      });
      console.log("✅ ZEPTO SENT (owner):", r1);
    
      // 2) autoreply para el usuario
      const subjectUser = "Thanks — I got your message (CraftLab Studio)";
      const textUser = `Hi ${name},\n\nThanks for reaching out — I received your message and I’ll reply within 24–48 hours.\n\n— CraftLab Studio`;
    
      const r2 = await sendViaZepto({
        to: email,
        fromEmail,
        subject: subjectUser,
        text: textUser,
      });
      console.log("✅ ZEPTO SENT (auto-reply):", r2);
    
      return res.json({ ok: true });
    }

    // ---- SMTP MODE (works locally; Render likely times out)
    if (!mailTo) {
      return res.status(500).json({ ok: false, error: "MAIL_TO missing on server." });
    }

    const transporter = await createTransporter();

    // verify (good for local debug)
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
    return res.status(500).json({ ok: false, error: "Server error. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Contact API running on port ${PORT}`);
  console.log(`✅ Health check: /health`);
});