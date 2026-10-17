// Browser sign-in is scoped to this tab. Native credentials use SecureStore.
export async function getItemAsync(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  window.sessionStorage.setItem(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  window.sessionStorage.removeItem(key);
}
