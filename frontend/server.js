import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const placeholderPath = path.join(currentDir, "placeholder.json");

app.get("/placeholder.json", (_req, res) => {
  res.sendFile(placeholderPath);
});

app.use(express.static("public"));

const PORT = 3221;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend Server ready at http://localhost:${PORT}`);
});
