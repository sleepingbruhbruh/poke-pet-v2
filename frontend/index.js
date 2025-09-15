import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const app = express();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const placeholderPath = path.join(currentDir, "placeholder.json");

app.get("/placeholder.json", (_req, res) => {
  res.sendFile(placeholderPath);
});

app.use(express.static("public"));

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Frontend @ http://localhost:${port}`);
});
