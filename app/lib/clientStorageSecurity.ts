const legacySensitiveStoragePrefixes = [
  "bluedeck:contract-studio-draft:",
] as const;

export function clearLegacySensitiveClientStorage() {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (
        key &&
        legacySensitiveStoragePrefixes.some((prefix) => key.startsWith(prefix))
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can be unavailable in privacy modes. Contract drafts now live
    // only in the yacht-scoped server record, so no fallback is required.
  }
}
