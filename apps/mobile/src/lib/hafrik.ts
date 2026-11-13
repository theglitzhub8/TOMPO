import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

export const hafrikRedirect = "tempo://auth/hafrik";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Opens Login with Hafrik in a secure browser sheet. The server binds the
 * sign-in to sha256(verifier); only this device can redeem the returned ticket.
 * Resolves null when the person closes the sheet.
 */
export async function hafrikTicket(base: string) {
  const verifier = hex(Crypto.getRandomBytes(32));
  const challenge = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  const result = await WebBrowser.openAuthSessionAsync(
    `${base}/v1/auth/hafrik/start?challenge=${challenge}`,
    hafrikRedirect,
  );
  if (result.type !== "success") return null;
  const params = Linking.parse(result.url).queryParams ?? {};
  if (typeof params.error === "string") throw new Error(params.error);
  const ticket = params.ticket;
  if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket))
    throw new Error("Hafrik did not complete the sign-in. Try again.");
  return { ticket, verifier };
}
