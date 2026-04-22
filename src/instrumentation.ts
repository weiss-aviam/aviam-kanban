export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Force Zod validation of process.env at server boot. If a required
    // secret is missing or malformed, the process exits with a clear error
    // instead of failing later inside a request handler.
    await import("./lib/env");
  }
}
