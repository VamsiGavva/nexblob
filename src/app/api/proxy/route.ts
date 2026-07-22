import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { url, method, headers: reqHeaders, body } = await req.json() as {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
    };

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Invalid or missing URL" }, { status: 400 });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: reqHeaders,
    };

    if (body && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      fetchOptions.body = body;
    }

    const startTime = Date.now();
    const res = await fetch(url, fetchOptions);
    const elapsed = Date.now() - startTime;

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    const textBody = await res.text();
    const sizeBytes = new TextEncoder().encode(textBody).length;
    const sizeDisplay =
      sizeBytes >= 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(sizeBytes / 1024).toFixed(2)} KB`;

    // Try to pretty-print JSON
    let formattedBody = textBody;
    try {
      const json = JSON.parse(textBody);
      formattedBody = JSON.stringify(json, null, 2);
    } catch {
      // Leave as-is (HTML, text, etc.)
    }

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText || statusTextForCode(res.status),
      time: elapsed,
      size: sizeDisplay,
      body: formattedBody,
      headers: responseHeaders,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to proxy request." },
      { status: 500 }
    );
  }
}

function statusTextForCode(code: number): string {
  const map: Record<number, string> = {
    200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
    301: "Moved Permanently", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 405: "Method Not Allowed", 409: "Conflict",
    422: "Unprocessable Entity", 429: "Too Many Requests",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
  };
  return map[code] || "Unknown";
}
