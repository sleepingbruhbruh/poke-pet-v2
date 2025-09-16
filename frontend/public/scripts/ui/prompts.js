import { createElement } from "../dom.js";
import { sanitizeIdentifier } from "../utils.js";

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

  return new Promise((resolve) => {
    appRoot.innerHTML = "";

    const container = createElement("div", { className: "prompt-overlay" });
    const card = createElement("div", { className: "prompt-card" });

    const title = createElement("div", {
      className: "prompt-title",
      textContent: `${safeName} has ran away.`,
    });

    const button = createElement("button", {
      className: "prompt-submit-button prompt-runaway-button",
      textContent: "Ok..",
      attributes: {
        type: "button",
        "aria-label": "Acknowledge run away notice",
      },
    });

    card.appendChild(title);
    card.appendChild(
      createElement("div", {
        className: "prompt-runaway-actions",
        children: [button],
      }),
    );
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
