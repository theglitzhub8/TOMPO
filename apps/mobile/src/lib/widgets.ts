export const widgetsSupported = false;
export async function enableWidgets() {
  throw new Error(
    "Home and lock-screen widgets are available in the rebuilt iOS app.",
  );
}
export async function disableWidgets() {}
export function WidgetSync() {
  return null;
}
