import Config from "../../../common/config";

export interface LumenPrompt {
    system: string;
    user: string;
}

export function isLumenConfigured(): boolean {
    return Boolean(Config.LUMEN_API_KEY && Config.LUMEN_BASE_URL && Config.LUMEN_MODEL);
}

/**
 * Sends one chat prompt to Lumen and returns the text of the reply.
 *
 * ASSUMPTION TO CONFIRM: Lumen's real API shape is not known. This assumes an OpenAI-compatible
 * chat completions API: POST `${LUMEN_BASE_URL}/chat/completions` with a Bearer key, body
 * `{ model, messages }`, reply `{ choices: [{ message: { content } }] }`.
 * If Lumen differs, change only this file.
 */
export async function requestLumenCompletion(prompt: LumenPrompt): Promise<string> {
    const response = await fetch(`${Config.LUMEN_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Config.LUMEN_API_KEY}`,
        },
        body: JSON.stringify({
            model: Config.LUMEN_MODEL,
            temperature: 0,
            messages: [
                { role: "system", content: prompt.system },
                { role: "user", content: prompt.user },
            ],
        }),
    });
    if (!response.ok) {
        throw new Error(`Lumen request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
        throw new Error("Lumen reply had no message content");
    }
    return content;
}
