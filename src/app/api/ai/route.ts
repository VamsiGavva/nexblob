import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

const PROMPTS: Record<string, string> = {
  explain: `You are a JSON expert. Analyze the provided JSON and give a clear, concise explanation of:
1. What this data represents
2. Its structure (array, object, nested depth)
3. Key fields and their purpose
4. Any notable patterns or relationships
Be specific and practical. Use plain language.`,

  typescript: `You are a TypeScript expert. Generate TypeScript interfaces for the provided JSON data.
- Use PascalCase for interface names
- Make optional fields that appear nullable or missing
- Include JSDoc comments for complex fields
- Export each interface
- Output only the TypeScript code, no explanation.`,

  sql: `You are a SQL expert. Convert the provided JSON to SQL:
1. CREATE TABLE statement with appropriate column types
2. INSERT statements for the data (max 10 rows)
3. Use SQLite-compatible syntax (TEXT, INTEGER, REAL, BLOB, NULL).
Output only the SQL, no explanation.`,

  sample: `You are a data engineer. Generate 5 new sample data rows that match the schema and realistic values of the provided JSON.
- Match field names exactly
- Use realistic, varied values
- Output as valid JSON array
Output only the JSON, no explanation.`,

  chat: `You are an expert data engineer and query specialist.
Analyze the provided JSON document and write queries, aggregations, or code (such as SQL, MongoDB aggregation pipelines, JavaScript map-reduce/filters, Python/pandas, etc.) as requested by the user.
- Provide clean, optimized, and ready-to-run queries/code blocks.
- Keep explanations clear and concise.
- Refer to the keys and structure of the JSON document accurately.`,
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action?: string;
      content: string;
      messages?: Array<{ role: "user" | "model"; content: string }>;
    };
    const action = body.action || "chat";
    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    // Get Gemini key from Cloudflare context env
    let cfEnv: any = {};
    try {
      const cf = await getCloudflareContext({ async: true });
      cfEnv = cf.env;
    } catch (e) {
      console.warn("Could not get Cloudflare context:", e);
    }

    const apiKey = cfEnv.GEMINI_API_KEY
      ?? cfEnv.ANTHROPIC_API_KEY
      ?? process.env.GEMINI_API_KEY
      ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json({
        result: `[AI not configured] Add GEMINI_API_KEY to your environment to enable AI features.\n\nAction: ${action}\nContent preview: ${body.content.slice(0, 200)}…`,
      });
    }

    // Format contents for Gemini (either single-turn or multi-turn chat)
    let contents = [];
    if (body.messages && body.messages.length > 0) {
      contents = body.messages.map((m, idx) => {
        let text = m.content;
        if (idx === 0) {
          // Inject JSON context in the first message of the conversation
          text = `Here is the JSON data:\n\`\`\`json\n${body.content.slice(0, 12000)}\n\`\`\`\n\nCommand/Question: ${m.content}`;
        }
        return {
          role: m.role === "model" ? "model" : "user",
          parts: [{ text }],
        };
      });
    } else {
      contents = [
        {
          role: "user",
          parts: [
            {
              text: `Here is the JSON data:\n\`\`\`json\n${body.content.slice(0, 16000)}\n\`\`\``,
            },
          ],
        },
      ];
    }

    // List of models to try in sequence in case of transient 503/429 errors
    const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
    let response: Response | null = null;
    let lastError = "";

    for (const model of models) {
      let retries = 2;
      while (retries >= 0) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents,
                systemInstruction: {
                  parts: [
                    {
                      text: systemPrompt,
                    },
                  ],
                },
              }),
            }
          );

          if (res.ok) {
            response = res;
            break;
          }

          const errText = await res.text();
          lastError = `Model ${model} returned status ${res.status}: ${errText}`;

          // If the error is a transient rate-limit or service overload, retry after a short delay
          if ((res.status === 503 || res.status === 429) && retries > 0) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (3 - retries)));
            continue;
          }
          break;
        } catch (e) {
          lastError = (e as Error).message;
          if (retries > 0) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (3 - retries)));
            continue;
          }
          break;
        }
      }
      if (response) break;
    }

    if (!response) {
      return Response.json(
        { error: `Gemini API error: All models failed. Last error: ${lastError}` },
        { status: 500 }
      );
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      error?: {
        message: string;
      };
    };

    if (data.error) {
      return Response.json({ error: `Gemini API error: ${data.error.message}` }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return Response.json({ result: text });
  } catch (err) {
    console.error("[POST /api/ai]", err);
    return Response.json({ error: "AI request failed: " + (err as Error).message }, { status: 500 });
  }
}
