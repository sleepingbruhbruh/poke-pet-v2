import { USERNAME_STORAGE_KEY } from "./config.js";
import { sanitizeIdentifier } from "./utils.js";

export function loadCachedUsername() {
  if (typeof localStorage === "undefined") {
    return "";
  }

  try {
    const rawValue = localStorage.getItem(USERNAME_STORAGE_KEY);
    return sanitizeIdentifier(rawValue, "");
  } catch (error) {
    console.warn("Failed to load cached username:", error);
    return "";
  }
}

export function storeCachedUsername(username) {
  if (typeof localStorage === "undefined") {
    return;
  }

  const sanitized = sanitizeIdentifier(username, "");

  try {
    if (sanitized) {
      localStorage.setItem(USERNAME_STORAGE_KEY, sanitized);
    } else {
      localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to store cached username:", error);
  }
}

export function clearCachedUsername() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(USERNAME_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear cached username:", error);
  }
}
