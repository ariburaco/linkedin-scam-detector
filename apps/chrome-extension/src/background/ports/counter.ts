import type { PlasmoMessaging } from "@plasmohq/messaging";
import { Storage } from "@plasmohq/storage";

export interface RequestBody {
  action: "get" | "increment" | "decrement" | "reset";
  value?: number;
}

export interface ResponseBody {
  count: number;
  lastUpdate: string;
  error?: string;
}

// Initialize storage
const storage = new Storage({ area: "local" });

// Port handler for live counter updates
const handler: PlasmoMessaging.PortHandler<RequestBody, ResponseBody> = async (
  req,
  res
) => {
  try {
    const { action, value } = req.body ?? {};
    let count = (await storage.get<number>("count")) || 0;

    switch (action) {
      case "get":
        // Just return the current count
        break;

      case "increment":
        // Increment by 1 or by specified value
        count += value !== undefined ? value : 1;
        await storage.set("count", count);
        break;

      case "decrement":
        // Decrement by 1 or by specified value
        count -= value !== undefined ? value : 1;
        await storage.set("count", count);
        break;

      case "reset":
        // Reset to 0 or specified value
        count = value !== undefined ? value : 0;
        await storage.set("count", count);
        break;

      default:
        res.send({
          count,
          lastUpdate: new Date().toISOString(),
          error: "Invalid action",
        });
        return;
    }

    // Send response
    res.send({
      count,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in counter port handler:", error);
    res.send({
      count: 0,
      lastUpdate: new Date().toISOString(),
      error: "Internal error",
    });
  }
};

export default handler;
