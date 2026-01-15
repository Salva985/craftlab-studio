import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5050;

// ---------- CORS ----------
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"));
  }
}));

app.use(express.json({ limit: "200kb" }));

app.get("/health", (_, res) => res.json({ ok: true }));

// ---------- helpers ----------
const isEmail = (v) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function parseFrom(from) {
  const m = from.match(/^(.*)<(.+)>$/);
  return {
    name: m ? m[1].trim() : "CraftLab Studio",
    email: m ? m[2].trim() : from.trim()
  };
}

// ---------- ZEPTO SEND ----------
async function sendViaZepto({ to, subject, text, replyTo }) {
  const url = "https://api.zeptomail.eu/v1.1/email";
  const token = process.env.ZEPTO_TOKEN;
  const fromRaw = process.env.MAIL_FROM;

  if (!token) throw new Error("ZEPTO_TOKEN missing");
  if (!fromRaw) throw new Error("MAIL_FROM missing");

  const from = parseFrom(fromRaw);

  const payload = {
    from: {
      address: from.email,
      name: from.name
    },
    to: [
      { email_address: { address: to } }
    ],
    subject,
    textbody: text,
    ...(replyTo && { reply_to: [{ address: replyTo }] })
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Zoho-enczapikey ${token}`
    },
    body: JSON.stringify(payload)
  });

  const body = await res.text();

  if (!res.ok) {
    console.error("ZEPTO STATUS:", res.status);
    console.error("ZEPTO BODY:", body);
    throw new Error("ZeptoMail failed");
  }

  return body;
}

// ---------- CONTACT ----------
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, brand, budget, message, website, company } = req.body;

    if (website || company) return res.json({ ok: true });

    if (!name || name.length < 2) {
      return res.status(400).json({ ok: false, error: "Invalid name" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ ok: false, error: "Message too short" });
    }

    const ownerText = `
Name: ${name}
Email: ${email}
Project: ${brand || "-"}
Budget: ${budget || "-"}
Message:
${message}
`;

    // owner mail
    await sendViaZepto({
      to: process.env.MAIL_TO,
      subject: `New contact — ${name}`,
      text: ownerText,
      replyTo: email
    });

    // autoreply
    await sendViaZepto({
      to: email,
      subject: "Thanks — CraftLab Studio",
      text: `Hi ${name},\n\nThanks for your message. I’ll reply within 24–48h.\n\n— CraftLab Studio`
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("CONTACT ERROR:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API running on ${PORT}`);
});