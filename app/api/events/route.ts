import { subscribe } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => controller.enqueue(encoder.encode(payload));
      unsubscribe = subscribe(send);
      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, 15000);

      controller.enqueue(encoder.encode(`event: connected\ndata: {}\n\n`));

    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive);
      if (unsubscribe) unsubscribe();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
