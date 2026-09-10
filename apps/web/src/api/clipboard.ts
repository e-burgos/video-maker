export async function copyToClipboard(text: string): Promise<boolean> {
  const clipboard: Clipboard | undefined = navigator.clipboard;

  if (clipboard === undefined) {
    return false;
  }

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
