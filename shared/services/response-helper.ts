export class ResponseHelper {
  static json(d: unknown, s = 200): Response {
    return new Response(JSON.stringify(d), {
      status: s,
      headers: { "Content-Type": "application/json" },
    });
  }
  static text(t: string, s = 200): Response {
    return new Response(t, { status: s });
  }
}
