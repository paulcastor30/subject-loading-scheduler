// Preferences are optional. IndexedDB remains the source of academic records.
export function readPreference(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Academic records still persist through IndexedDB. */
  }
}
