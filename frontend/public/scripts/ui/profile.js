import { createElement } from "../dom.js";
import { getStageDetail, selectActivePet } from "../pets.js";
import { clampFriendship, getTalkingStreakValue, sanitizeIdentifier } from "../utils.js";

function createInfoRow(label, value, options = {}) {
  const { valueAttributes = {} } = options;

  return createElement("div", {
    className: "info-row",
    children: [
      createElement("span", { className: "info-label", textContent: label }),
      createElement("span", {
        className: "info-value",
        textContent: value,
        attributes: valueAttributes,
      }),
      createElement("span", { className: "info-value", textContent: value }),
    ],
  });
}

function buildFriendshipSection(friendshipValue) {
  const clampedValue = clampFriendship(friendshipValue);

  const wrapper = createElement("div", { className: "friendship-wrapper" });
  const header = createElement("div", {
    className: "info-row",
    children: [
      createElement("span", { className: "info-label", textContent: "Friendship" }),
      createElement("span", {
        className: "friendship-value",
        textContent: `${clampedValue}/100`,
        attributes: { "data-info": "friendship-score" },
      }),
    ],
  });
  const bar = createElement("div", { className: "friendship-bar" });
  const fill = createElement("div", {
    className: "friendship-bar-fill",
    attributes: { "data-info": "friendship-progress" },
  });
  fill.style.width = `${clampedValue}%`;
  bar.appendChild(fill);
  wrapper.appendChild(header);
  wrapper.appendChild(bar);

  return wrapper;
}

function resolveLastChattedDisplay(lastChattedRaw) {
  if (typeof lastChattedRaw === "string" && lastChattedRaw.trim()) {
    const trimmed = lastChattedRaw.trim();
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().split("T")[0];
  }

  if (lastChattedRaw instanceof Date) {
    return lastChattedRaw.toISOString().split("T")[0];
  }

  if (lastChattedRaw !== undefined && lastChattedRaw !== null) {
    const parsed = new Date(lastChattedRaw);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return "—";
}

export function buildProfileColumn({ user, pet, evolution = null }) {
  const column = createElement("div", { className: "profile-column" });
  const activePet = pet ?? selectActivePet(user);
  const stageDetail = getStageDetail(activePet?.stage);
  const activePetId = sanitizeIdentifier(activePet?._id ?? activePet?.id, "");
  const evolutionPetId = sanitizeIdentifier(evolution?.petId, "");
  const shouldShowEvolution =
    Boolean(activePet && evolution) && (!activePetId || !evolutionPetId || activePetId === evolutionPetId);

  const petName =
    activePet && typeof activePet.name === "string" && activePet.name.trim()
      ? activePet.name.trim()
      : "Your Companion";

  let avatarSrc = stageDetail.image;
  let avatarSpecies = stageDetail.species;

  if (shouldShowEvolution) {
    const preImage = typeof evolution.preImage === "string" && evolution.preImage.trim() ? evolution.preImage : null;
    const preSpecies = typeof evolution.preSpecies === "string" && evolution.preSpecies.trim()
      ? evolution.preSpecies.trim()
      : null;

    if (preImage) {
      avatarSrc = preImage;
    }

    if (preSpecies) {
      avatarSpecies = preSpecies;
    }
  }

  const avatar = createElement("img", {
    className: "pet-avatar",
    attributes: {
      src: avatarSrc,
      alt: `${avatarSpecies} avatar`,
    },
  });

  const petCardChildren = [
    avatar,
    createElement("div", { className: "pet-name", textContent: petName }),
  ];

  if (!activePet) {
    petCardChildren.push(
      createElement("div", {
        className: "info-value",
        textContent: "Add a pet to begin chatting.",
      }),
    );
  }

  column.appendChild(
    createElement("div", {
      className: "card pet-card",
      children: petCardChildren,
    }),
  );

  const speciesFromPet =
    activePet && typeof activePet.species === "string" && activePet.species.trim()
      ? activePet.species.trim()
      : stageDetail.species;

  const ownerId = sanitizeIdentifier(user.id, "Player");

  const lastChattedDisplay = resolveLastChattedDisplay(activePet?.lastChatted);

  const infoRows = [
    createInfoRow("Species", speciesFromPet),
    createInfoRow("Owner", ownerId),
    createInfoRow("Last-chatted", lastChattedDisplay, {
      valueAttributes: { "data-info": "last-chatted" },
    }),
  ];

  const talkingStreakDisplay = `${getTalkingStreakValue(activePet)} days`;
  infoRows.push(createInfoRow("Talking Streak", talkingStreakDisplay));

  const infoCardChildren = [
    createElement("div", { className: "info-grid", children: infoRows }),
    buildFriendshipSection(activePet?.friendship ?? 0),
  ];

  column.appendChild(
    createElement("div", {
      className: "card info-card",
      children: infoCardChildren,
    }),
  );

  if (shouldShowEvolution && typeof window !== "undefined" && typeof window.alert === "function") {
    const postSpecies =
      typeof evolution.postSpecies === "string" && evolution.postSpecies.trim()
        ? evolution.postSpecies.trim()
        : stageDetail.species;
    const postImage =
      typeof evolution.postImage === "string" && evolution.postImage.trim()
        ? evolution.postImage
        : stageDetail.image;

    const runEvolutionSequence = () => {
      window.alert("Your Pokemon is evolving!?");
      window.alert(`Congratulations, your pokemon has evolved into ${postSpecies}`);
      avatar.setAttribute("src", postImage);
      avatar.setAttribute("alt", `${postSpecies} avatar`);
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        window.setTimeout(runEvolutionSequence, 0);
      });
    } else {
      window.setTimeout(runEvolutionSequence, 0);
    }
  }

  return column;
}
