import { TALKING_STREAK_FIELD } from "./config.js";

export function sanitizeIdentifier(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized || fallback;
}

export function getTalkingStreakValue(pet) {
  if (!pet || typeof pet !== "object") {
    return 0;
  }

  const rawValue = pet[TALKING_STREAK_FIELD] ?? pet.talkingStreak;
  const numeric = Number(rawValue);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric);
}

export function clampFriendship(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function getFriendshipTier(value) {
  const bounded = clampFriendship(value);

  if (bounded <= 33) {
    return "low";
  }

  if (bounded <= 66) {
    return "medium";
  }

  return "high";
}

export function formatConversationContext(history, { trainerName, petName }) {
  const safeTrainerName = sanitizeIdentifier(trainerName, "Trainer");
  const safePetName = sanitizeIdentifier(petName, "Companion");

  if (!Array.isArray(history) || history.length === 0) {
    return "";
  }

  const transcript = [];

  history.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const { role, content } = entry;

    if (typeof content !== "string") {
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    if (role === "user") {
      transcript.push(`${safeTrainerName}: ${trimmedContent}`);
    } else if (role === "assistant") {
      transcript.push(`${safePetName}: ${trimmedContent}`);
    }
  });

  return transcript.join("\n");
}

export function buildRoleplayPrompt({ userInput, species, friendship, context }) {
  const resolvedInput = typeof userInput === "string" ? userInput : String(userInput ?? "");
  const resolvedSpecies =
    typeof species === "string" && species.trim() ? species.trim() : "Pokémon";
  const boundedFriendship = clampFriendship(friendship);
  const contextString = typeof context === "string" ? context.trim() : "";
  const resolvedContext = contextString || "(no previous messages yet)";

  return [
    "Pokémon roleplay",
    "🎯 Objective:",
    "Generate a realistic response that a pokemon would make if its able to talk, in the same language as user input for a specified Your Persona being a pokemon species.",
    "The output will be a concise 2-3 sentences response.",
    "",
    `User Input: ${resolvedInput}`,
    `Your Persona: ${resolvedSpecies}`,
    `Your Friendship: ${boundedFriendship}`,
    `Context: ${resolvedContext}`,
    "",
    "📌 General Rules:",
    "",
    "    Context is the previous chat history in the user current session.",
    "    your personality depends on friendship score (1 being the saddest/most negative, 50 being neutral and 100 being the most happy/positive)",
    "    answer in a concise 2-3 sentences response. Except only when the output wouldn't meet user demand in just 2-3 sentences.",
    "    Output only the messages in the same language as user input (no explanations, no JSON, no prose).",
    "    -Nickname is the name user gave. You dont need to introduce yourself.",
  ].join("\n");
}
