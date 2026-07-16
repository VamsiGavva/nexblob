/** POST /api/d1/tables — stateless proxy to list D1 tables */
export async function POST(req: Request) {
  try {
    const { accountId, databaseId, apiToken } = await req.json() as {
      accountId: string;
      databaseId: string;
      apiToken: string;
    };

    if (!accountId || !databaseId || !apiToken) {
      return Response.json({ error: "Missing required credentials" }, { status: 400 });
    }

    const queryUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const cfRes = await fetch(queryUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
      }),
    });

    const cfData = await cfRes.json() as any;
    if (!cfRes.ok || !cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Cloudflare API request failed";
      return Response.json({ error: errorMsg }, { status: cfRes.status });
    }

    const resultsArray = cfData.result?.[0]?.results || [];
    const tables = resultsArray.map((r: any) => r.name);

    return Response.json({ tables });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
