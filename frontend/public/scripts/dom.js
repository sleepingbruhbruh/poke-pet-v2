export function createElement(tag, options = {}) {
  const { className, textContent, attributes = {}, children = [] } = options;

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

export function createMessageElement({ sender, message }) {
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

export function renderMessages(chatBox, messages = []) {
  chatBox.innerHTML = "";
  messages.forEach((message) => {
    chatBox.appendChild(createMessageElement(message));
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

export function appendMessage(message, chatBox, messages = []) {
  const normalizedMessage = {
    sender:
      typeof message.sender === "string"
        ? message.sender
        : String(message.sender ?? ""),
    message:
      typeof message.message === "string"
        ? message.message
        : String(message.message ?? ""),
  };

  if (Array.isArray(messages)) {
    messages.push(normalizedMessage);
  }

  chatBox.appendChild(createMessageElement(normalizedMessage));
  chatBox.scrollTop = chatBox.scrollHeight;
}
