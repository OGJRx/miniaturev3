export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  const aHash = await crypto.subtle.digest("SHA-256", aBuf);
  const bHash = await crypto.subtle.digest("SHA-256", bBuf);

  const aHashArray = new Uint8Array(aHash);
  const bHashArray = new Uint8Array(bHash);

  // In production (Cloudflare Workers), timingSafeEqual is available.
  // In test environments (Vitest/Node), it might not be.
  if ("timingSafeEqual" in crypto.subtle) {
    return (
      crypto.subtle as unknown as {
        timingSafeEqual: (a: ArrayBuffer, b: ArrayBuffer) => boolean;
      }
    ).timingSafeEqual(aHash, bHash);
  }

  // Fallback for environments where timingSafeEqual is not available (like Vitest)
  if (aHashArray.length !== bHashArray.length) return false;
  let r = 0;
  for (let i = 0; i < aHashArray.length; i++) {
    r |= aHashArray[i] ^ bHashArray[i];
  }
  return r === 0;
}

export async function hmacSha256(
  secret: string,
  data: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataToSign = encoder.encode(data);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, dataToSign);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
