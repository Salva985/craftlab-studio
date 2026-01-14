import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

const PORT = process.env.PORT || 5050;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CORS
app.use(
  cors({
    origin: (origin, cb) => {
      // allow tools like curl/postman (no origin)
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

async function createTransporter() {
  const mode = (process.env.MAIL_MODE || "test").toLowerCase();

  // TEST: no external network, no real email — just returns the email as JSON
  if (mode === "test") {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  // SMTP: real email sending
  if (mode === "smtp") {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      throw new Error(
        "SMTP config missing. Fill SMTP_HOST/SMTP_USER/SMTP_PASS in .env"
      );
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  return nodemailer.createTransport({ jsonTransport: true });
}

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, brand, budget, message, website, company } =
      req.body || {};

    // Honeypot (bots fill hidden fields)
    if (website || company) {
      return res.status(200).json({ ok: true }); // pretend success
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res
        .status(400)
        .json({ ok: false, error: "Please enter your name." });
    }
    if (!isEmail(email)) {
      return res
        .status(400)
        .json({ ok: false, error: "Please enter a valid email." });
    }
    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return res
        .status(400)
        .json({ ok: false, error: "Message must be at least 10 characters." });
    }

    const transporter = await createTransporter();

    const mode = (process.env.MAIL_MODE || "test").toLowerCase();
    const mailTo =
      mode === "smtp" ? process.env.MAIL_TO || "" : "test@ethereal.email";

    const subject = `CraftLab Contact — ${name} (${email})`;
    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Brand/Project: ${brand || "-"}`,
      `Budget: ${budget || "-"}`,
      `Message:\n${message}`,
    ].join("\n");

    const info = await transporter.sendMail({
      from:
        process.env.MAIL_FROM ||
        "CraftLab Studio <no-reply@craftlab-studio.com>",
      to: mailTo,
      replyTo: email,
      subject,
      text,
    });

    const modeNow = (process.env.MAIL_MODE || "test").toLowerCase();

    let preview = null;
    if (modeNow === "test") {
      // jsonTransport puts the email content here
      preview = info.message;
    }

    return res.json({ ok: true, preview });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ ok: false, error: "Server error. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Contact API running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});
