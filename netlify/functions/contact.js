export default async (req) => {
    // ---- CORS ----
    const origin = req.headers.get("origin") || "";
    const allowed = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : (allowed[0] || "*"),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
  
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  
    // ---- Helpers ----
    const isEmail = (v) =>
      typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  
    function parseFrom(from) {
      const m = String(from || "").match(/^(.*)<(.+)>$/);
      return {
        name: m ? m[1].trim().replace(/^"|"$/g, "") : "CraftLab Studio",
        email: m ? m[2].trim() : String(from || "").trim(),
      };
    }
  
    async function sendViaZepto({ to, subject, text, replyTo }) {
      const url = "https://api.zeptomail.eu/v1.1/email";
      const token = process.env.ZEPTO_TOKEN;
      const fromRaw = process.env.MAIL_FROM;
  
      if (!token) throw new Error("ZEPTO_TOKEN missing");
      if (!fromRaw) throw new Error("MAIL_FROM missing");
      if (!to) throw new Error("MAIL_TO missing / empty");
  
      const from = parseFrom(fromRaw);
  
      const payload = {
        from: { address: from.email, name: from.name },
        to: [{ email_address: { address: to } }],
        subject,
        textbody: text,
        ...(replyTo ? { reply_to: [{ address: replyTo }] } : {}),
      };
  
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
        throw new Error(`ZeptoMail failed ${resp.status}`);
      }
      return body;
    }
  
    try {
      const data = await req.json();
      const { name, email, brand, budget, message, website, company } = data || {};
  
      // honeypot
      if (website || company) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
  
      if (!name || String(name).trim().length < 2) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid name" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!isEmail(email)) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!message || String(message).trim().length < 10) {
        return new Response(JSON.stringify({ ok: false, error: "Message too short" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
  
      const mailTo = process.env.MAIL_TO;
  
      const ownerText = [
        `Name: ${name}`,
        `Email: ${email}`,
        `Project: ${brand || "-"}`,
        `Budget: ${budget || "-"}`,
        `Message:\n${message}`,
      ].join("\n");
  
      // 1) owner
      await sendViaZepto({
        to: mailTo,
        subject: `New contact — ${name}`,
        text: ownerText,
        replyTo: email,
      });
  
      // 2) autoreply EN+ES+IT
      const autoText = [
        `EN: Hi ${name},`,
        `Thanks for your message — I received it and I’ll reply within 24–48 hours.`,
        `— CraftLab Studio`,
        ``,
        `ES: Hola ${name},`,
        `Gracias por tu mensaje — lo he recibido y te responderé en 24–48 horas.`,
        `— CraftLab Studio`,
        ``,
        `IT: Ciao ${name},`,
        `Grazie per il tuo messaggio — l’ho ricevuto e ti risponderò entro 24–48 ore.`,
        `— CraftLab Studio`,
      ].join("r\n");
  
      await sendViaZepto({
        to: email,
        subject: "Thanks — CraftLab Studio",
        text: autoText,
      });
  
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("CONTACT ERROR:", err);
      return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  };