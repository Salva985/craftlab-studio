import "dotenv/config";
import express from "express";
import cors from "cors";

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

function extractEmail(from) {
  const match = String(from || "").match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return String(from || "").trim();
}

function extractName(from) {
  const s = String(from || "");
  const idx = s.indexOf("<");
  if (idx > 0) return s.slice(0, idx).trim().replace(/^"|"$/g, "");
  return "";
}

async function sendViaZepto({ to, from, subject, text, replyTo }) {
  // ✅ Official ZeptoMail endpoint (don’t use api.zeptomail.eu)
  const url = "https://api.zeptomail.com/v1.1/email";

  const token = process.env.ZEPTO_TOKEN;
  const bounce = process.env.ZEPTO_BOUNCE_ADDRESS; // REQUIRED by Zepto
  if (!token) throw new Error("ZEPTO_TOKEN missing on server.");
  if (!bounce) throw new Error("ZEPTO_BOUNCE_ADDRESS missing on server.");
  if (!to) throw new Error("MAIL_TO missing on server.");
  if (!from) throw new Error("MAIL_FROM missing on server.");

  const fromEmail = extractEmail(from);
  const fromName = extractName(from) || "CraftLab Studio";

  const payload = {
    bounce_address: bounce,
    from: { address: fromEmail, name: fromName },
    to: [{ email_address: { address: to } }],
    subject,
    textbody: text,
  };

  // reply_to format for v1.1/email
  if (replyTo) payload.reply_to = [{ address: replyTo }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // ✅ Correct header format
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await resp.text();

    console.log("📩 ZEPTO STATUS:", resp.status, resp.statusText);
    console.log("📩 ZEPTO BODY:", bodyText);

    if (!resp.ok) {
      throw new Error(`ZeptoMail error ${resp.status}: ${bodyText || resp.statusText}`);
    }

    return { ok: true, raw: bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

app.post("/api/contact", async (req, res) => {
  console.log("➡️  /api/contact HIT", new Date().toISOString());
  console.log("BODY:", req.body);
  console.log("MAIL_MODE:", process.env.MAIL_MODE);

  try {
    const { name, email, brand, budget, message, website, company } = req.body || {};

    // honeypot
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

    const mailTo = process.env.MAIL_TO || "";
    const mailFrom =
      process.env.MAIL_FROM || "CraftLab Studio <info@craftlab-studio.com>";

    const subjectOwner = `CraftLab Contact — ${name} (${email})`;
    const textOwner = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Brand/Project: ${brand || "-"}`,
      `Budget: ${budget || "-"}`,
      `Message:\n${message}`,
    ].join("\n");

    // ---- TEST MODE (no email, just success)
    if (mode === "test") {
      console.log("✅ TEST MODE payload:", { name, email, brand, budget, message });
      return res.json({ ok: true, mode: "test" });
    }

    // ---- ZEPTO MODE
    if (mode === "zepto") {
      if (!mailTo) return res.status(500).json({ ok: false, error: "MAIL_TO missing on server." });
      if (!mailFrom) return res.status(500).json({ ok: false, error: "MAIL_FROM missing on server." });

      // 1) send to you
      await sendViaZepto({
        to: mailTo,
        from: mailFrom,
        subject: subjectOwner,
        text: textOwner,
        replyTo: email,
      });

      // 2) auto-reply to user
      const subjectUser = "Thanks — I got your message (CraftLab Studio)";
      const textUser = [
        `Hi ${name},`,
        ``,
        `Thanks for reaching out.`,
        `Your message has been received and I’ll get back to you within 24–48 hours.`,
        ``,
        `— CraftLab Studio`,
      ].join("\n");

      await sendViaZepto({
        to: email,
        from: mailFrom,
        subject: subjectUser,
        text: textUser,
      });

      return res.json({ ok: true });
    }

    return res.status(500).json({ ok: false, error: "MAIL_MODE must be 'test' or 'zepto'." });
  } catch (err) {
    console.error("❌ CONTACT ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Contact API running on port ${PORT}`);
  console.log(`✅ Health check: /health`);
});