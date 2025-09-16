import User from "../userModel.js";

/** @type {import("express").RequestHandler} */
export const listPets = async (req, res) => {
  const { name } = req.params;
  const user = await User.findById(name);

  res.status(200).json(user.pets);
};

/** @type {import("express").RequestHandler} */
export const createPet = async (req, res) => {
  const { name } = req.params;
  const payload = req.body ?? {};
  const rawName =
    typeof payload.name === "string"
      ? payload.name.trim()
      : payload.name !== undefined && payload.name !== null
        ? String(payload.name).trim()
        : "";

  if (!rawName) {
    res.status(400).json({ message: "A Pokémon name is required." });
    return;
  }

  const stageNumber = Number(payload.stage);
  const friendshipNumber = Number(payload.friendship);
  const streakNumber = Number(payload["talking-streak"] ?? payload.talkingStreak);
  const resolvedStage = Number.isFinite(stageNumber)
    ? Math.max(1, Math.min(3, Math.round(stageNumber)))
    : 1;
  const resolvedFriendship = Number.isFinite(friendshipNumber)
    ? Math.max(0, Math.min(100, Math.round(friendshipNumber)))
    : 50;
  const resolvedStreak = Number.isFinite(streakNumber) && streakNumber >= 0
    ? Math.round(streakNumber)
    : 0;

  let resolvedLastChatted = new Date();

  if (payload.lastChatted !== undefined && payload.lastChatted !== null) {
    const parsed = new Date(payload.lastChatted);

    if (!Number.isNaN(parsed.getTime())) {
      resolvedLastChatted = parsed;
    }
  }

  const newPet = {
    name: rawName,
    stage: resolvedStage,
    friendship: resolvedFriendship,
    lastChatted: resolvedLastChatted,
    context: typeof payload.context === "string" ? payload.context : undefined,
    "talking-streak": resolvedStreak,
  };

  const user = await User.findByIdAndUpdate(name, { $push: { pets: newPet } }, { new: true });

  res.status(200).json(user.pets);
};

/** @type {import("express").RequestHandler} */
export const updatePet = async (req, res) => {
  const { name, id } = req.params;
  const payload = req.body ?? {};
  const rawName =
    typeof payload.name === "string"
      ? payload.name.trim()
      : payload.name !== undefined && payload.name !== null
        ? String(payload.name).trim()
        : "";

  if (!rawName) {
    res.status(400).json({ message: "A Pokémon name is required." });
    return;
  }

  const stageNumber = Number(payload.stage);
  const friendshipNumber = Number(payload.friendship);
  const streakNumber = Number(payload["talking-streak"] ?? payload.talkingStreak);
  const resolvedStage = Number.isFinite(stageNumber)
    ? Math.max(1, Math.min(3, Math.round(stageNumber)))
    : 1;
  const resolvedFriendship = Number.isFinite(friendshipNumber)
    ? Math.max(0, Math.min(100, Math.round(friendshipNumber)))
    : 50;
  const resolvedStreak = Number.isFinite(streakNumber) && streakNumber >= 0
    ? Math.round(streakNumber)
    : 0;

  let resolvedLastChatted = new Date();

  if (payload.lastChatted !== undefined && payload.lastChatted !== null) {
    const parsed = new Date(payload.lastChatted);

    if (!Number.isNaN(parsed.getTime())) {
      resolvedLastChatted = parsed;
    }
  }

  const updatedPet = {
    _id: payload._id ?? id,
    name: rawName,
    stage: resolvedStage,
    friendship: resolvedFriendship,
    lastChatted: resolvedLastChatted,
    context: typeof payload.context === "string" ? payload.context : undefined,
    "talking-streak": resolvedStreak,
  };

  const user = await User.findOneAndUpdate(
    { _id: name, "pets._id": id },
    { $set: { "pets.$": updatedPet } },
    { new: true },
  );

  res.status(200).json(user.pets);
};

/** @type {import("express").RequestHandler} */
export const deletePet = async (req, res) => {
  const { name, id } = req.params;
  await User.findByIdAndUpdate(name, { $pull: { pets: { _id: id } }});

  res.sendStatus(204);
};
