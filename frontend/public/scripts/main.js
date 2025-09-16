const DEFAULT_BACKEND_URL = "http://localhost:3000";

const displayMessages = [];
const conversationHistory = [];

const TALKING_STREAK_FIELD = "talking-streak";
const USERNAME_STORAGE_KEY = "poke-pet.username";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STAGE_DETAILS = {
  1: { species: "Pichu", image: "images/pichu.png" },
  2: { species: "Pikachu", image: "images/pikachu.png" },
  3: { species: "Raichu", image: "images/raichu.png" },
};

const DEFAULT_STAGE_DETAIL = {
  species: "Companion",
  image: "images/pikachu.png",
};

function createElement(tag, options = {}) {
  const {
    className,
    textContent,
    attributes = {},
    children = [],
  } = options;

  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, value);
    }
  });

  children.forEach((child) => {
    if (child === null || child === undefined) {
      return;
    }

    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

function createMessageElement({ sender, message }) {
  const safeSender = typeof sender === "string" ? sender : String(sender ?? "");
  const safeMessage = typeof message === "string" ? message : String(message ?? "");

  const messageElement = createElement("div", { className: "message" });
  const senderElement = createElement("strong", {
    textContent: `${safeSender}:`,
  });

  messageElement.appendChild(senderElement);
  messageElement.appendChild(document.createTextNode(` ${safeMessage}`));

  return messageElement;
}

function renderMessages(chatBox) {
  chatBox.innerHTML = "";
  displayMessages.forEach((message) => {
    chatBox.appendChild(createMessageElement(message));
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendMessage(message, chatBox) {
  const normalizedMessage = {
    sender: typeof message.sender === "string" ? message.sender : String(message.sender ?? ""),
    message:
      typeof message.message === "string" ? message.message : String(message.message ?? ""),
  };

  displayMessages.push(normalizedMessage);
  chatBox.appendChild(createMessageElement(normalizedMessage));
  chatBox.scrollTop = chatBox.scrollHeight;
}

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

let backendUrlPromise;

function resolveBackendURL() {
  if (!backendUrlPromise) {
    backendUrlPromise = import("./injected.js")
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

async function requestChatCompletion(backendURL, messages) {
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

function extractAssistantMessage(response) {
  if (!response) {
    return null;
  }

  const choices = Array.isArray(response.choices) ? response.choices : [];
  const choiceMessage = choices.length > 0 ? choices[0]?.message : undefined;

  let content = choiceMessage?.content;

  if (!content && typeof response.output_text === "string") {
    content = response.output_text;
  }

  if (Array.isArray(content)) {
    const combined = content
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

    return combined.trim() || null;
  }

  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed ? trimmed : null;
  }

  return null;
}


function sanitizeIdentifier(value, fallback = "") {
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


function loadCachedUsername() {
  if (typeof localStorage === "undefined") {
    return "";
  }

  try {
    const rawValue = localStorage.getItem(USERNAME_STORAGE_KEY);
    return sanitizeIdentifier(rawValue, "");
  } catch (error) {
    console.warn("Failed to load cached username:", error);
    return "";
  }
}

function storeCachedUsername(username) {
  if (typeof localStorage === "undefined") {
    return;
  }

  const sanitized = sanitizeIdentifier(username, "");

  try {
    if (sanitized) {
      localStorage.setItem(USERNAME_STORAGE_KEY, sanitized);
    } else {
      localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to store cached username:", error);
  }
}

function clearCachedUsername() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(USERNAME_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear cached username:", error);
  }
}

function getTalkingStreakValue(pet) {
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

function createNetworkError(message, cause) {
  const fallbackMessage = typeof message === "string" && message.trim()
    ? message.trim()
    : "A network error occurred.";
  const error = new Error(fallbackMessage);

  error.status = 0;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function resolveErrorMessage(error, fallbackMessage, networkFallbackMessage = fallbackMessage) {
  const fallback = typeof fallbackMessage === "string" && fallbackMessage.trim()
    ? fallbackMessage.trim()
    : "Something went wrong.";
  const networkFallback = typeof networkFallbackMessage === "string" && networkFallbackMessage.trim()
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

function normalizeUserRecord(rawUser) {
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

function formatConversationContext(history, { trainerName, petName }) {
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

function buildRoleplayPrompt({ userInput, species, friendship, context }) {
  const resolvedInput = typeof userInput === "string" ? userInput : String(userInput ?? "");
  const resolvedSpecies = typeof species === "string" && species.trim()
    ? species.trim()
    : "Pokémon";
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

async function fetchUserRecord(backendURL, username) {
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

async function createUserRecord(backendURL, username, petName) {
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

async function updateTrainerPet(backendURL, username, petId, petPayload) {
  const base = backendURL.replace(/\/$/, "");
  const trainerId = sanitizeIdentifier(username);
  const normalizedPetId = sanitizeIdentifier(petId);

  if (!trainerId || !normalizedPetId) {
    throw new Error("A trainer and pet identifier are required to update a Pokémon.");
  }

  let response;

  try {
    response = await fetch(`${base}/users/${encodeURIComponent(trainerId)}/pets/${encodeURIComponent(normalizedPetId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(petPayload ?? {}),
    });
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

async function deleteTrainerPet(backendURL, username, petId) {
  const base = backendURL.replace(/\/$/, "");
  const trainerId = sanitizeIdentifier(username);
  const normalizedPetId = sanitizeIdentifier(petId);

  if (!trainerId || !normalizedPetId) {
    throw new Error("A trainer and pet identifier are required to delete a Pokémon.");
  }

  let response;

  try {
    response = await fetch(`${base}/users/${encodeURIComponent(trainerId)}/pets/${encodeURIComponent(normalizedPetId)}`, {
      method: "DELETE",
    });
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

async function createTrainerPet(backendURL, username, petName) {
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

function renderInputPrompt(appRoot, options) {
  const {
    lead,
    title,
    description,
    placeholder = "Value",
    initialValue = "",
    errorMessage = "",
    submitLabel = "→",
    submitAriaLabel = "Submit",
  } = options ?? {};

  return new Promise((resolve) => {
    appRoot.innerHTML = "";

    const container = createElement("div", { className: "prompt-container" });
    const card = createElement("div", { className: "prompt-card" });

    if (lead) {
      card.appendChild(createElement("p", { className: "prompt-lead", textContent: lead }));
    }

    if (title) {
      card.appendChild(createElement("h1", { className: "prompt-title", textContent: title }));
    }

    if (description) {
      card.appendChild(createElement("p", { className: "prompt-description", textContent: description }));
    }

    const form = createElement("form", { className: "prompt-form" });
    const inputWrapper = createElement("div", { className: "prompt-input-wrapper" });

    const input = createElement("input", {
      className: "prompt-input",
      attributes: {
        type: "text",
        placeholder,
        autocomplete: "off",
      },
    });

    if (initialValue) {
      input.value = initialValue;
    }

    const clearButton = createElement("button", {
      className: "prompt-clear-button",
      textContent: "×",
      attributes: {
        type: "button",
        "aria-label": "Clear input",
      },
    });

    const submitButton = createElement("button", {
      className: "prompt-submit-button",
      textContent: submitLabel,
      attributes: {
        type: "submit",
        "aria-label": submitAriaLabel,
      },
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(clearButton);
    inputWrapper.appendChild(submitButton);

    const errorElement = createElement("div", {
      className: `prompt-error${errorMessage ? "" : " is-hidden"}`,
      textContent: errorMessage,
      attributes: { role: "alert" },
    });

    form.appendChild(inputWrapper);
    form.appendChild(errorElement);

    card.appendChild(form);
    container.appendChild(card);
    appRoot.appendChild(container);

    function showError(message) {
      if (message) {
        errorElement.textContent = message;
        errorElement.classList.remove("is-hidden");
      } else {
        errorElement.textContent = "";
        errorElement.classList.add("is-hidden");
      }
    }

    function updateClearButtonState() {
      const hasValue = input.value.length > 0;
      clearButton.disabled = !hasValue;
    }

    clearButton.addEventListener("click", () => {
      input.value = "";
      updateClearButtonState();
      showError("");
      input.focus();
    });

    input.addEventListener("input", () => {
      updateClearButtonState();
      if (!errorElement.classList.contains("is-hidden")) {
        showError("");
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const trimmedValue = input.value.trim();

      if (!trimmedValue) {
        showError("Please enter a value.");
        return;
      }

      input.disabled = true;
      clearButton.disabled = true;
      submitButton.disabled = true;

      resolve(trimmedValue);
    });

    updateClearButtonState();
    input.focus();
  });
}

function promptForUsername(appRoot, { initialValue = "", errorMessage = "" } = {}) {
  return renderInputPrompt(appRoot, {
    title: "Enter username",
    placeholder: "Value",
    initialValue,
    errorMessage,
    submitLabel: "→",
    submitAriaLabel: "Confirm username",
  });
}

function promptForPetName(appRoot, { initialValue = "", errorMessage = "" } = {}) {
  return renderInputPrompt(appRoot, {
    lead: "Looks like you currently don't own a Pokémon.",
    title: "Enter your new pokemon name",
    placeholder: "Value",
    initialValue,
    errorMessage,
    submitLabel: "→",
    submitAriaLabel: "Confirm Pokémon name",
  });
}

function showRunAwayPrompt(appRoot, petName) {
  const safeName = sanitizeIdentifier(petName, "Your companion");

  return new Promise((resolve) => {
    appRoot.innerHTML = "";

    const container = createElement("div", { className: "prompt-overlay" });
    const card = createElement("div", { className: "prompt-card" });

    const title = createElement("div", {
      className: "prompt-title",
      textContent: `${safeName} has ran away.`,
    });

    const button = createElement("button", {
      className: "prompt-submit-button",
      textContent: "Ok..",
      attributes: {
        type: "button",
        "aria-label": "Acknowledge run away notice",
      },
    });

    const buttonWrapper = createElement("div", {
      className: "prompt-input-wrapper",
      children: [button],
    });

    card.appendChild(title);
    card.appendChild(buttonWrapper);
    container.appendChild(card);
    appRoot.appendChild(container);

    button.addEventListener("click", () => {
      button.disabled = true;

      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      resolve();
    });

    button.focus();
  });
}

async function promptForExistingTrainerPet(appRoot, backendURL, username) {
  let petName = "";
  let errorMessage = "";

  while (true) {
    petName = await promptForPetName(appRoot, { initialValue: petName, errorMessage });
    errorMessage = "";

    try {
      await createTrainerPet(backendURL, username, petName);
    } catch (error) {
      errorMessage = resolveErrorMessage(
        error,
        "Unable to create your Pokémon. Please try again.",
        "We couldn't reach the server to create your Pokémon. Please check your connection and try again.",
      );
      continue;
    }

    try {
      const refreshedUser = await fetchUserRecord(backendURL, username);

      if (refreshedUser) {
        return refreshedUser;
      }

      errorMessage = "We couldn't load your trainer. Please try again.";
    } catch (fetchError) {
      errorMessage = resolveErrorMessage(
        fetchError,
        "We couldn't load your trainer. Please try again.",
        "We couldn't load your trainer due to a network issue. Please check your connection and try again.",
      );
    }
  }
}

async function handleUserCreation(appRoot, backendURL, username) {
  let petName = "";
  let errorMessage = "";

  // Loop until creation succeeds so the user can retry when validation fails.
  while (true) {
    petName = await promptForPetName(appRoot, { initialValue: petName, errorMessage });
    errorMessage = "";

    try {
      const createdUser = await createUserRecord(backendURL, username, petName);

      if (createdUser) {
        return createdUser;
      }
    } catch (error) {
      if (error && error.status === 409) {
        if (error.payload) {
          try {
            return normalizeUserRecord(error.payload);
          } catch (normalizeError) {
            console.error("Failed to normalize existing trainer:", normalizeError);
          }
        }

        try {
          const existingUser = await fetchUserRecord(backendURL, username);

          if (existingUser) {
            return existingUser;
          }

          errorMessage = "We couldn't load your trainer. Please try again.";
        } catch (fetchError) {
          errorMessage = resolveErrorMessage(
            fetchError,
            "We couldn't load your trainer. Please try again.",
            "We couldn't load your trainer due to a network issue. Please check your connection and try again.",
          );
          continue;
        }

        continue;
      }

      errorMessage = resolveErrorMessage(
        error,
        "Unable to create your Pokémon. Please try again.",
        "We couldn't reach the server to create your Pokémon. Please check your connection and try again.",
      );
      continue;
    }

    try {
      const createdUser = await fetchUserRecord(backendURL, username);

      if (createdUser) {
        return createdUser;
      }

      errorMessage = "We couldn't load your trainer. Please try again.";
    } catch (fetchError) {
      errorMessage = resolveErrorMessage(
        fetchError,
        "We couldn't load your trainer. Please try again.",
        "We couldn't load your trainer due to a network issue. Please check your connection and try again.",
      );
    }
  }
}

async function bootstrapUserSelection(appRoot, backendURL) {
  let username = loadCachedUsername();
  let errorMessage = "";

  if (username) {
    try {
      const cachedUser = await fetchUserRecord(backendURL, username);

      if (cachedUser) {
        storeCachedUsername(cachedUser.id ?? username);
        return cachedUser;
      }

      errorMessage = "We couldn't find that trainer. Please create one.";
      clearCachedUsername();
    } catch (error) {
      errorMessage = resolveErrorMessage(
        error,
        "Unable to look up that trainer. Please try again.",
        "We couldn't connect to the trainer service. Please check your connection and try again.",
      );
    }
  }

  username = username || "";

  while (true) {
    username = await promptForUsername(appRoot, { initialValue: username, errorMessage });
    storeCachedUsername(username);
    errorMessage = "";

    let existingUser;

    try {
      existingUser = await fetchUserRecord(backendURL, username);
    } catch (error) {
      errorMessage = resolveErrorMessage(
        error,
        "Unable to look up that trainer. Please try again.",
        "We couldn't connect to the trainer service. Please check your connection and try again.",
      );
      continue;
    }

    if (existingUser) {
      storeCachedUsername(existingUser.id ?? username);
      return existingUser;
    }

    try {
      const createdUser = await handleUserCreation(appRoot, backendURL, username);

      if (createdUser) {
        storeCachedUsername(createdUser.id ?? username);
        return createdUser;
      }

      errorMessage = "We couldn't create the trainer. Please try again.";
    } catch (creationError) {
      errorMessage = resolveErrorMessage(
        creationError,
        "We couldn't create the trainer. Please try again.",
        "We couldn't reach the server to create the trainer. Please check your connection and try again.",
      );
    }
  }
}

function selectActivePet(user) {
  return user.pets.find((pet) => pet && typeof pet.name === "string" && pet.name.trim()) ?? null;
}

function getStageDetail(stageValue) {
  const numericStage = Number(stageValue);

  if (Number.isFinite(numericStage) && STAGE_DETAILS[numericStage]) {
    return STAGE_DETAILS[numericStage];
  }

  return DEFAULT_STAGE_DETAIL;
}

function resolvePetSpecies(pet) {
  if (pet && typeof pet.species === "string") {
    const trimmedSpecies = pet.species.trim();

    if (trimmedSpecies) {
      return trimmedSpecies;
    }
  }

  const stageDetail = getStageDetail(pet?.stage);

  if (stageDetail && typeof stageDetail.species === "string") {
    const trimmedFromStage = stageDetail.species.trim();

    if (trimmedFromStage) {
      return trimmedFromStage;
    }
  }

  return DEFAULT_STAGE_DETAIL.species;
}

function createInfoRow(label, value) {
  return createElement("div", {
    className: "info-row",
    children: [
      createElement("span", { className: "info-label", textContent: label }),
      createElement("span", { className: "info-value", textContent: value }),
    ],
  });
}

function clampFriendship(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function buildFriendshipSection(friendshipValue) {
  const clampedValue = clampFriendship(friendshipValue);

  const wrapper = createElement("div", { className: "friendship-wrapper" });
  const header = createElement("div", {
    className: "info-row",
    children: [
      createElement("span", { className: "info-label", textContent: "Friendship" }),
      createElement("span", {
        className: "friendship-value",
        textContent: `${clampedValue}/100`,
      }),
    ],
  });
  const bar = createElement("div", { className: "friendship-bar" });
  const fill = createElement("div", { className: "friendship-bar-fill" });
  fill.style.width = `${clampedValue}%`;
  bar.appendChild(fill);
  wrapper.appendChild(header);
  wrapper.appendChild(bar);

  return wrapper;
}

function buildProfileColumn({ user, pet }) {
  const column = createElement("div", { className: "profile-column" });
  const activePet = pet ?? null;
  const stageDetail = getStageDetail(activePet?.stage);

  const petName =
    activePet && typeof activePet.name === "string" && activePet.name.trim()
      ? activePet.name.trim()
      : "Your Companion";

  const avatar = createElement("img", {
    className: "pet-avatar",
    attributes: {
      src: stageDetail.image,
      alt: `${stageDetail.species} avatar`,
    },
  });

  const petCardChildren = [
    avatar,
    createElement("div", { className: "pet-name", textContent: petName }),
  ];

  if (!activePet) {
    petCardChildren.push(
      createElement("div", {
        className: "info-value",
        textContent: "Add a pet to begin chatting.",
      }),
    );
  }

  column.appendChild(
    createElement("div", {
      className: "card pet-card",
      children: petCardChildren,
    }),
  );

  const speciesFromPet =
    activePet && typeof activePet.species === "string" && activePet.species.trim()
      ? activePet.species.trim()
      : stageDetail.species;

  const ownerId =
    typeof user.id === "string" && user.id.trim()
      ? user.id.trim()
      : String(user.id ?? "Player");

  const lastChattedRaw = activePet?.lastChatted;
  let lastChattedDisplay = "—";

  if (typeof lastChattedRaw === "string" && lastChattedRaw.trim()) {
    const trimmed = lastChattedRaw.trim();
    const parsed = new Date(trimmed);
    lastChattedDisplay = Number.isNaN(parsed.getTime())
      ? trimmed
      : parsed.toISOString().split("T")[0];
  } else if (lastChattedRaw instanceof Date) {
    lastChattedDisplay = lastChattedRaw.toISOString().split("T")[0];
  } else if (lastChattedRaw !== undefined && lastChattedRaw !== null) {
    const parsed = new Date(lastChattedRaw);

    if (!Number.isNaN(parsed.getTime())) {
      lastChattedDisplay = parsed.toISOString().split("T")[0];
    }
  }

  const infoRows = [
    createInfoRow("Species", speciesFromPet),
    createInfoRow("Owner", ownerId),
    createInfoRow("Last-chatted", lastChattedDisplay),
  ];

  const talkingStreakDisplay = `${getTalkingStreakValue(activePet)} days`;
  infoRows.push(createInfoRow("Talking Streak", talkingStreakDisplay));

  const infoCardChildren = [
    createElement("div", { className: "info-grid", children: infoRows }),
    buildFriendshipSection(activePet?.friendship ?? 0),
  ];

  column.appendChild(
    createElement("div", {
      className: "card info-card",
      children: infoCardChildren,
    }),
  );

  return column;
}

async function applyPetDailyAdjustments({ appRoot, backendURL, user }) {
  const activePet = selectActivePet(user);

  if (!activePet) {
    return { user, pet: null, messages: [] };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const petIdentifier = sanitizeIdentifier(activePet._id ?? activePet.id, "");

  if (!petIdentifier) {
    console.warn("Unable to update pet without identifier.");
    return { user, pet: activePet, messages: [] };
  }

  let lastChattedDate = null;

  if (activePet.lastChatted instanceof Date) {
    lastChattedDate = activePet.lastChatted;
  } else if (typeof activePet.lastChatted === "string" && activePet.lastChatted.trim()) {
    const parsed = new Date(activePet.lastChatted.trim());

    if (!Number.isNaN(parsed.getTime())) {
      lastChattedDate = parsed;
    }
  } else if (activePet.lastChatted !== undefined && activePet.lastChatted !== null) {
    const parsed = new Date(activePet.lastChatted);

    if (!Number.isNaN(parsed.getTime())) {
      lastChattedDate = parsed;
    }
  }

  let dayDifference = 0;

  if (lastChattedDate) {
    const lastChattedStart = new Date(lastChattedDate);
    lastChattedStart.setHours(0, 0, 0, 0);
    const diffMs = todayStart.getTime() - lastChattedStart.getTime();

    if (diffMs > 0) {
      dayDifference = Math.floor(diffMs / MS_PER_DAY);
    }
  }

  const updates = {};
  const originalFriendship = clampFriendship(activePet.friendship);
  let newFriendship = originalFriendship;
  let newStreak = getTalkingStreakValue(activePet);
  const stageValue = Number(activePet.stage);
  const stageBefore = Number.isFinite(stageValue) ? stageValue : 1;
  let stageAfter = stageBefore;
  let evolutionMessage = null;

  if (originalFriendship <= 0) {
    await deleteTrainerPet(backendURL, user.id, petIdentifier);
    await showRunAwayPrompt(appRoot, activePet.name);
    const refreshedUser = await promptForExistingTrainerPet(appRoot, backendURL, user.id);
    storeCachedUsername(refreshedUser.id ?? user.id);
    const refreshedPet = selectActivePet(refreshedUser);

    return { user: refreshedUser, pet: refreshedPet ?? null, messages: [] };
  }

  if (dayDifference === 1) {
    newStreak += 1;
    updates[TALKING_STREAK_FIELD] = newStreak;
  } else if (dayDifference > 1) {
    if (newStreak !== 0) {
      newStreak = 0;
      updates[TALKING_STREAK_FIELD] = 0;
    }
  }

  if (dayDifference >= 3) {
    const penalty = dayDifference * 10;
    const decreasedFriendship = Math.max(0, newFriendship - penalty);

    if (decreasedFriendship !== newFriendship) {
      newFriendship = decreasedFriendship;
      updates.friendship = newFriendship;
    }
  }

  if (stageBefore < 3 && newStreak >= 7) {
    stageAfter = stageBefore + 1;
    updates.stage = stageAfter;
    updates[TALKING_STREAK_FIELD] = 0;

    const previousStageDetail = getStageDetail(stageBefore) ?? DEFAULT_STAGE_DETAIL;
    const nextStageDetail = getStageDetail(stageAfter) ?? previousStageDetail;
    const preSpecies =
      previousStageDetail && typeof previousStageDetail.species === "string" && previousStageDetail.species.trim()
        ? previousStageDetail.species.trim()
        : DEFAULT_STAGE_DETAIL.species;
    const postSpecies =
      nextStageDetail && typeof nextStageDetail.species === "string" && nextStageDetail.species.trim()
        ? nextStageDetail.species.trim()
        : preSpecies;
    const companionName = sanitizeIdentifier(activePet.name, "Your companion");

    evolutionMessage = `${companionName} has evolved from ${preSpecies} to ${postSpecies}!`;
  }

  if (Object.keys(updates).length === 0) {
    return { user, pet: activePet, messages: [] };
  }

  if (updates.friendship !== undefined && updates.friendship <= 0) {
    await deleteTrainerPet(backendURL, user.id, petIdentifier);
    await showRunAwayPrompt(appRoot, activePet.name);
    const refreshedUser = await promptForExistingTrainerPet(appRoot, backendURL, user.id);
    storeCachedUsername(refreshedUser.id ?? user.id);
    const refreshedPet = selectActivePet(refreshedUser);

    return { user: refreshedUser, pet: refreshedPet ?? null, messages: [] };
  }

  const payload = { ...activePet, ...updates };

  await updateTrainerPet(backendURL, user.id, petIdentifier, payload);

  let refreshedUser = null;

  try {
    refreshedUser = await fetchUserRecord(backendURL, user.id);
  } catch (error) {
    console.error("Failed to refresh trainer after updating pet:", error);
  }

  let resolvedUser = refreshedUser;

  if (!resolvedUser) {
    const updatedPets = Array.isArray(user.pets)
      ? user.pets.map((pet) => {
          if (!pet || typeof pet !== "object") {
            return pet;
          }

          const candidateId = sanitizeIdentifier(pet._id ?? pet.id, "");

          if (candidateId && candidateId === petIdentifier) {
            return { ...pet, ...updates };
          }

          return pet;
        })
      : user.pets;

    resolvedUser = { ...user, pets: updatedPets };
  }

  const refreshedPet = selectActivePet(resolvedUser) ?? activePet;
  const messages = [];

  if (evolutionMessage) {
    messages.push({ sender: "System", message: evolutionMessage });
  }

  storeCachedUsername((resolvedUser && resolvedUser.id) ?? user.id);

  return { user: resolvedUser, pet: refreshedPet, messages };
}

function buildChatSection({ user, pet, backendURL }) {
  const chatBox = createElement("div", { className: "chat-box" });

  const inputField = createElement("input", {
    attributes: {
      type: "text",
      placeholder: "Type a message",
    },
  });

  const sendButton = createElement("button", {
    textContent: "Send",
    attributes: {
      type: "button",
      "aria-label": "Send message",
    },
  });

  let sending = false;

  function setSendingState(active) {
    sending = active;
    inputField.disabled = active;
    sendButton.disabled = active;

    if (!active) {
      inputField.focus();
    }
  }

  async function handleSend() {
    const trimmedMessage = inputField.value.trim();

    if (!trimmedMessage || sending) {
      return;
    }

    const trainerDisplayName = sanitizeIdentifier(user.id, "Trainer");
    const petSpecies = resolvePetSpecies(pet);
    const companionDisplayName = sanitizeIdentifier(pet?.name, petSpecies);
    const personaContext =
      pet && typeof pet.context === "string" && pet.context.trim()
        ? pet.context.trim()
        : "";
    const conversationContext = formatConversationContext(conversationHistory, {
      trainerName: trainerDisplayName,
      petName: companionDisplayName,
    });
    const promptMessage = buildRoleplayPrompt({
      userInput: trimmedMessage,
      species: petSpecies,
      friendship: pet?.friendship ?? 0,
      context: conversationContext,
    });

    const requestMessages = [];

    if (personaContext) {
      requestMessages.push({ role: "system", content: personaContext });
    }

    requestMessages.push({ role: "user", content: promptMessage });

    appendMessage({ sender: trainerDisplayName, message: trimmedMessage }, chatBox);
    conversationHistory.push({ role: "user", content: trimmedMessage });

    inputField.value = "";
    setSendingState(true);

    try {
      const response = await requestChatCompletion(backendURL, requestMessages);
      const assistantText = extractAssistantMessage(response);

      if (assistantText) {
        conversationHistory.push({ role: "assistant", content: assistantText });
        appendMessage({ sender: companionDisplayName, message: assistantText }, chatBox);
      } else {
        appendMessage(
          {
            sender: "System",
            message: "The pet is thinking but hasn't replied yet.",
          },
          chatBox,
        );
      }
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Unable to reach the pet right now.";
      appendMessage({ sender: "System", message: errorMessage }, chatBox);
    } finally {
      setSendingState(false);
    }
  }

  sendButton.addEventListener("click", handleSend);

  inputField.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSend();
    }
  });

  const inputArea = createElement("div", {
    className: "input-area",
    children: [inputField, sendButton],
  });

  const chatTitleText = pet
    ? `Chatting with ${companionDisplayName}`
    : "Chatting with your pet";

  const headerChildren = [
    createElement("div", {
      className: "chat-header-title",
      textContent: chatTitleText,
    }),
  ];

  const chatHeader = createElement("div", {
    className: "chat-header",
    children: headerChildren,
  });

  const chatWrapper = createElement("div", {
    className: "chat-wrapper",
    children: [chatHeader, chatBox, inputArea],
  });

  renderMessages(chatBox);

  const chatColumn = createElement("div", {
    className: "chat-column",
    children: [chatWrapper],
  });

  return { section: chatColumn, inputField };
}

function buildAppShell({ user, pet, backendURL }) {
  const profileColumn = buildProfileColumn({ user, pet });
  const { section: chatColumn, inputField } = buildChatSection({ user, pet, backendURL });

  const root = createElement("div", {
    className: "app-shell",
    children: [profileColumn, chatColumn],
  });

  return { root, focusTarget: inputField };
}

async function initApp() {
  const appRoot = document.querySelector("#app");

  if (!appRoot) {
    console.warn("App root element not found; cannot render chat UI.");
    return;
  }

  appRoot.innerHTML = "";

  displayMessages.splice(0);
  conversationHistory.splice(0);

  const backendURL = await resolveBackendURL();

  let user;

  try {
    user = await bootstrapUserSelection(appRoot, backendURL);
  } catch (error) {
    console.error(error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to load the player profile.";
    appRoot.innerHTML = "";
    appRoot.appendChild(
      createElement("div", {
        className: "error-message",
        textContent: errorMessage,
      }),
    );
    return;
  }

  let adjustmentResult = { user, pet: selectActivePet(user), messages: [] };

  try {
    adjustmentResult = await applyPetDailyAdjustments({ appRoot, backendURL, user });
    user = adjustmentResult.user;
  } catch (error) {
    console.error("Failed to apply pet adjustments:", error);
  }

  const activePet = adjustmentResult.pet ?? selectActivePet(user);

  const introMessage = activePet
    ? `${activePet.name} perks up, ready to chat.`
    : "No pets are currently linked to this trainer.";

  displayMessages.push({
    sender: "System",
    message: `You are chatting as ${user.id}. ${introMessage}`,
  });

  adjustmentResult.messages
    .filter((entry) => entry && typeof entry.message === "string" && entry.message.trim())
    .forEach((entry) => {
      const senderLabel = sanitizeIdentifier(entry.sender, "System");
      displayMessages.push({ sender: senderLabel, message: entry.message.trim() });
    });

  const { root, focusTarget } = buildAppShell({ user, pet: activePet, backendURL });

  appRoot.innerHTML = "";
  appRoot.appendChild(root);

  if (focusTarget) {
    focusTarget.focus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((error) => {
    console.error("Failed to initialize the chat UI:", error);
  });
});
