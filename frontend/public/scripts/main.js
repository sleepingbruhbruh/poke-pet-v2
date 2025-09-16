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

const CURRENT_USER_BADGE_ID = "current-user-badge";

function ensureCurrentUserBadge() {
  if (!document || !document.body) {
    return null;
  }

  let badge = document.getElementById(CURRENT_USER_BADGE_ID);

  if (!badge) {
    badge = createElement("div", {
      className: "current-user-indicator is-hidden",
      attributes: { id: CURRENT_USER_BADGE_ID },
    });

    document.body.appendChild(badge);
  }

  return badge;
}

function hideCurrentUserBadge() {
  const badge = ensureCurrentUserBadge();

  if (!badge) {
    return;
  }

  badge.textContent = "";
  badge.classList.add("is-hidden");
}

function updateCurrentUserBadge(username) {
  const badge = ensureCurrentUserBadge();

  if (!badge) {
    return;
  }

  const safeName = sanitizeIdentifier(username, "");
  const isChatVisible = Boolean(
    typeof document !== "undefined" && document.querySelector(".app-shell"),
  );

  if (!safeName || isChatVisible) {
    hideCurrentUserBadge();
    return;
  }

  badge.textContent = `Currently logged in as: ${safeName}`;
  badge.classList.remove("is-hidden");
}
async function initApp() {
  const appRoot = document.querySelector("#app");

  if (!appRoot) {
    console.warn("App root element not found; cannot render chat UI.");
    return;
  }

  appRoot.innerHTML = "";
  resetState();
  updateCurrentUserBadge("");

  const backendURL = await resolveBackendURL();

  let user;

  try {
    user = await bootstrapUserSelection(appRoot, backendURL);
    updateCurrentUserBadge(user?.id ?? user?.name ?? user?.username ?? "");
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
    updateCurrentUserBadge(user?.id ?? user?.name ?? user?.username ?? "");
  } catch (error) {
    console.error("Failed to apply pet adjustments:", error);
  }

  let activePet = adjustmentResult.pet ?? selectActivePet(user);
  let evolutionDetail = adjustmentResult.evolution ?? null;
  let pendingMessages = Array.isArray(adjustmentResult.messages)
    ? adjustmentResult.messages
    : [];

  if (!activePet) {
    try {
      const refreshedUser = await promptForExistingTrainerPet(appRoot, backendURL, user.id);
      storeCachedUsername(refreshedUser.id ?? user.id);
      user = refreshedUser;
      updateCurrentUserBadge(user?.id ?? user?.name ?? user?.username ?? "");
      activePet = selectActivePet(user);
      evolutionDetail = null;
      pendingMessages = [];
    } catch (error) {
      console.error("Failed to create a new Pokémon for this trainer:", error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : "We couldn't create a Pokémon for you. Please try again.";

      appRoot.innerHTML = "";
      appRoot.appendChild(
        createElement("div", {
          className: "error-message",
          textContent: fallbackMessage,
        }),
      );
      return;
    }

    if (!activePet) {
      console.error("Trainer record was refreshed but still has no Pokémon attached.");
      appRoot.innerHTML = "";
      appRoot.appendChild(
        createElement("div", {
          className: "error-message",
          textContent: "We couldn't link a Pokémon to this trainer. Please try again.",
        }),
      );
      return;
    }
  }

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
    updateCurrentUserBadge(refreshedUser?.id ?? user.id ?? "");

    try {
      await initApp();
    } catch (error) {
      console.error("Failed to reload the chat after releasing the Pokémon:", error);
      throw error;
    }
  }

  async function handleLogout() {
    clearCachedUsername();
    updateCurrentUserBadge("");

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

  pendingMessages
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
  hideCurrentUserBadge();

  if (focusTarget) {
    focusTarget.focus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((error) => {
    console.error("Failed to initialize the chat UI:", error);
  });
});
