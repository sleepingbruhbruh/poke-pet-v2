import fs from "node:fs";
import dotenv from "dotenv";

const props = dotenv.parse(fs.readFileSync(".env"));
const injection = Object.entries(props).map(([key, value]) => `export const ${key} = "${value}";\n`).join("");
fs.writeFileSync("public/scripts/injected.js", injection);
