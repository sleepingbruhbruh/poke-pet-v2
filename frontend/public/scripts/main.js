import { buildAppShell } from "./ui/appShell.js";
import { applyPetDailyAdjustments } from "./features/petLifecycle.js";
import { bootstrapUserSelection } from "./flows/trainer.js";
import { createElement } from "./dom.js";
import { selectActivePet } from "./pets.js";
import { resolveBackendURL } from "./services/api.js";
import { displayMessages, resetState } from "./state.js";
import { sanitizeIdentifier } from "./utils.js";

async function initApp() {
  const appRoot = document.querySelector("#app");

  if (!appRoot) {
    console.warn("App root element not found; cannot render chat UI.");
    return;
  }

  appRoot.innerHTML = "";
  resetState();

  const backendURL = await resolveBackendURL();

  let user;

  try {
    user = await bootstrapUserSelection(appRoot, backendURL);
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "Failed to load the player profile.";
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
