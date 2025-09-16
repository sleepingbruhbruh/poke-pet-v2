import { buildAppShell } from "./ui/appShell.js";
import { applyPetDailyAdjustments } from "./features/petLifecycle.js";
import { bootstrapUserSelection, promptForExistingTrainerPet } from "./flows/trainer.js";
import { createElement } from "./dom.js";
import { selectActivePet } from "./pets.js";
import { resolveBackendURL, deleteTrainerPet } from "./services/api.js";
import { displayMessages, resetState } from "./state.js";
import { sanitizeIdentifier } from "./utils.js";
import { showRunAwayPrompt } from "./ui/prompts.js";
import { clearCachedUsername, storeCachedUsername } from "./storage.js";

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

  let adjustmentResult = { user, pet: selectActivePet(user), messages: [], evolution: null };

  try {
    adjustmentResult = await applyPetDailyAdjustments({ appRoot, backendURL, user });
    user = adjustmentResult.user;
  } catch (error) {
    console.error("Failed to apply pet adjustments:", error);
  }

  const activePet = adjustmentResult.pet ?? selectActivePet(user);
  const evolutionDetail = adjustmentResult.evolution ?? null;

  async function handlePetRelease() {
    const currentPet = activePet ?? selectActivePet(user);

    if (!currentPet) {
      window.alert("You don't have a Pokémon to let go right now.");
      return;
    }

    const petIdentifier = sanitizeIdentifier(currentPet._id ?? currentPet.id, "");

    if (!petIdentifier) {
      window.alert("We couldn't identify that Pokémon to let it go.");
      return;
    }

    try {
      await deleteTrainerPet(backendURL, user.id, petIdentifier);
    } catch (error) {
      console.error("Failed to let the Pokémon go:", error);
      const fallbackMessage = "We couldn't let your Pokémon go. Please try again.";
      const message = error instanceof Error && error.message ? error.message : fallbackMessage;
      window.alert(message);
      throw error;
    }

    try {
      await showRunAwayPrompt(appRoot, currentPet.name);
    } catch (promptError) {
      console.error("Failed to show release prompt:", promptError);
    }

    let refreshedUser;

    try {
      refreshedUser = await promptForExistingTrainerPet(appRoot, backendURL, user.id);
    } catch (error) {
      console.error("Failed to create a new Pokémon after release:", error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : "We couldn't create a new Pokémon. Please try again.";
      appRoot.innerHTML = "";
      appRoot.appendChild(
        createElement("div", {
          className: "error-message",
          textContent: fallbackMessage,
        }),
      );
      throw error;
    }

    storeCachedUsername(refreshedUser.id ?? user.id);

    try {
      await initApp();
    } catch (error) {
      console.error("Failed to reload the chat after releasing the Pokémon:", error);
      throw error;
    }
  }

  async function handleLogout() {
    clearCachedUsername();

    try {
      await initApp();
    } catch (error) {
      console.error("Failed to return to the trainer selection screen:", error);
      throw error;
    }
  }

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

  const { root, focusTarget } = buildAppShell({
    user,
    pet: activePet,
    backendURL,
    evolution: evolutionDetail,
    onPetReleased: handlePetRelease,
    onLogout: handleLogout,
  });

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
