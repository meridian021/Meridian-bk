/**
 * Shows the loading overlay immediately and cycles through messages.
 * Does NOT delay or gate form submission — call this alongside a normal
 * form submit (don't preventDefault), so the overlay appears exactly when
 * the click happens and disappears exactly when the browser finishes
 * loading the next page. No artificial timer to drift out of sync.
 */
function showLoadingSequence(messages, stepDurationMs = 1100) {
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="spinner"></div>
      <div class="loading-title" data-loading-title></div>
      <div class="loading-subtitle">Please wait while we process your request.</div>
    </div>
  `;
  document.body.appendChild(overlay);
  const titleEl = overlay.querySelector("[data-loading-title]");

  let i = 0;
  titleEl.textContent = messages[0];
  const interval = setInterval(() => {
    i += 1;
    if (i < messages.length) {
      titleEl.textContent = messages[i];
    } else {
      clearInterval(interval); // just holds on the last message until the page actually navigates away
    }
  }, stepDurationMs);
}
