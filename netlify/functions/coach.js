export default async (req) => {
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
    const conversation = Array.isArray(body.conversation)
      ? body.conversation
      : [];

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Get secrets from Netlify
    const apiKey = Netlify.env.get("OPENAI_API_KEY");
    const model = Netlify.env.get("OPENAI_MODEL") || "gpt-5";

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY is not configured in Netlify."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

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

    const systemPrompt = `
You are Kibreab AI, a personal conversation coach.

Help the user communicate confidently and naturally,
especially in dating and social conversations.

Be:
- Confident without being arrogant
- Charming and natural
- Playful when appropriate
- Concise
- Genuine

Never encourage:
- Harassment
- Stalking
- Coercion
- Threats
- Manipulation
- Pressure after someone says no
- Deception about important facts
- Pressure for sexual content

Respect boundaries and consent.

Preferred style:
${selectedStyle}

Give the best reply first.

Usually give a short message the user can actually send.
Do not put quotation marks around the reply.
Do not sound like a robot.
`;

    // Only use safe conversation history
    const history = conversation
      .filter(
        item =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
      )
      .slice(-20)
      .map(item => ({
        role: item.role,
        content: item.content
      }));

    const input = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history,
      {
        role: "user",
        content: message
      }
    ];

    // Send request to OpenAI
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
          input
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return new Response(
        JSON.stringify({
          error: "AI request failed",
          details:
            data?.error?.message ||
            "Unknown OpenAI error"
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    let reply = "";

    if (typeof data.output_text === "string") {
      reply = data.output_text.trim();
    }

    if (!reply && Array.isArray(data.output)) {
      reply = data.output
        .flatMap(item =>
          Array.isArray(item.content)
            ? item.content
            : []
        )
        .filter(
          item => item.type === "output_text"
        )
        .map(item => item.text)
        .join("\n")
        .trim();
    }

    if (!reply) {
      reply =
        "I couldn't generate a response. Please try again.";
    }

    return new Response(
      JSON.stringify({
        reply,
        style
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error(
      "Kibreab AI function error:",
      error
    );

    return new Response(
      JSON.stringify({
        error: "Something went wrong.",
        details:
          error?.message ||
          String(error)
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
