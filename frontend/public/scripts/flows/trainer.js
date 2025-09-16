import { promptForPetName, promptForUsername } from "../ui/prompts.js";
import {
  createTrainerPet,
  createUserRecord,
  fetchUserRecord,
  normalizeUserRecord,
  resolveErrorMessage,
} from "../services/api.js";
import {
  clearCachedUsername,
  loadCachedUsername,
  storeCachedUsername,
} from "../storage.js";

export async function promptForExistingTrainerPet(appRoot, backendURL, username) {
  let petName = "";
  let errorMessage = "";

  while (true) {
    petName = await promptForPetName(appRoot, { initialValue: petName, errorMessage });
    errorMessage = "";

    try {
      await createTrainerPet(backendURL, username, petName);
    } catch (error) {
      errorMessage = resolveErrorMessage(
        error,
        "Unable to create your Pokémon. Please try again.",
        "We couldn't reach the server to create your Pokémon. Please check your connection and try again.",
      );
      continue;
    }

    try {
      const refreshedUser = await fetchUserRecord(backendURL, username);

      if (refreshedUser) {
        return refreshedUser;
      }

      errorMessage = "We couldn't load your trainer. Please try again.";
    } catch (fetchError) {
      errorMessage = resolveErrorMessage(
        fetchError,
        "We couldn't load your trainer. Please try again.",
        "We couldn't load your trainer due to a network issue. Please check your connection and try again.",
      );
    }
  }
}

async function handleUserCreation(appRoot, backendURL, username) {
  let petName = "";
  let errorMessage = "";

  while (true) {
    petName = await promptForPetName(appRoot, { initialValue: petName, errorMessage });
    errorMessage = "";

    try {
      const createdUser = await createUserRecord(backendURL, username, petName);

      if (createdUser) {
        return createdUser;
      }
    } catch (error) {
      if (error && error.status === 409) {
        if (error.payload) {
          try {
            return normalizeUserRecord(error.payload);
          } catch (normalizeError) {
            console.error("Failed to normalize existing trainer:", normalizeError);
          }
        }

        try {
          const existingUser = await fetchUserRecord(backendURL, username);

          if (existingUser) {
            return existingUser;
          }

          errorMessage = "We couldn't load your trainer. Please try again.";
        } catch (fetchError) {
          errorMessage = resolveErrorMessage(
            fetchError,
            "We couldn't load your trainer. Please try again.",
            "We couldn't load your trainer due to a network issue. Please check your connection and try again.",
          );
          continue;
        }

        continue;
      }

      errorMessage = resolveErrorMessage(
        error,
        "Unable to create your Pokémon. Please try again.",
        "We couldn't reach the server to create your Pokémon. Please check your connection and try again.",
      );
      continue;
    }

    try {
      const createdUser = await fetchUserRecord(backendURL, username);

      if (createdUser) {
        return createdUser;
      }

      errorMessage = "We couldn't load your trainer. Please try again.";
    } catch (fetchError) {
      errorMessage = resolveErrorMessage(
        fetchError,
        "We couldn't load your trainer. Please try again.",
        "We couldn't load your trainer due to a network issue. Please check your connection and try again.",
      );
    }
  }
}

export async function bootstrapUserSelection(appRoot, backendURL) {
  let username = loadCachedUsername();
  let errorMessage = "";

  if (username) {
    try {
      const cachedUser = await fetchUserRecord(backendURL, username);

      if (cachedUser) {
        storeCachedUsername(cachedUser.id ?? username);
        return cachedUser;
      }

      errorMessage = "We couldn't find that trainer. Please create one.";
      clearCachedUsername();
    } catch (error) {
      errorMessage = resolveErrorMessage(
        error,
        "Unable to look up that trainer. Please try again.",
        "We couldn't connect to the trainer service. Please check your connection and try again.",
      );
    }
  }

  username = username || "";

  while (true) {
    username = await promptForUsername(appRoot, { initialValue: username, errorMessage });
    storeCachedUsername(username);
    errorMessage = "";

    let existingUser;

    try {
      existingUser = await fetchUserRecord(backendURL, username);
    } catch (error) {
      errorMessage = resolveErrorMessage(
        error,
        "Unable to look up that trainer. Please try again.",
        "We couldn't connect to the trainer service. Please check your connection and try again.",
      );
      continue;
    }

    if (existingUser) {
      storeCachedUsername(existingUser.id ?? username);
      return existingUser;
    }

    try {
      const createdUser = await handleUserCreation(appRoot, backendURL, username);

      if (createdUser) {
        storeCachedUsername(createdUser.id ?? username);
        return createdUser;
      }

      errorMessage = "We couldn't create the trainer. Please try again.";
    } catch (creationError) {
      errorMessage = resolveErrorMessage(
        creationError,
        "We couldn't create the trainer. Please try again.",
        "We couldn't reach the server to create the trainer. Please check your connection and try again.",
      );
    }
  }
}
