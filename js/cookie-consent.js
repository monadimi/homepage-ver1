/**
 * cookie-consent.js
 * Implements a floating cookie FAB that expands/collapses and fades out.
 */

(function () {
  const COOKIE_SEEN_KEY = 'monad_cookie_seen';
  const EXPAND_DURATION = 3000; // Time to stay expanded on first visit
  const FADE_OUT_DELAY = 5000; // Time before fading out if no interaction

  // SVG Icon
  const COOKIE_ICON = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C6.75329 21.5 2.5 17.2467 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C12.9868 2.5 13.9405 2.65089 14.8364 2.93043C14.6301 3.5222 14.5221 4.14856 14.538 4.79374C14.5828 6.61199 15.9327 8.16369 17.7289 8.39766C17.7289 8.39766 18.0066 9.87654 19.3361 10.6358C20.6656 11.3951 21.3653 11.0825 21.3653 11.0825C21.4552 11.383 21.5 11.6934 21.5 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10.5 8.5C10.5 9.05228 10.0523 9.5 9.5 9.5C8.94772 9.5 8.5 9.05228 8.5 8.5C8.5 7.94772 8.94772 7.5 9.5 7.5C10.0523 7.5 10.5 7.94772 10.5 8.5Z" fill="currentColor"/>
      <path d="M14.5 13.5C14.5 14.0523 14.0523 14.5 13.5 14.5C12.9477 14.5 12.5 14.0523 12.5 13.5C12.5 12.9477 12.9477 12.5 13.5 12.5C14.0523 12.5 14.5 12.9477 14.5 13.5Z" fill="currentColor"/>
      <path d="M9.5 16.5C9.5 17.0523 9.05228 17.5 8.5 17.5C7.94772 17.5 7.5 17.0523 7.5 16.5C7.5 15.9477 7.94772 15.5 8.5 15.5C9.0523 15.5 9.5 15.9477 9.5 16.5Z" fill="currentColor"/>
    </svg>
  `;

  function initCookieConsent() {
    // Inject Styles if not in css (Doing it in CSS file is better, but allow for standalone)
    // We will rely on style.css for cleaner code, but let's assume classes exist.

    const fab = document.createElement('div');
    fab.className = 'cookie-fab';
    fab.innerHTML = `
      <div class="cookie-icon">${COOKIE_ICON}</div>
      <div class="cookie-content">
        <span class="cookie-text">현재 사이트는 통계 분석을 위한 쿠키를 사용합니다.</span>
        <a href="cookies.html" class="cookie-btn">자세히 보기</a>
      </div>
    `;
    document.body.appendChild(fab);

    const hasSeen = localStorage.getItem(COOKIE_SEEN_KEY);
    let fadeTimer;
    let isHovered = false;

    // --- Interaction ---
    fab.addEventListener('mouseenter', () => {
      isHovered = true;
      fab.classList.add('expanded');
      // Cancel fade out if hovered
      clearTimeout(fadeTimer);
    });

    fab.addEventListener('mouseleave', () => {
      isHovered = false;
      fab.classList.remove('expanded');
      // Restart fade timer? Or just start it?
      // "10초 후 호버가 안되었을 시 자동으로 fade out"
      // If user hovered and left, maybe give another 10s or just leave it?
      // Let's reset the 10s timer on mouseleave.
      startFadeTimer();
    });

    // --- Logic ---
    if (!hasSeen) {
      // First visit: Expand automatically
      setTimeout(() => {
        fab.classList.add('expanded');
      }, 1000); // Wait 1s after load

      setTimeout(() => {
        if (!isHovered) {
          fab.classList.remove('expanded');
        }
        localStorage.setItem(COOKIE_SEEN_KEY, 'true');
      }, 1000 + EXPAND_DURATION);
    }

    // Start global fade timer
    startFadeTimer();

    function startFadeTimer() {
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        if (!isHovered) {
          fab.style.opacity = '0';
          fab.style.pointerEvents = 'none';
          // Optionally remove from DOM after transition
          setTimeout(() => fab.remove(), 500);
        }
      }, FADE_OUT_DELAY);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
  } else {
    initCookieConsent();
  }

})();
