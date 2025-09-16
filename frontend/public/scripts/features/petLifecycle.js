import { DEFAULT_STAGE_DETAIL, MS_PER_DAY, TALKING_STREAK_FIELD } from "../config.js";
import { selectActivePet, getStageDetail } from "../pets.js";
import {
  deleteTrainerPet,
  fetchUserRecord,
  updateTrainerPet,
} from "../services/api.js";
import { promptForExistingTrainerPet } from "../flows/trainer.js";
import { showRunAwayPrompt } from "../ui/prompts.js";
import { storeCachedUsername } from "../storage.js";
import {
  clampFriendship,
  getTalkingStreakValue,
  sanitizeIdentifier,
} from "../utils.js";

export async function applyPetDailyAdjustments({ appRoot, backendURL, user }) {
  const activePet = selectActivePet(user);

  if (!activePet) {
    return { user, pet: null, messages: [] };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const petIdentifier = sanitizeIdentifier(activePet._id ?? activePet.id, "");

  if (!petIdentifier) {
    console.warn("Unable to update pet without identifier.");
    return { user, pet: activePet, messages: [] };
  }

  let lastChattedDate = null;

  if (activePet.lastChatted instanceof Date) {
    lastChattedDate = activePet.lastChatted;
  } else if (typeof activePet.lastChatted === "string" && activePet.lastChatted.trim()) {
    const parsed = new Date(activePet.lastChatted.trim());

    if (!Number.isNaN(parsed.getTime())) {
      lastChattedDate = parsed;
    }
  } else if (activePet.lastChatted !== undefined && activePet.lastChatted !== null) {
    const parsed = new Date(activePet.lastChatted);

    if (!Number.isNaN(parsed.getTime())) {
      lastChattedDate = parsed;
    }
  }

  let dayDifference = 0;

  if (lastChattedDate) {
    const lastChattedStart = new Date(lastChattedDate);
    lastChattedStart.setHours(0, 0, 0, 0);
    const diffMs = todayStart.getTime() - lastChattedStart.getTime();

    if (diffMs > 0) {
      dayDifference = Math.floor(diffMs / MS_PER_DAY);
    }
  }

  const updates = {};
  const originalFriendship = clampFriendship(activePet.friendship);
  let newFriendship = originalFriendship;
  let newStreak = getTalkingStreakValue(activePet);
  const stageValue = Number(activePet.stage);
  const stageBefore = Number.isFinite(stageValue) ? stageValue : 1;
  let stageAfter = stageBefore;
  let evolutionMessage = null;

  if (originalFriendship <= 0) {
    await deleteTrainerPet(backendURL, user.id, petIdentifier);
    await showRunAwayPrompt(appRoot, activePet.name);
    const refreshedUser = await promptForExistingTrainerPet(appRoot, backendURL, user.id);
    storeCachedUsername(refreshedUser.id ?? user.id);
    const refreshedPet = selectActivePet(refreshedUser);

    return { user: refreshedUser, pet: refreshedPet ?? null, messages: [] };
  }

  if (dayDifference === 1) {
    newStreak += 1;
    updates[TALKING_STREAK_FIELD] = newStreak;
  } else if (dayDifference > 1) {
    if (newStreak !== 0) {
      newStreak = 0;
      updates[TALKING_STREAK_FIELD] = 0;
    }
  }

  if (dayDifference >= 3) {
    const penalty = dayDifference * 10;
    const decreasedFriendship = Math.max(0, newFriendship - penalty);

    if (decreasedFriendship !== newFriendship) {
      newFriendship = decreasedFriendship;
      updates.friendship = newFriendship;
    }
  }

  if (stageBefore < 3 && newStreak >= 7) {
    stageAfter = stageBefore + 1;
    updates.stage = stageAfter;
    updates[TALKING_STREAK_FIELD] = 0;

    const previousStageDetail = getStageDetail(stageBefore) ?? DEFAULT_STAGE_DETAIL;
    const nextStageDetail = getStageDetail(stageAfter) ?? previousStageDetail;
    const preSpecies =
      previousStageDetail && typeof previousStageDetail.species === "string" && previousStageDetail.species.trim()
        ? previousStageDetail.species.trim()
        : DEFAULT_STAGE_DETAIL.species;
    const postSpecies =
      nextStageDetail && typeof nextStageDetail.species === "string" && nextStageDetail.species.trim()
        ? nextStageDetail.species.trim()
        : preSpecies;
    const companionName = sanitizeIdentifier(activePet.name, "Your companion");

    evolutionMessage = `${companionName} has evolved from ${preSpecies} to ${postSpecies}!`;
  }

  if (Object.keys(updates).length === 0) {
    return { user, pet: activePet, messages: [] };
  }

  if (updates.friendship !== undefined && updates.friendship <= 0) {
    await deleteTrainerPet(backendURL, user.id, petIdentifier);
    await showRunAwayPrompt(appRoot, activePet.name);
    const refreshedUser = await promptForExistingTrainerPet(appRoot, backendURL, user.id);
    storeCachedUsername(refreshedUser.id ?? user.id);
    const refreshedPet = selectActivePet(refreshedUser);

    return { user: refreshedUser, pet: refreshedPet ?? null, messages: [] };
  }

  const payload = { ...activePet, ...updates };

  await updateTrainerPet(backendURL, user.id, petIdentifier, payload);

  let refreshedUser = null;

  try {
    refreshedUser = await fetchUserRecord(backendURL, user.id);
  } catch (error) {
    console.error("Failed to refresh trainer after updating pet:", error);
  }

  let resolvedUser = refreshedUser;

  if (!resolvedUser) {
    const updatedPets = Array.isArray(user.pets)
      ? user.pets.map((pet) => {
          if (!pet || typeof pet !== "object") {
            return pet;
          }

          const candidateId = sanitizeIdentifier(pet._id ?? pet.id, "");

          if (candidateId && candidateId === petIdentifier) {
            return { ...pet, ...updates };
          }

          return pet;
        })
      : user.pets;

    resolvedUser = { ...user, pets: updatedPets };
  }

  const refreshedPet = selectActivePet(resolvedUser) ?? activePet;
  const messages = [];

  if (evolutionMessage) {
    messages.push({ sender: "System", message: evolutionMessage });
  }

  storeCachedUsername((resolvedUser && resolvedUser.id) ?? user.id);

  return { user: resolvedUser, pet: refreshedPet, messages };
}
