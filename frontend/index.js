import express from "express";
import "dotenv/config";

const app = express();

app.use(express.static("public"));

const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`Frontend @ http://localhost:${port}`);
});
