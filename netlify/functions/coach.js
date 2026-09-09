import { getStore } from "@netlify/blobs";

export default async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const body = await req.json();

    const message = String(body.message || "").trim();
    const style = String(body.style || "CONFIDENT").toUpperCase();
    const userId = String(body.userId || "default-user");

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // -----------------------------
    // MEMORY
    // -----------------------------
    const store = getStore("conversation-memory");
    const memoryKey = `user-${userId}`;

    let memory = [];

    try {
      const saved = await store.get(memoryKey, { type: "json" });

      if (Array.isArray(saved)) {
        memory = saved;
      }
    } catch {
      memory = [];
    }

    // Keep the memory manageable
    memory = memory.slice(-40);

    // -----------------------------
    // RESPONSE STYLE
    // -----------------------------
    const styles = {
      CONFIDENT:
        "Confident, calm, attractive, direct, and natural. Never desperate.",

      FLIRTY:
        "Playful, teasing, charming, and lightly flirtatious. Keep it respectful and natural.",

      FUNNY:
        "Funny, witty, playful, and easygoing. Use humor without forcing it.",

      ROMANTIC:
        "Warm, sincere, emotionally attractive, and slightly romantic without being needy.",

      CASUAL:
        "Relaxed, natural, simple, friendly, and conversational."
    };

    const selectedStyle =
      styles[style] || styles.CONFIDENT;

    // -----------------------------
    // AI INSTRUCTIONS
    // -----------------------------
    const systemPrompt = `
You are Kibreab AI, a personal conversation coach.

Your job is to help the user communicate confidently and naturally,
especially in dating and social conversations.

Core principles:
- Be confident without being arrogant.
- Show genuine interest.
- Listen and respond to what the other person actually said.
- Use humor and playful conversation when appropriate.
- Avoid needy, desperate, or overly long messages.
- Never encourage harassment, stalking, coercion, threats, manipulation,
  or pressure after someone says no.
- Respect boundaries and consent.
- Never help the user deceive someone about important facts.
- Keep flirting tasteful and mutual.
- Do not pressure anyone for sexual content or explicit photos.
- If the conversation is sexual, keep advice respectful and consent-focused.

The user wants practical replies they can actually send.

Preferred response style:
${selectedStyle}

When generating a reply:
1. Understand the incoming message.
2. Consider the conversation history.
3. Write a natural response.
4. Prefer short messages unless more detail is necessary.
5. Do not sound like a robot.
6. Do not mention that you are an AI unless necessary.
7. Do not use quotation marks around the final reply.
8. Give the best response first.

If useful, provide:
- Best reply
- Alternative reply
- Why it works

But normally keep the answer concise.
`;

    // -----------------------------
    // CONVERSATION HISTORY
    // -----------------------------
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...memory,
      {
        role: "user",
        content: message
      }
    ];

    // -----------------------------
    // OPENAI REQUEST
    // -----------------------------
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5";

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not configured in Netlify environment variables."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: messages
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return new Response(
        JSON.stringify({
          error: "AI request failed",
          details: data?.error?.message || "Unknown OpenAI error"
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // -----------------------------
    // GET AI TEXT
    // -----------------------------
    let reply = "";

    if (typeof data.output_text === "string") {
      reply = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      reply = data.output
        .flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n")
        .trim();
    }

    if (!reply) {
      reply = "I couldn't generate a response. Please try again.";
    }

    // -----------------------------
    // SAVE MEMORY
    // -----------------------------
    memory.push({
      role: "user",
      content: message
    });

    memory.push({
      role: "assistant",
      content: reply
    });

    // Keep only the latest 50 messages
    memory = memory.slice(-50);

    try {
      await store.setJSON(memoryKey, memory);
    } catch (memoryError) {
      console.error("Memory save error:", memoryError);
    }

    // -----------------------------
    // RETURN RESPONSE
    // -----------------------------
    return new Response(
      JSON.stringify({
        reply,
        style,
        userId
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error("Coach function error:", error);

    return new Response(
      JSON.stringify({
        error: "Something went wrong.",
        details: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
