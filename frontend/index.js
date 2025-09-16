import express from "express";
import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const placeholderPath = join(__dirname, "placeholder.json");

app.get("/placeholder.json", (_req, res) => {
  res.sendFile(placeholderPath);
});

app.use(express.static("public"));

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Frontend @ http://localhost:${port}`);
});
