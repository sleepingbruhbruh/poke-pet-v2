import { createElement } from "../dom.js";
import { sanitizeIdentifier } from "../utils.js";

function resolveOverlayHost(preferred) {
  if (preferred) {
    return preferred;
  }

  if (typeof document !== "undefined" && document.body) {
    return document.body;
  }

  return null;
}

function presentOverlayMessage(parentNode, options = {}) {
  const host = resolveOverlayHost(parentNode);

  if (!host) {
    return Promise.resolve();
  }

  const {
    message = "",
    buttonLabel = "Ok",
    buttonAriaLabel = "Dismiss message",
    buttonClassName = "",
  } = options;

  return new Promise((resolve) => {
    const overlay = createElement("div", {
      className: "prompt-overlay",
    });

    const card = createElement("div", {
      className: "prompt-card prompt-card--overlay",
      attributes: { role: "dialog", "aria-live": "assertive", "aria-modal": "true" },
    });

    const title = createElement("div", { className: "prompt-title", textContent: message });
    const button = createElement("button", {
      className: ["prompt-submit-button", buttonClassName].filter(Boolean).join(" "),
      textContent: buttonLabel,
      attributes: { type: "button", "aria-label": buttonAriaLabel },
    });

    const actions = createElement("div", {
      className: "prompt-runaway-actions",
      children: [button],
    });

    card.appendChild(title);
    card.appendChild(actions);
    overlay.appendChild(card);
    host.appendChild(overlay);

    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    button.addEventListener("click", () => {
      button.disabled = true;
      cleanup();
      resolve();
    });

    if (typeof button.focus === "function") {
      button.focus();
    }
  });
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
      card.appendChild(
        createElement("p", { className: "prompt-description", textContent: description }),
      );
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

    const submitButton = createElement("button", {
      className: "prompt-submit-button",
      textContent: submitLabel,
      attributes: {
        type: "submit",
        "aria-label": submitAriaLabel,
      },
    });

    inputWrapper.appendChild(input);
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

    input.addEventListener("input", () => {
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
      submitButton.disabled = true;

      resolve(trimmedValue);
    });

    input.focus();
  });
}

export function promptForUsername(appRoot, { initialValue = "", errorMessage = "" } = {}) {
  return renderInputPrompt(appRoot, {
    title: "Enter username",
    placeholder: "Enter your username..",
    initialValue,
    errorMessage,
    submitLabel: "→",
    submitAriaLabel: "Confirm username",
  });
}

export function promptForPetName(appRoot, { initialValue = "", errorMessage = "" } = {}) {
  return renderInputPrompt(appRoot, {
    lead: "Looks like you currently don't own a Pokémon.",
    title: "Enter your new pokemon name",
    placeholder: "Enter new Pokemon name..",
    initialValue,
    errorMessage,
    submitLabel: "→",
    submitAriaLabel: "Confirm Pokémon name",
  });
}

export function showRunAwayPrompt(appRoot, petName) {
  const safeName = sanitizeIdentifier(petName, "Your companion");

  if (appRoot) {
    appRoot.innerHTML = "";
  }

  return presentOverlayMessage(appRoot, {
    message: `${safeName} has ran away.`,
    buttonLabel: "Ok..",
    buttonAriaLabel: "Acknowledge run away notice",
    buttonClassName: "prompt-runaway-button",
  });
}

export async function showEvolutionSequence({ parent, postSpecies }) {
  const overlayHost = resolveOverlayHost(parent);

  if (!overlayHost) {
    return;
  }

  await presentOverlayMessage(overlayHost, {
    message: "Your Pokemon is evolving!?",
    buttonLabel: "Continue",
    buttonAriaLabel: "Continue evolution sequence",
  });

  const safeSpecies = sanitizeIdentifier(postSpecies, "its next form");

  await presentOverlayMessage(overlayHost, {
    message: `Congratulations, your pokemon has evolved into ${safeSpecies}`,
    buttonLabel: "Awesome!",
    buttonAriaLabel: "Close evolution message",
  });
}
