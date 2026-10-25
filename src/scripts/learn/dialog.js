// Native <dialog> helpers: a sheet opened from a control, and one confirm prompt. Escape and focus
// return come from the element itself.

/** Opens a dialog modally, closing it on a tap outside its box or on any [data-close]. */
export function openSheet(dialog) {
  if (!dialog.dataset.wired) {
    dialog.dataset.wired = "";
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) dialog.close("cancel");
    });
    for (const close of dialog.querySelectorAll("[data-close]")) {
      close.addEventListener("click", () => dialog.close("cancel"));
    }
  }
  dialog.showModal();
}

/**
 * Asks one question. The safe answer is the primary button and takes focus; Escape is the safe answer.
 * @returns {Promise<boolean>} true when the second, riskier answer was chosen
 */
export function confirm({ title, body, keep, proceed }) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("learn-confirm"));
  dialog.querySelector("#learn-confirm-title").textContent = title;
  dialog.querySelector("#learn-confirm-body").textContent = body;
  dialog.querySelector('[data-answer="cancel"]').textContent = keep;
  dialog.querySelector('[data-answer="confirm"]').textContent = proceed;
  if (!dialog.dataset.wired) {
    dialog.dataset.wired = "";
    for (const button of dialog.querySelectorAll("[data-answer]")) {
      button.addEventListener("click", () => dialog.close(button.dataset.answer));
    }
  }
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    dialog.showModal();
  });
}
