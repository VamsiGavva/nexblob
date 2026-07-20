import { getCloudflareContext } from "@opennextjs/cloudflare";



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
      activeTable?: string | null;
      activeConnectionId?: string | null;
    };
    const action = body.action || "chat";
    let systemPrompt = PROMPTS[action];
    if (!systemPrompt) {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    if (action === "chat") {
      if (body.activeConnectionId && body.activeTable) {
        systemPrompt += `\n\nCRITICAL CONTEXT: The user is currently connected to a Cloudflare D1 Database (SQLite compatible) and viewing the table named "${body.activeTable}". 
Any SQL queries you write MUST target this SQLite table "${body.activeTable}" instead of placeholders like "my_table". Always use SQLite-compatible syntax (such as CAST(x AS INTEGER), SQLite date/time functions, etc.).`;
      } else {
        systemPrompt += `\n\nCRITICAL CONTEXT: The user is currently querying a local JSON document. Any SQL queries you write MUST use AlaSQL-compatible syntax and reference the table as "?" (a parameter placeholder representing the active JSON array), e.g. "SELECT * FROM ?".`;
      }
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
      // Ensure the conversation starts with a user message (Gemini requirement)
      const firstUserIdx = body.messages.findIndex((m) => m.role !== "model");
      const activeMessages = firstUserIdx !== -1 ? body.messages.slice(firstUserIdx) : body.messages;

      contents = activeMessages.map((m, idx) => {
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

    // List of models to try in sequence
    const models = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview"
    ];
    let response: Response | null = null;
    let lastError = "";

    for (const model of models) {
      let retries = 1;
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

          // If the model is not found, not permitted, or quota is exhausted (limit 0),
          // immediately move to the next model.
          if (res.status === 404 || res.status === 403 || res.status === 429) {
            break;
          }

          // If the error is a transient service overload (503), retry after a short delay
          if (res.status === 503 && retries > 0) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          break;
        } catch (e) {
          lastError = (e as Error).message;
          if (retries > 0) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 1000));
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
