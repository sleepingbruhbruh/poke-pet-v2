import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRouter from "./user/userRouter.js";
import { chat } from "./chat.js";
import "dotenv/config";

class ServiceUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

const app = express();

app.use(express.json());
app.use(cors());

const ensureDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    next(new ServiceUnavailableError("Database connection is not currently available."));
    return;
  }

  next();
};

app.use("/users", ensureDatabaseConnection, userRouter);
app.post("/chat", chat);

app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof mongoose.Error.ValidationError) {
    res.sendStatus(400);
  } else if (err instanceof mongoose.Error.DocumentNotFoundError) {
    res.sendStatus(404);
  } else if (err instanceof ServiceUnavailableError) {
    res.status(503).json({ message: err.message });
  } else {
    res.sendStatus(500);
  }
});

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
  console.error("The MONGO_URL environment variable must be configured before starting the backend.");
  process.exit(1);
}

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB connection lost. Incoming requests that require the database will be rejected until a reconnection succeeds.");
});

mongoose.connection.on("error", (connectionError) => {
  console.error("MongoDB connection error:", connectionError);
});

async function startServer() {
  try {
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
    });

    app.listen(port, () => {
      console.log(`Backend @ http://localhost:${port}`);
    });
  } catch (connectionError) {
    console.error("Failed to establish an initial connection to MongoDB.", connectionError);
    process.exit(1);
  }
}

startServer();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    try {
      await mongoose.connection.close();
    } catch (closeError) {
      console.error("Error while closing the MongoDB connection:", closeError);
    } finally {
      process.exit(0);
    }
  });
}
