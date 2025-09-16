import User from "./userModel.js";

/** @type {import("express").RequestHandler} */
export const createUser = async (req, res) => {
  const { name, petName } = req.body ?? {};

  const sanitizedName =
    typeof name === "string" ? name.trim() : name !== undefined && name !== null ? String(name).trim() : "";

  if (!sanitizedName) {
    res.status(400).json({ message: "A trainer identifier is required." });
    return;
  }

  const existingUser = await User.findById(sanitizedName);

  if (existingUser) {
    res.status(409).json(existingUser);
    return;
  }

  const sanitizedPetName =
    typeof petName === "string"
      ? petName.trim()
      : petName !== undefined && petName !== null
        ? String(petName).trim()
        : "";

  if (!sanitizedPetName) {
    res.status(400).json({ message: "A Pokémon name is required to create a trainer." });
    return;
  }

  const user = new User({
    _id: sanitizedName,
    pets: [
      {
        name: sanitizedPetName,
        "talking-streak": 0,
      },
    ],
  });

  await user.save();

  res.status(201).json(user);
};

/** @type {import("express").RequestHandler} */
export const getUser = async (req, res) => {
  const { name } = req.params;
  const sanitizedName =
    typeof name === "string" ? name.trim() : name !== undefined && name !== null ? String(name).trim() : "";

  if (!sanitizedName) {
    res.sendStatus(404);
    return;
  }

  const user = await User.findById(sanitizedName);

  if (!user) {
    res.sendStatus(404);
    return;
  }

  res.status(200).json(user);
};

/** @type {import("express").RequestHandler} */
export const deleteUser = async (req, res) => {
  const { name } = req.params;
  const sanitizedName =
    typeof name === "string" ? name.trim() : name !== undefined && name !== null ? String(name).trim() : "";

  if (!sanitizedName) {
    res.sendStatus(204);
    return;
  }

  await User.findByIdAndDelete(sanitizedName);

  res.sendStatus(204);
};
