import express from "express";
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

const PORT = 3221;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend Server ready at http://localhost:${PORT}`);
});
