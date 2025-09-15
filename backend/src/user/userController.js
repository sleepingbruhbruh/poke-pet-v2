import User from "./userModel.js";

/** @type {import("express").RequestHandler} */
export const createUser = async (req, res) => {
  const { name } = req.body;
  const user = new User({ _id: name });
  await user.save();

  res.sendStatus(201);
};

/** @type {import("express").RequestHandler} */
export const getUser = async (req, res) => {
  const { name } = req.params;
  const user = await User.findById(name);

  res.status(200).json(user);
};

/** @type {import("express").RequestHandler} */
export const deleteUser = async (req, res) => {
  const { name } = req.params;
  await User.findByIdAndDelete(name);

  res.sendStatus(204);
};
