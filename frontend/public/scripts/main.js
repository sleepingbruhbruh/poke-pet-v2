const DEFAULT_BACKEND_URL = "http://localhost:3000";

const displayMessages = [];
const conversationHistory = [];

const STAGE_DETAILS = {
  1: { species: "Pichu", image: "images/pichu.svg" },
  2: { species: "Pikachu", image: "images/pikachu.svg" },
  3: { species: "Raichu", image: "images/raichu.svg" },
};

const DEFAULT_STAGE_DETAIL = {
  species: "Companion",
  image: "images/pikachu.svg",
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

async function loadUserProfile() {
  const response = await fetch("/placeholder.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load user info (status ${response.status}).`);
  }

  const payload = await response.json();
  const rawUser = payload?.user ?? payload?.currentUser ?? payload;

  if (!rawUser || typeof rawUser !== "object") {
    throw new Error("Placeholder user info is missing or invalid.");
  }

  const resolvedId = rawUser.id ?? rawUser._id ?? rawUser.name;
  const userId = (() => {
    if (resolvedId === undefined || resolvedId === null) {
      return "Player";
    }

    const normalized = String(resolvedId).trim();
    return normalized || "Player";
  })();

  const rawPets = rawUser.pets;
  const candidatePets = Array.isArray(rawPets)
    ? rawPets
    : rawPets && typeof rawPets === "object"
      ? [rawPets]
      : [];

  const pets = candidatePets
    .filter((pet) => pet && typeof pet === "object")
    .map((pet) => {
      const rawName = pet.name;
      const normalizedName =
        typeof rawName === "string"
          ? rawName.trim()
          : rawName !== undefined && rawName !== null
            ? String(rawName).trim()
            : "";

      if (!normalizedName) {
        return null;
      }

      return {
        ...pet,
        name: normalizedName,
      };
    })
    .filter(Boolean);

  return {
    ...rawUser,
    id: userId,
    pets,
  };
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
    lastChattedDisplay = lastChattedRaw.trim();
  } else if (lastChattedRaw instanceof Date) {
    lastChattedDisplay = lastChattedRaw.toISOString().split("T")[0];
  }

  const infoRows = [
    createInfoRow("Species", speciesFromPet),
    createInfoRow("Owner", ownerId),
    createInfoRow("Last-chatted", lastChattedDisplay),
  ];

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

    const senderName = user.id;
    appendMessage({ sender: senderName, message: trimmedMessage }, chatBox);
    conversationHistory.push({ role: "user", content: trimmedMessage });

    inputField.value = "";
    setSendingState(true);

    try {
      const response = await requestChatCompletion(backendURL, conversationHistory);
      const assistantText = extractAssistantMessage(response);

      if (assistantText) {
        conversationHistory.push({ role: "assistant", content: assistantText });
        const petName = pet?.name ? String(pet.name) : "Pet";
        appendMessage({ sender: petName, message: assistantText }, chatBox);
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

  const headerChildren = [
    createElement("div", {
      className: "chat-header-title",
      textContent: `Trainer: ${user.id}`,
    }),
  ];

  if (pet) {
    headerChildren.push(
      createElement("div", {
        className: "chat-header-subtitle",
        textContent: `Chatting with ${pet.name}`,
      }),
    );
  }

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

  let user;

  try {
    user = await loadUserProfile();
  } catch (error) {
    console.error(error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to load the player profile.";
    const errorElement = createElement("div", {
      className: "error-message",
      textContent: errorMessage,
    });
    appRoot.appendChild(errorElement);
    return;
  }

  const activePet = selectActivePet(user);

  if (activePet?.context) {
    conversationHistory.push({ role: "system", content: activePet.context });
  }

  const introMessage = activePet
    ? `${activePet.name} perks up, ready to chat.`
    : "No pets are currently linked to this trainer.";

  displayMessages.push({
    sender: "System",
    message: `You are chatting as ${user.id}. ${introMessage}`,
  });

  const backendURL = await resolveBackendURL();
  const { root, focusTarget } = buildAppShell({ user, pet: activePet, backendURL });

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
