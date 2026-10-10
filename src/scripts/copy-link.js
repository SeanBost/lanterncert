// Reveals the copy-link control where the clipboard is writable; its label briefly confirms each copy.

const CONFIRM_MS = 2000;

export function initCopyLink() {
  const button = document.querySelector("[data-copy-link]");
  if (!button || !navigator.clipboard) return;

  const label = button.textContent.trim();
  let restore;
  button.hidden = false;
  button.addEventListener("click", async () => {
    const url = document.querySelector('link[rel="canonical"]')?.href ?? location.href;
    // Holds the resting width, so a shorter confirmation never shifts the button beside it.
    button.style.minWidth = `${button.offsetWidth}px`;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = "Copied!";
    } catch {
      button.textContent = "Couldn't copy";
    }
    clearTimeout(restore);
    restore = setTimeout(() => {
      button.textContent = label;
    }, CONFIRM_MS);
  });
}
