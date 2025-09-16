import { MS_PER_DAY } from "../config.js";
import { appendMessage, createElement, renderMessages } from "../dom.js";
import { resolvePetSpecies } from "../pets.js";
import { requestChatCompletion, updateTrainerPet } from "../services/api.js";
import { conversationHistory, displayMessages } from "../state.js";
import {
  buildRoleplayPrompt,
  clampFriendship,
  getFriendshipTier,
  formatConversationContext,
  sanitizeIdentifier,
} from "../utils.js";

export function buildChatSection({ user, pet, backendURL, onPetReleased, onLogout }) {
  const chatBox = createElement("div", { className: "chat-box" });

  const inputField = createElement("input", {
    attributes: {
      type: "text",
      placeholder: "Type a message",
    },
  });

  const sendButton = createElement("button", {
    className: "send-button",
    textContent: "→",
    attributes: {
      type: "button",
      "aria-label": "Send message",
    },
  });

  const releaseSpecies = resolvePetSpecies(pet);
  const releaseTargetName = sanitizeIdentifier(pet?.name, releaseSpecies);
  const releaseButtonLabel = pet
    ? `Let ${releaseTargetName} go`
    : "Let your companion go";
  const releaseButton = createElement("button", {
    className: "let-go-button",
    textContent: releaseButtonLabel,
    attributes: {
      type: "button",
      "aria-label": pet ? `Let ${releaseTargetName} go` : "Let your companion go",
    },
  });

  const logoutButton = createElement("button", {
    className: "logout-button",
    textContent: "Log out",
    attributes: {
      type: "button",
      "aria-label": "Log out",
    },
  });

  let sending = false;
  let releasing = false;
  let hasUpdatedFirstMessage = !pet;
  let loggingOut = false;

  function updateControlStates() {
    const busy = sending || releasing || loggingOut;
    inputField.disabled = busy;
    sendButton.disabled = busy;

    if (releaseButton) {
      const cannotRelease = !pet || typeof onPetReleased !== "function";
      releaseButton.disabled = busy || cannotRelease;
    }

    if (logoutButton) {
      const cannotLogout = typeof onLogout !== "function";
      logoutButton.disabled = busy || cannotLogout;
    }
  }

  function setSendingState(active) {
    sending = active;
    updateControlStates();

    if (!sending && !releasing && !loggingOut) {
      inputField.focus();
    }
  }

  function updateLastChattedDisplay(isoString) {
    const lastChattedElement = document.querySelector('[data-info="last-chatted"]');

    if (!lastChattedElement) {
      return;
    }

    let formatted = isoString;

    try {
      const parsed = new Date(isoString);

      if (!Number.isNaN(parsed.getTime())) {
        formatted = parsed.toISOString().split("T")[0];
      }
    } catch {
      // Ignore formatting errors and use the raw value.
    }

    lastChattedElement.textContent = formatted;
  }

  function updateFriendshipDisplay(friendshipValue) {
    const boundedFriendship = clampFriendship(friendshipValue);
    const friendshipValueElement = document.querySelector('[data-info="friendship-score"]');
    const friendshipProgressElement = document.querySelector('[data-info="friendship-progress"]');

    if (friendshipValueElement) {
      friendshipValueElement.textContent = `${boundedFriendship}/100`;
    }

    if (friendshipProgressElement) {
      friendshipProgressElement.style.width = `${boundedFriendship}%`;
      const tier = getFriendshipTier(boundedFriendship);
      friendshipProgressElement.dataset.friendshipTier = tier;
      friendshipProgressElement.classList.remove(
        "friendship-bar-fill--low",
        "friendship-bar-fill--medium",
        "friendship-bar-fill--high",
      );
      friendshipProgressElement.classList.add(`friendship-bar-fill--${tier}`);
    }
  }

  function parseLastChattedDate(rawValue) {
    if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
      return rawValue;
    }

    if (typeof rawValue === "string" && rawValue.trim()) {
      const parsed = new Date(rawValue.trim());
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (rawValue !== undefined && rawValue !== null) {
      const parsed = new Date(rawValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  function wasLastChattedYesterday(lastChattedDate, now) {
    if (!lastChattedDate) {
      return false;
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const lastChattedStart = new Date(lastChattedDate);
    lastChattedStart.setHours(0, 0, 0, 0);
    const diffMs = todayStart.getTime() - lastChattedStart.getTime();

    if (diffMs <= 0) {
      return false;
    }

    return Math.floor(diffMs / MS_PER_DAY) === 1;
  }

  async function ensureFirstMessageUpdate() {
    if (hasUpdatedFirstMessage || !pet) {
      return;
    }

    const petIdentifier = sanitizeIdentifier(pet._id ?? pet.id, "");

    if (!petIdentifier) {
      hasUpdatedFirstMessage = true;
      return;
    }

    const now = new Date();
    const isoNow = now.toISOString();
    const updates = { lastChatted: isoNow };
    const lastChattedDate = parseLastChattedDate(pet.lastChatted);

    if (wasLastChattedYesterday(lastChattedDate, now)) {
      updates.friendship = clampFriendship((pet.friendship ?? 0) + 10);
    }

    const payload = { ...pet, ...updates };

    try {
      await updateTrainerPet(backendURL, user.id, petIdentifier, payload);
    } catch (error) {
      console.error("Failed to update the Pokémon after the first message:", error);
      const fallbackMessage =
        "We couldn't update your Pokémon's details right now. They'll refresh later.";
      const message = error instanceof Error && error.message ? error.message : fallbackMessage;
      appendMessage({ sender: "System", message }, chatBox, displayMessages);
      throw error;
    }

    hasUpdatedFirstMessage = true;

    pet.lastChatted = isoNow;

    if (updates.friendship !== undefined) {
      pet.friendship = updates.friendship;
      updateFriendshipDisplay(updates.friendship);
    }

    updateLastChattedDisplay(isoNow);
  }

  async function handleSend() {
    const trimmedMessage = inputField.value.trim();

    if (!trimmedMessage || sending || releasing || loggingOut) {
      return;
    }

    const trainerDisplayName = sanitizeIdentifier(user.id, "Trainer");
    const petSpecies = resolvePetSpecies(pet);
    const companionDisplayName = sanitizeIdentifier(pet?.name, petSpecies);
    const personaContext =
      pet && typeof pet.context === "string" && pet.context.trim() ? pet.context.trim() : "";
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

    appendMessage({ sender: trainerDisplayName, message: trimmedMessage }, chatBox, displayMessages);
    conversationHistory.push({ role: "user", content: trimmedMessage });

    inputField.value = "";
    setSendingState(true);

    if (!hasUpdatedFirstMessage) {
      try {
        await ensureFirstMessageUpdate();
      } catch (error) {
        console.error("First message update failed:", error);
      }
    }
    
    try {
      const response = await requestChatCompletion(backendURL, requestMessages);
      const assistantText = extractAssistantMessage(response);

      if (assistantText) {
        conversationHistory.push({ role: "assistant", content: assistantText });
        appendMessage(
          { sender: companionDisplayName, message: assistantText },
          chatBox,
          displayMessages,
        );
      } else {
        appendMessage(
          {
            sender: "System",
            message: "The pet is thinking but hasn't replied yet.",
          },
          chatBox,
          displayMessages,
        );
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Unable to reach the pet right now.";
      appendMessage({ sender: "System", message: errorMessage }, chatBox, displayMessages);
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

  async function handleRelease() {
    if (releasing || loggingOut || !pet || typeof onPetReleased !== "function") {
      return;
    }

    releasing = true;
    updateControlStates();

    try {
      await onPetReleased();
    } catch (error) {
      console.error("Failed to let the Pokémon go:", error);
      const fallbackMessage = "We couldn't let your Pokémon go right now. Please try again.";
      const message = error instanceof Error && error.message ? error.message : fallbackMessage;
      appendMessage({ sender: "System", message }, chatBox, displayMessages);
    } finally {
      releasing = false;
      updateControlStates();
    }
  }

  releaseButton.addEventListener("click", handleRelease);

  async function handleLogout() {
    if (loggingOut || typeof onLogout !== "function") {
      return;
    }

    loggingOut = true;
    updateControlStates();

    try {
      await onLogout();
    } catch (error) {
      console.error("Failed to log out:", error);
      const fallbackMessage = "We couldn't sign you out right now. Please try again.";
      const message = error instanceof Error && error.message ? error.message : fallbackMessage;
      appendMessage({ sender: "System", message }, chatBox, displayMessages);
    } finally {
      loggingOut = false;
      updateControlStates();
    }
  }

  logoutButton.addEventListener("click", handleLogout);

  const inputArea = createElement("div", {
    className: "input-area",
    children: [inputField, sendButton],
  });

  const actionRow = createElement("div", {
    className: "chat-actions",
    children: [logoutButton, releaseButton],
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

  renderMessages(chatBox, displayMessages);

  updateControlStates();
  const chatColumn = createElement("div", {
    className: "chat-column",
    children: [chatWrapper, actionRow],
  });

  return { section: chatColumn, inputField };
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
