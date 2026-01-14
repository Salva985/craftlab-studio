import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- CORS ----------
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);

app.use(express.json({ limit: "200kb" }));

// ---------- HEALTH ----------
app.get("/health", (_, res) => res.json({ ok: true }));

// ---------- HELPERS ----------
function isEmail(value) {
  return typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createTransporter() {
  const mode = (process.env.MAIL_MODE || "test").toLowerCase();

  // TEST MODE (no emails sent)
  if (mode === "test") {
    console.log("📨 MAIL_MODE=test → JSON transport");
    return nodemailer.createTransport({ jsonTransport: true });
  }

  // SMTP MODE (production)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP config missing (SMTP_HOST / SMTP_USER / SMTP_PASS)");
  }

  console.log("📨 MAIL_MODE=smtp → SMTP transport");
  console.log("SMTP HOST:", process.env.SMTP_HOST);
  console.log("SMTP USER:", process.env.SMTP_USER);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ---------- CONTACT ----------
app.post("/api/contact", async (req, res) => {
  console.log("➡️  /api/contact HIT", new Date().toISOString());
  console.log("BODY:", req.body);
  console.log("MAIL_MODE:", process.env.MAIL_MODE);
  console.log("MAIL_TO:", process.env.MAIL_TO);

  try {
    const { name, email, brand, budget, message, website, company } = req.body || {};

    // Honeypot
    if (website || company) {
      return res.json({ ok: true });
    }

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ ok: false, error: "Invalid name" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (!message || message.trim().length < 10) {
      return res.status(400).json({ ok: false, error: "Message too short" });
    }

    const transporter = await createTransporter();

    const mailTo = process.env.MAIL_TO;
    if (!mailTo) {
      throw new Error("MAIL_TO not defined");
    }

    // ---------- ADMIN EMAIL ----------
    const adminMail = await transporter.sendMail({
      from: process.env.MAIL_FROM || `CraftLab Studio <${process.env.SMTP_USER}>`,
      to: mailTo,
      replyTo: email,
      subject: `CraftLab Contact — ${name}`,
      text: `
Name: ${name}
Email: ${email}
Brand: ${brand || "-"}
Budget: ${budget || "-"}
Message:
${message}
      `.trim(),
    });

    console.log("📤 ADMIN MAIL RESULT:", {
      messageId: adminMail.messageId,
      accepted: adminMail.accepted,
      rejected: adminMail.rejected,
      response: adminMail.response,
    });

    // ---------- AUTOREPLY ----------
    const autoReply = await transporter.sendMail({
      from: process.env.MAIL_FROM || `CraftLab Studio <${process.env.SMTP_USER}>`,
      to: email,
      subject: "✅ Message received — CraftLab Studio",
      text: `Hi ${name},

Thanks for reaching out!
I received your message and I’ll reply within 24–48 hours.

— CraftLab Studio`,
    });

    console.log("📨 AUTOREPLY RESULT:", {
      messageId: autoReply.messageId,
      accepted: autoReply.accepted,
      rejected: autoReply.rejected,
    });

    return res.json({
      ok: true,
      admin: {
        accepted: adminMail.accepted,
        rejected: adminMail.rejected,
        response: adminMail.response,
      },
      autoreply: {
        accepted: autoReply.accepted,
        rejected: autoReply.rejected,
      },
    });

  } catch (err) {
    console.error("❌ CONTACT ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Server error",
    });
  }
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`✅ Contact API running on port ${PORT}`);
  console.log(`✅ Health check: /health`);
});