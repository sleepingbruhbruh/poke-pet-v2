import { createElement } from "../dom.js";
import { buildChatSection } from "./chat.js";
import { buildProfileColumn } from "./profile.js";

export function buildAppShell({ user, pet, backendURL }) {
  const profileColumn = buildProfileColumn({ user, pet });
  const { section: chatColumn, inputField } = buildChatSection({ user, pet, backendURL });

  const root = createElement("div", {
    className: "app-shell",
    children: [profileColumn, chatColumn],
  });

  return { root, focusTarget: inputField };
}
