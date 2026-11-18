import { z } from "zod/v4";

import { defineCommand } from "../types";

const autoNameSessionSchema = z
  .object({
    session_id: z.string().describe("Id of the session to rename."),
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Ignore the user_renamed_at flag and force a new auto-generated title.",
      ),
    dry_run: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Compute the title but do not persist it. Returns the proposed title.",
      ),
    heuristic_only: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Skip the dedicated naming model and use only the local heuristic.",
      ),
    endpoint: z
      .string()
      .url()
      .optional()
      .describe(
        "HTTP endpoint for the dedicated lightweight naming model (OpenAI-compatible /v1/chat/completions).",
      ),
    model: z
      .string()
      .optional()
      .describe(
        "Model identifier to use at the dedicated endpoint (e.g. nimble, jev).",
      ),
  })
  .strict();

interface TitleResult {
  ok: true;
  old_title: string;
  new_title: string;
  used_model: boolean;
  skipped?: never;
}

interface SkippedResult {
  skipped: "manual_rename" | "no_signal";
  reason: string;
}

type AutoNameResult = TitleResult | SkippedResult;

// Simple heuristic: extract first user message, pick dominant verb+object
function heuristicTitle(messages: { role: string; text: string }[]): string | null {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return null;

  const text = firstUser.text.toLowerCase().trim();

  // Ignore obvious system prompt noise
  if (text.startsWith("you are ") || text.includes("implementing one")) {
    return null;
  }

  // Very naive verb+object extraction for demo quality
  const verbs = ["fix", "add", "implement", "build", "plan", "setup", "create", "update", "debug", "answer"];
  const foundVerb = verbs.find((v) => text.includes(v));

  if (!foundVerb) return null;

  // Take first 6-8 words after the verb as object, title case
  const afterVerb = text.split(foundVerb)[1]?.trim().split(/\s+/).slice(0, 6).join(" ") || "";
  if (!afterVerb) return null;

  const title = `${foundVerb.charAt(0).toUpperCase() + foundVerb.slice(1)} ${afterVerb}`
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();

  return title.length >= 4 && title.length <= 60 ? title : null;
}

async function callDedicatedModel(
  endpoint: string,
  model: string,
  messages: { role: string; text: string }[],
): Promise<string | null> {
  try {
    const prompt = `You are a session title generator. Read the conversation and output ONLY a 2-6 word title in sentence case that captures the user's main intent. No quotes, no explanation.\n\nConversation:\n${messages
      .slice(0, 5)
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n")}`;

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    // Clean up common model artifacts
    return raw.replace(/^["']|["']$/g, "").slice(0, 60);
  } catch {
    return null;
  }
}

export const autoNameSessionCommand = defineCommand({
  effect: "update",
  visibility: "immediate",
  destructive: false,
  summary: "Auto-generate a concise session title",
  description:
    "Generate and apply a task-specific title to a chat session using a fast heuristic, optionally escalating to a dedicated lightweight model. Respects manual renames unless --force is passed.",
  helpFooter: `Examples:
  berdctl session auto-name --session-id <id>
  berdctl session auto-name --session-id <id> --dry-run
  berdctl session auto-name --session-id <id> --force --endpoint http://localhost:11434 --model nimble

Result:
  {"ok": true, "old_title": "...", "new_title": "...", "used_model": false} or {"skipped": "manual_rename"}`,
  schema: autoNameSessionSchema,
  execute: async (args): Promise<AutoNameResult> => {
    const [
      { lastSessionMessages },
      { loadSessionForBerdctl, requireSession, sessionMetadata },
      { updateSessionTitle },
    ] = await Promise.all([
      import("@/shared/api/sessionSearch"),
      import("../runtime/sessions"),
      import("@/features/chat/stores/chatSessionOperations"),
    ]);

    await loadSessionForBerdctl(args.session_id);
    const session = requireSession(args.session_id);

    // Guard: respect manual renames
    const meta = sessionMetadata(session);
    if (meta.user_renamed_at && !args.force) {
      return { skipped: "manual_rename", reason: "Session was manually renamed" };
    }

    const rawMessages = await lastSessionMessages(args.session_id, 6);
    const messages = rawMessages.map((m) => ({ role: m.role ?? "user", text: m.text }));

    if (messages.length === 0) {
      return { skipped: "no_signal", reason: "No user messages yet" };
    }

    let newTitle: string | null = null;
    let usedModel = false;

    // Tier 1: dedicated model if endpoint provided and not heuristic_only
    if (!args.heuristic_only && args.endpoint && args.model) {
      newTitle = await callDedicatedModel(args.endpoint, args.model, messages);
      usedModel = !!newTitle;
    }

    // Tier 0: heuristic fallback
    if (!newTitle) {
      newTitle = heuristicTitle(messages);
    }

    if (!newTitle) {
      return { skipped: "no_signal", reason: "Heuristic could not extract clear intent" };
    }

    const oldTitle = meta.title || "New chat";

    if (!args.dry_run) {
      await updateSessionTitle(args.session_id, newTitle);
      // TODO: emit event for Sonner toast (bottom-right)
      // TODO: set user_renamed_at = false (auto)
    }

    return {
      ok: true,
      old_title: oldTitle,
      new_title: newTitle,
      used_model: usedModel,
    };
  },
});