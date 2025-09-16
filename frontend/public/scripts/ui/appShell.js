import { createElement } from "../dom.js";
import { buildChatSection } from "./chat.js";
import { buildProfileColumn } from "./profile.js";

export function buildAppShell({ user, pet, backendURL, evolution = null, onPetReleased }) {
  const profileColumn = buildProfileColumn({ user, pet, evolution });
  const { section: chatColumn, inputField } = buildChatSection({
    user,
    pet,
    backendURL,
    onPetReleased,
  });

  const root = createElement("div", {
    className: "app-shell",
    children: [profileColumn, chatColumn],
  });

  return { root, focusTarget: inputField };
}
