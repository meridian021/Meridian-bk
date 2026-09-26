/**
 * Reusable premium loading-modal helper.
 *
 * Usage from any page:
 *   showLoadingSequence(['Processing transfer...', 'Confirming with recipient bank...'])
 *     .then(() => form.submit());
 *
 * Each message is shown for `stepDurationMs` before advancing, purely as a
 * UI simulation — no fake external API calls are made. Keep this on every
 * flow the brief calls out (registration, transfers, KYC submit, card
 * request, crypto deposit, fixed deposit, locked funds) so the app reads as
 * a real banking product rather than an instant form-submit demo.
 */
function showLoadingSequence(messages, stepDurationMs = 900) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-card">
        <div class="spinner"></div>
        <div class="loading-title" data-loading-title></div>
        <div class="loading-subtitle">Please wait while we process your request.</div>
      </div>
    `;
    document.body.appendChild(overlay);
    const titleEl = overlay.querySelector('[data-loading-title]');

    let i = 0;
    titleEl.textContent = messages[0];
    const interval = setInterval(() => {
      i += 1;
      if (i < messages.length) {
        titleEl.textContent = messages[i];
      } else {
        clearInterval(interval);
        overlay.remove();
        resolve();
      }
    }, stepDurationMs);
  });
}
