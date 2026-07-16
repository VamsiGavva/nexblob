/** POST /api/d1/query — stateless proxy to execute custom SQL against D1 */
export async function POST(req: Request) {
  try {
    const { accountId, databaseId, apiToken, sql, params } = await req.json() as {
      accountId: string;
      databaseId: string;
      apiToken: string;
      sql: string;
      params?: any[];
    };

    if (!accountId || !databaseId || !apiToken || !sql) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const queryUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const cfRes = await fetch(queryUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params: params || [],
      }),
    });

    const cfData = await cfRes.json() as any;
    if (!cfRes.ok || !cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Cloudflare API query failed";
      return Response.json({ error: errorMsg }, { status: cfRes.status });
    }

    const results = cfData.result?.[0]?.results || [];
    return Response.json({ rows: results });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
