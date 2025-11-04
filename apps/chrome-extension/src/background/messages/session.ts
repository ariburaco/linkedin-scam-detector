import type { Session } from "@acme/auth/types";
import type { PlasmoMessaging } from "@plasmohq/messaging";

import { extensionLoggerBackground } from "@/shared/loggers";
import * as sessionManager from "@/shared/sessionManager";


export interface SessionRequestBody {
  action:
    | "getSession"
    | "refreshSession"
    | "signOut"
    | "getCookies"
    | "signInEmail"
    | "signInAnonymous";
  email?: string;
  password?: string;
}

export interface SessionResponseBody {
  success: boolean;
  session?: Session | null;
  cookies?: string | null;
  error?: string;
}

// Define the handler for the "session" message
const handler: PlasmoMessaging.MessageHandler<
  SessionRequestBody,
  SessionResponseBody
> = async (req, res) => {
  const { action } = req.body ?? {};

  try {
    switch (action) {
      case "getSession": {
        // Try to get session from storage first
        let session = await sessionManager.getStoredSession();

        // If no session in storage, get from server
        if (!session) {
          extensionLoggerBackground.info(
            "No session in storage, fetching from server"
          );
          session = await sessionManager.getSession();
          if (session) {
            // Store the session
            await sessionManager.setSession(session);
            extensionLoggerBackground.info(
              "Session fetched and stored successfully"
            );
          } else {
            extensionLoggerBackground.info("No active session found");
          }
        } else {
          extensionLoggerBackground.info("Using session from storage");
        }

        res.send({
          success: true,
          session,
        });
        break;
      }

      case "refreshSession": {
        // Use the session manager to refresh the session
        extensionLoggerBackground.info("Refreshing session from server");
        const session = await sessionManager.refreshSession();

        res.send({
          success: true,
          session,
        });
        break;
      }

      case "signOut": {
        // Use the session manager to sign out
        extensionLoggerBackground.info("Signing out user");
        await sessionManager.signOut();

        res.send({
          success: true,
          session: null,
        });
        break;
      }

      case "getCookies": {
        // Get cookies using the session manager
        extensionLoggerBackground.info("Getting cookies");
        const cookies = await sessionManager.getCookies();
        await sessionManager.setCookies(cookies);

        res.send({
          success: true,
          cookies,
        });
        break;
      }

      case "signInEmail": {
        const { email, password } = req.body ?? {};
        if (!email || !password) {
          res.send({
            success: false,
            error: "Email and password are required",
          });
          return;
        }
        try {
          await sessionManager.signInEmail(email, password);
          res.send({
            success: true,
          });
        } catch (error) {
          extensionLoggerBackground.error(
            "Error signing in with email:",
            error
          );
          res.send({
            success: false,
            error: error.message,
          });
        }
        break;
      }

      case "signInAnonymous": {
        try {
          await sessionManager.signInAnonymous();
          res.send({
            success: true,
          });
        } catch (error) {
          extensionLoggerBackground.error(
            "Error signing in anonymously:",
            error
          );
          res.send({
            success: false,
            error: error.message,
          });
        }
        break;
      }

      default:
        extensionLoggerBackground.error(`Invalid action: ${action}`);
        res.send({
          success: false,
          error: "Invalid action",
        });
        break;
    }
  } catch (error) {
    extensionLoggerBackground.error(`Error processing ${action}:`, error);
    res.send({
      success: false,
      error: `Error processing ${action}: ${error.message || "Unknown error"}`,
    });
  }
};

export default handler;
