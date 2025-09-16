import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const placeholderPath = path.join(__dirname, "placeholder.json");

app.get("/placeholder.json", (_req, res) => {
  res.sendFile(placeholderPath);
});

app.use(express.static("public"));

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Frontend @ http://localhost:${port}`);
});
