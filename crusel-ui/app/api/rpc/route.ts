export const runtime = "edge";

const UPSTREAM = "https://testrpc.xlayer.tech";

export async function POST(req: Request) {
  const body = await req.text();

  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}