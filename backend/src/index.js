import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();

app.use(express.json());
app.use(cors());

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Backend @ http://localhost:${port}`);
});

mongoose.connect(process.env.MONGO_URL);
