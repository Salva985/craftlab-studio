import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: "200kb" }));

app.get("/health", (_, res) => res.json({ ok: true }));

function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function extractEmail(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return m ? m[1] : from;
}

function extractName(from) {
  const i = String(from || "").indexOf("<");
  return i > 0 ? from.slice(0, i).trim() : "CraftLab Studio";
}

async function sendViaZepto({ to, from, subject, text, replyTo }) {
  const url = process.env.ZEPTO_URL;
  const token = process.env.ZEPTO_TOKEN;

  if (!url) throw new Error("ZEPTO_URL missing");
  if (!token) throw new Error("ZEPTO_TOKEN missing");

  const payload = {
    from: {
      address: extractEmail(from),
      name: extractName(from),
    },
    to: [{ email_address: { address: to } }],
    subject,
    textbody: text,
  };

  if (replyTo) {
    payload.reply_to = [{ address: replyTo }];
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Zoho-enczapikey ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.text();

  if (!resp.ok) {
    console.error("ZEPTO STATUS:", resp.status);
    console.error("ZEPTO BODY:", body);
    throw new Error("Zepto send failed");
  }

  return body;
}

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, brand, budget, message } = req.body;

    if (!name || name.length < 2) return res.status(400).json({ ok: false });
    if (!isEmail(email)) return res.status(400).json({ ok: false });
    if (!message || message.length < 10) return res.status(400).json({ ok: false });

    const mailFrom = process.env.MAIL_FROM;
    const mailTo = process.env.MAIL_TO;

    const textOwner = `
Name: ${name}
Email: ${email}
Brand: ${brand}
Budget: ${budget}

Message:
${message}
`.trim();

    await sendViaZepto({
      to: mailTo,
      from: mailFrom,
      subject: `CraftLab Contact — ${name}`,
      text: textOwner,
      replyTo: email,
    });

    await sendViaZepto({
      to: email,
      from: mailFrom,
      subject: "Thanks — CraftLab Studio",
      text: `Hi ${name},\n\nI received your message and will reply shortly.\n\n— CraftLab Studio`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("CONTACT ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("API running on", PORT);
});