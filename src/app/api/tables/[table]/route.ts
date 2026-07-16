export async function GET() {
  return Response.json({ error: "Deprecated. Use /api/connections instead." }, { status: 404 });
}
