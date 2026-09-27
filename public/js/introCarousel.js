/**
 * Shows a 3-slide (or however many) welcome overlay the first time a
 * customer visits a given page. Remembers per-page dismissal in
 * localStorage so it doesn't nag on every visit.
 */
function initIntroCarousel(storageKey, slides) {
  if (localStorage.getItem(storageKey)) return; // already seen

  let current = 0;

  const overlay = document.createElement("div");
  overlay.className = "intro-overlay";
  overlay.innerHTML = `
    <div class="intro-card">
      <div class="intro-icon" data-intro-icon></div>
      <div class="intro-title" data-intro-title></div>
      <div class="intro-text" data-intro-text></div>
      <div class="intro-dots" data-intro-dots></div>
      <div class="intro-nav">
        <span class="intro-skip" data-intro-skip>Skip</span>
        <button type="button" class="btn btn-primary" data-intro-next style="padding:8px 20px;"></button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const iconEl = overlay.querySelector("[data-intro-icon]");
  const titleEl = overlay.querySelector("[data-intro-title]");
  const textEl = overlay.querySelector("[data-intro-text]");
  const dotsEl = overlay.querySelector("[data-intro-dots]");
  const nextBtn = overlay.querySelector("[data-intro-next]");
  const skipEl = overlay.querySelector("[data-intro-skip]");

  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "intro-dot" + (i === 0 ? " active" : "");
    dotsEl.appendChild(dot);
  });

  function render() {
    const slide = slides[current];
    iconEl.textContent = slide.icon || "✦";
    titleEl.textContent = slide.title;
    textEl.textContent = slide.text;
    nextBtn.textContent =
      current === slides.length - 1 ? "Get started" : "Next";
    Array.from(dotsEl.children).forEach((dot, i) =>
      dot.classList.toggle("active", i === current),
    );
  }

  function dismiss() {
    localStorage.setItem(storageKey, "true");
    overlay.remove();
  }

  nextBtn.addEventListener("click", function () {
    if (current === slides.length - 1) {
      dismiss();
    } else {
      current += 1;
      render();
    }
  });

  skipEl.addEventListener("click", dismiss);

  render();
}
