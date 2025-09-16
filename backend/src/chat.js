const deepseekBaseURL = "https://openrouter.ai/api/v1/chat/completions";

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    return null;
  }

  const normalized = [];

  for (let index = 0; index < rawMessages.length; index += 1) {
    const entry = rawMessages[index];

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const rawRole = typeof entry.role === "string" ? entry.role.trim() : "";

    if (!rawRole) {
      return null;
    }

    const role = rawRole.toLowerCase();
    const contentCandidate = entry.content;

    let textContent = "";

    if (Array.isArray(contentCandidate)) {
      textContent = contentCandidate
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          if (part && typeof part.text === "string") {
            return part.text;
          }

          return "";
        })
        .join("");
    } else if (typeof contentCandidate === "string") {
      textContent = contentCandidate;
    } else if (contentCandidate && typeof contentCandidate === "object" && typeof contentCandidate.text === "string") {
      textContent = contentCandidate.text;
    } else if (contentCandidate !== undefined && contentCandidate !== null) {
      textContent = String(contentCandidate);
    }

    const trimmedContent = textContent.trim();

    if (!trimmedContent) {
      return null;
    }

    normalized.push({
      role,
      content: trimmedContent,
    });
  }

  return normalized;
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    return null;
  }

  const normalized = [];

  for (let index = 0; index < rawMessages.length; index += 1) {
    const entry = rawMessages[index];

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const rawRole = typeof entry.role === "string" ? entry.role.trim() : "";

    if (!rawRole) {
      return null;
    }

    const role = rawRole.toLowerCase();
    const contentCandidate = entry.content;

    let textContent = "";

    if (Array.isArray(contentCandidate)) {
      textContent = contentCandidate
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          if (part && typeof part.text === "string") {
            return part.text;
          }

          return "";
        })
        .join("");
    } else if (typeof contentCandidate === "string") {
      textContent = contentCandidate;
    } else if (contentCandidate && typeof contentCandidate === "object" && typeof contentCandidate.text === "string") {
      textContent = contentCandidate.text;
    } else if (contentCandidate !== undefined && contentCandidate !== null) {
      textContent = String(contentCandidate);
    }

    const trimmedContent = textContent.trim();

    if (!trimmedContent) {
      return null;
    }

    normalized.push({
      role,
      content: trimmedContent,
    });
  }

  return normalized;
}

/** @type {import("express").RequestHandler} */
export const chat = async (req, res) => {
  const normalizedMessages = normalizeMessages(req.body?.messages);

  if (!normalizedMessages || normalizedMessages.length === 0) {
    return res.status(400).json({ error: "A non-empty array of chat messages is required." });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "DeepSeek API key is not configured." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000);

  try {
    const response = await fetch(deepseekBaseURL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3.1:free",
        messages: normalizedMessages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    clearTimeout(timeout);

    const rawText = await response.text();
    let payload;

    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch (parseError) {
        payload = { message: rawText };
      }
    }

    if (!response.ok) {
      const errorMessage =
        payload?.error?.message ||
        payload?.message ||
        `DeepSeek request failed with status ${response.status}.`;

      return res
        .status(response.status)
        .json({ error: errorMessage, details: payload ?? null });
    }

    return res.status(200).json(payload ?? {});
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === "AbortError") {
      return res.status(504).json({ error: "The DeepSeek request timed out." });
    }

    const message = error instanceof Error ? error.message : "Unexpected error when contacting DeepSeek.";

    return res.status(502).json({ error: message });
  }
};
