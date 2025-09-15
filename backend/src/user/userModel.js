import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  pets: {
    type: [{
      name: {
        type: String,
        required: true,
      },
      stage: {
        type: Number,
        required: true,
        default: () => 1,
      },
      friendship: {
        type: Number,
        required: true,
        default: () => 50,
      },
      lastChatted: {
        type: Date,
        required: true,
        default: Date.now,
      },
      context: {
        type: String,
      },
    }],
    required: true,
    default: () => [],
  },
});

const User = mongoose.model("User", userSchema);

export default User;
