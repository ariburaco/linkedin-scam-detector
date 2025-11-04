import type { PlasmoMessaging } from "@plasmohq/messaging";
import { Storage } from "@plasmohq/storage";

export interface RequestBody {
  action: "get" | "increment";
}

export interface ResponseBody {
  count: number;
  error?: string;
}

// Define the handler for the "count" message
const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  const storage = new Storage({ area: "local" });
  const { action } = req.body ?? {};

  if (action === "get") {
    // Get count from storage or return default
    const storedCount = (await storage.get<number>("count")) || 42;

    // Return current count
    res.send({
      count: storedCount,
    });
  } else if (action === "increment") {
    // Get current count from storage
    const currentCount = (await storage.get<number>("count")) || 42;

    // Increment and save
    const newCount = currentCount + 1;
    await storage.set("count", newCount);

    // Return new count
    res.send({
      count: newCount,
    });
  } else {
    // Invalid action
    res.send({
      count: 0,
      error: "Invalid action",
    });
  }
};

export default handler;
