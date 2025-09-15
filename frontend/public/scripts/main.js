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

  if (textContent) {
    element.textContent = textContent;
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, value);
    }
  });

  children.forEach((child) => {
    if (child) {
      element.appendChild(child);
    }
  });

  return element;
}

const messages = [];

function createMessageElement({ sender, message }) {
  const messageElement = createElement("div", { className: "message" });

  const senderElement = createElement("strong", {
    textContent: `${sender}:`,
  });

  messageElement.appendChild(senderElement);
  messageElement.appendChild(document.createTextNode(` ${message}`));

  return messageElement;
}

function renderMessages(chatBox) {
  chatBox.innerHTML = "";
  messages.forEach((message) => {
    chatBox.appendChild(createMessageElement(message));
  });
}

function buildChatUI() {
  const chatBox = createElement("div", { className: "chat-box" });

  const inputField = createElement("input", {
    attributes: {
      type: "text",
      placeholder: "Value",
    },
  });

  const sendButton = createElement("button", {
    textContent: "→",
    attributes: {
      type: "button",
      "aria-label": "Send message",
    },
  });

  function handleSend() {
    const trimmedMessage = inputField.value.trim();

    if (!trimmedMessage) {
      return;
    }

    const message = {
      sender: "User",
      message: trimmedMessage,
    };

    messages.push(message);
    chatBox.appendChild(createMessageElement(message));
    inputField.value = "";
    inputField.focus();
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

  const chatWrapper = createElement("div", {
    className: "chat-wrapper",
    children: [chatBox, inputArea],
  });

  renderMessages(chatBox);

  return chatWrapper;
}

document.addEventListener("DOMContentLoaded", () => {
  const appRoot = document.querySelector("#app");

  if (!appRoot) {
    console.warn("App root element not found; cannot render chat UI.");
    return;
  }

  const chatUI = buildChatUI();
  appRoot.appendChild(chatUI);
});
