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
  const user = await User.findByIdAndUpdate(name, { $push: { pets: req.body } }, { new: true });

  res.status(200).json(user.pets);
};

/** @type {import("express").RequestHandler} */
export const updatePet = async (req, res) => {
  const { name, id } = req.params;
  const user = await User.findOneAndUpdate({ _id: name, "pets._id": id }, { $set: { "pets.$": req.body } }, { new: true });

  res.status(200).json(user.pets);
};

/** @type {import("express").RequestHandler} */
export const deletePet = async (req, res) => {
  const { name, id } = req.params;
  await User.findByIdAndUpdate(name, { $pull: { pets: { _id: id } }});

  res.sendStatus(204);
};
