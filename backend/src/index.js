import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRouter from "./user/userRouter.js"
import "dotenv/config";
import { chat } from "./chat";

const app = express();

app.use(express.json());
app.use(cors());
app.post("/chat", chat)

app.use("/users", userRouter);

app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof mongoose.Error.ValidationError) {
    res.sendStatus(400);
  } else if (err instanceof mongoose.Error.DocumentNotFoundError) {
    res.sendStatus(404);
  } else {
    res.sendStatus(500);
  }
});

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Backend @ http://localhost:${port}`);
});

mongoose.connect(process.env.MONGO_URL);
