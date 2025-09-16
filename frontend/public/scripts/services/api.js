import {
  DEFAULT_BACKEND_URL,
  TALKING_STREAK_FIELD,
} from "../config.js";
import { getTalkingStreakValue, sanitizeIdentifier } from "../utils.js";

let backendUrlPromise;

function normalizeBaseUrl(url) {
  if (typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();

  if (!trimmed) {
    return null;
  }

  const withoutTrailingSlash = trimmed.replace(/\/$/, "");

  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `http://${withoutTrailingSlash}`;
}

function combineHostAndPort(host, port) {
  if (typeof host !== "string" || typeof port !== "string") {
    return null;
  }

  const sanitizedPort = port.trim();

  if (!sanitizedPort) {
    return null;
  }

  const normalizedHost = normalizeBaseUrl(host);

  if (!normalizedHost) {
    return null;
  }

  return `${normalizedHost.replace(/\/$/, "")}:${sanitizedPort}`;
}

export function resolveBackendURL() {
  if (!backendUrlPromise) {
    backendUrlPromise = import("../injected.js")
      .catch(() => ({}))
      .then((module) => {
        const candidates = [
          module.BACKEND_URL,
          module.API_BASE_URL,
          module.API_URL,
          module.SERVER_URL,
        ];

        for (const candidate of candidates) {
          const normalized = normalizeBaseUrl(candidate);

          if (normalized) {
            return normalized;
          }
        }

        if (typeof module.BACKEND_HOST === "string" && typeof module.BACKEND_PORT === "string") {
          const combined = combineHostAndPort(module.BACKEND_HOST, module.BACKEND_PORT);

          if (combined) {
            return combined;
          }
        }

        if (typeof module.BACKEND_PORT === "string") {
          const trimmedPort = module.BACKEND_PORT.trim();

          if (trimmedPort) {
            return `http://localhost:${trimmedPort}`;
          }
        }

        return DEFAULT_BACKEND_URL;
      });
  }

  return backendUrlPromise;
}

export async function requestChatCompletion(backendURL, messages) {
  const base = backendURL.replace(/\/$/, "");
  const response = await fetch(`${base}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const fallback = errorText || `Request failed with status ${response.status}`;
    throw new Error(fallback);
  }

  return response.json();
}

function createNetworkError(message, cause) {
  const fallbackMessage =
    typeof message === "string" && message.trim()
      ? message.trim()
      : "A network error occurred.";
  const error = new Error(fallbackMessage);

  error.status = 0;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

export function resolveErrorMessage(error, fallbackMessage, networkFallbackMessage = fallbackMessage) {
  const fallback =
    typeof fallbackMessage === "string" && fallbackMessage.trim()
      ? fallbackMessage.trim()
      : "Something went wrong.";
  const networkFallback =
    typeof networkFallbackMessage === "string" && networkFallbackMessage.trim()
      ? networkFallbackMessage.trim()
      : fallback;

  if (error instanceof Error) {
    if (Number(error.status) === 0) {
      return networkFallback;
    }

    const trimmed = typeof error.message === "string" ? error.message.trim() : "";

    if (trimmed) {
      return trimmed;
    }

    return fallback;
  }

  if (error && typeof error === "object") {
    if (Number(error.status) === 0) {
      return networkFallback;
    }

    const message = typeof error.message === "string" ? error.message.trim() : "";

    if (message) {
      return message;
    }
  }

  return fallback;
}

async function readResponseMessage(response, fallbackMessage = "") {
  const fallback = typeof fallbackMessage === "string" ? fallbackMessage : "";
  const rawText = await response.text().catch(() => "");
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(trimmedText);

    if (parsed && typeof parsed.message === "string") {
      const parsedMessage = parsed.message.trim();
      return parsedMessage || fallback;
    }
  } catch {
    // Ignore JSON parsing errors and fall back to the raw text.
  }

  return trimmedText;
}

export function normalizeUserRecord(rawUser) {
  if (!rawUser || typeof rawUser !== "object") {
    throw new Error("User record is missing or malformed.");
  }

  const resolvedId = sanitizeIdentifier(rawUser._id ?? rawUser.id ?? rawUser.name, "Player");
  const rawPets = Array.isArray(rawUser.pets) ? rawUser.pets : [];

  const pets = rawPets
    .filter((pet) => pet && typeof pet === "object")
    .map((pet) => {
      const normalizedName = sanitizeIdentifier(pet.name, "");

      if (!normalizedName) {
        return null;
      }

      const stageNumber = Number(pet.stage);
      const friendshipNumber = Number(pet.friendship);
      const talkingStreak = getTalkingStreakValue(pet);

      let lastChatted = null;
      const rawLastChatted = pet.lastChatted;

      if (rawLastChatted instanceof Date) {
        lastChatted = rawLastChatted.toISOString();
      } else if (typeof rawLastChatted === "string") {
        const trimmed = rawLastChatted.trim();

        if (trimmed) {
          const parsed = new Date(trimmed);
          lastChatted = Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
        }
      } else if (rawLastChatted !== undefined && rawLastChatted !== null) {
        const parsed = new Date(rawLastChatted);

        if (!Number.isNaN(parsed.getTime())) {
          lastChatted = parsed.toISOString();
        }
      }

      return {
        ...pet,
        name: normalizedName,
        stage: Number.isFinite(stageNumber) ? stageNumber : undefined,
        friendship: Number.isFinite(friendshipNumber) ? friendshipNumber : 0,
        lastChatted: lastChatted ?? null,
        [TALKING_STREAK_FIELD]: talkingStreak,
      };
    })
    .filter(Boolean);

  return {
    ...rawUser,
    id: resolvedId,
    pets,
  };
}

export async function fetchUserRecord(backendURL, username) {
  const base = backendURL.replace(/\/$/, "");
  const encoded = encodeURIComponent(username);
  let response;

  try {
    response = await fetch(`${base}/users/${encoded}`, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (networkError) {
    throw createNetworkError(
      "Unable to reach the trainer service. Please check your connection and try again.",
      networkError,
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const fallbackMessage = `Failed to load trainer (status ${response.status}).`;
    const message = await readResponseMessage(response, fallbackMessage);
    const error = new Error(message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json().catch(() => null);

  if (!payload) {
    return null;
  }

  try {
    return normalizeUserRecord(payload);
  } catch (error) {
    if (error instanceof Error) {
      if (typeof error.status !== "number") {
        error.status = 500;
      }

      throw error;
    }

    const normalizationError = new Error("Trainer data returned by the server is invalid.");
    normalizationError.status = 500;
    normalizationError.cause = error;
    throw normalizationError;
  }
}

export async function createUserRecord(backendURL, username, petName) {
  const base = backendURL.replace(/\/$/, "");
  const trainerId = sanitizeIdentifier(username);
  const companionName = sanitizeIdentifier(petName);

  let response;

  try {
    response = await fetch(`${base}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ name: trainerId, petName: companionName }),
    });
  } catch (networkError) {
    throw createNetworkError(
      "Unable to reach the trainer service to save your Pokémon. Please check your connection and try again.",
      networkError,
    );
  }

  if (response.status === 409) {
    const existing = await response.json().catch(() => null);
    const error = new Error(`Trainer "${trainerId}" already exists.`);
    error.status = 409;
    error.payload = existing;
    throw error;
  }

  if (!response.ok) {
    const fallbackMessage = `Failed to create trainer (status ${response.status}).`;
    const message = await readResponseMessage(response, fallbackMessage);
    const error = new Error(message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  const created = await response.json().catch(() => null);

  if (!created) {
    return null;
  }

  try {
    return normalizeUserRecord(created);
  } catch (error) {
    if (error instanceof Error) {
      if (typeof error.status !== "number") {
        error.status = 500;
      }

      throw error;
    }

    const normalizationError = new Error("Trainer data returned by the server is invalid.");
    normalizationError.status = 500;
    normalizationError.cause = error;
    throw normalizationError;
  }
}

export async function updateTrainerPet(backendURL, username, petId, petPayload) {
  const base = backendURL.replace(/\/$/, "");
  const trainerId = sanitizeIdentifier(username);
  const normalizedPetId = sanitizeIdentifier(petId);

  if (!trainerId || !normalizedPetId) {
    throw new Error("A trainer and pet identifier are required to update a Pokémon.");
  }

  let response;

  try {
    response = await fetch(
      `${base}/users/${encodeURIComponent(trainerId)}/pets/${encodeURIComponent(normalizedPetId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(petPayload ?? {}),
      },
    );
  } catch (networkError) {
    throw createNetworkError(
      "Unable to update your Pokémon. Please check your connection and try again.",
      networkError,
    );
  }

  if (!response.ok) {
    const fallbackMessage = `Failed to update the Pokémon (status ${response.status}).`;
    const message = await readResponseMessage(response, fallbackMessage);
    const error = new Error(message || fallbackMessage);
    error.status = response.status;
    throw error;
  }
}

export async function deleteTrainerPet(backendURL, username, petId) {
  const base = backendURL.replace(/\/$/, "");
  const trainerId = sanitizeIdentifier(username);
  const normalizedPetId = sanitizeIdentifier(petId);

  if (!trainerId || !normalizedPetId) {
    throw new Error("A trainer and pet identifier are required to delete a Pokémon.");
  }

  let response;

  try {
    response = await fetch(
      `${base}/users/${encodeURIComponent(trainerId)}/pets/${encodeURIComponent(normalizedPetId)}`,
      {
        method: "DELETE",
      },
    );
  } catch (networkError) {
    throw createNetworkError(
      "Unable to remove your Pokémon. Please check your connection and try again.",
      networkError,
    );
  }

  if (!response.ok && response.status !== 204) {
    const fallbackMessage = `Failed to remove the Pokémon (status ${response.status}).`;
    const message = await readResponseMessage(response, fallbackMessage);
    const error = new Error(message || fallbackMessage);
    error.status = response.status;
    throw error;
  }
}

export async function createTrainerPet(backendURL, username, petName) {
  const base = backendURL.replace(/\/$/, "");
  const trainerId = sanitizeIdentifier(username);
  const companionName = sanitizeIdentifier(petName);

  if (!trainerId) {
    throw new Error("A trainer identifier is required to create a Pokémon.");
  }

  if (!companionName) {
    throw new Error("A Pokémon name is required to create the record.");
  }

  const petPayload = {
    name: companionName,
    stage: 1,
    friendship: 50,
    lastChatted: new Date().toISOString(),
    [TALKING_STREAK_FIELD]: 0,
  };

  let response;

  try {
    response = await fetch(`${base}/users/${encodeURIComponent(trainerId)}/pets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(petPayload),
    });
  } catch (networkError) {
    throw createNetworkError(
      "We couldn't reach the server to create your Pokémon. Please check your connection and try again.",
      networkError,
    );
  }

  if (!response.ok) {
    const fallbackMessage = `Failed to create the Pokémon (status ${response.status}).`;
    const message = await readResponseMessage(response, fallbackMessage);
    const error = new Error(message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  await response.json().catch(() => null);
}
