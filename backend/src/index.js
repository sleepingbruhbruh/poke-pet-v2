import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import { chat } from "./chat";

const app = express();

app.use(express.json());
app.use(cors());
app.post("/chat", chat)

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Backend @ http://localhost:${port}`);
});

mongoose.connect(process.env.MONGO_URL);
