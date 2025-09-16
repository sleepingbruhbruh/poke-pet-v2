import { appendMessage, createElement, renderMessages } from "../dom.js";
import { resolvePetSpecies } from "../pets.js";
import { requestChatCompletion } from "../services/api.js";
import { conversationHistory, displayMessages } from "../state.js";
import { buildRoleplayPrompt, formatConversationContext, sanitizeIdentifier } from "../utils.js";

export function buildChatSection({ user, pet, backendURL }) {
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

  renderMessages(chatBox, displayMessages);

  const chatColumn = createElement("div", {
    className: "chat-column",
    children: [chatWrapper],
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
