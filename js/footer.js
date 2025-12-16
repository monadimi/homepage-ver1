/**
 * footer.js
 * Injects the global footer (Main Footer + Sub Footer) into the page.
 */

(function () {
  const footerStart = `
    <footer id="main-footer">
      <div class="footer-dot-text" id="footer-text">MONAD</div>
    </footer>
  `;

  const subFooter = `
    <div id="sub-footer">
      <p>&copy; 2025 MONAD. All rights reserved.</p>
      <a href="cookies.html">쿠키 사용 (Cookie Policy)</a>
    </div>
  `;

  function injectFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
      placeholder.innerHTML = footerStart + subFooter;
      initFooterAnimation(); // Start animation after injection
    } else {
      console.warn('Footer placeholder not found. Appending to body.');
      const container = document.createElement('div');
      container.innerHTML = footerStart + subFooter;
      document.body.appendChild(container); // Still append
      initFooterAnimation(); // Start animation
    }
  }

  function initFooterAnimation() {
    const footerText = document.getElementById('footer-text');
    if (!footerText) return;

    const words = [">>=", "MONAD LEADS THE FUTURE", "Ⓒ MONAD 2025~", "MONAD IS IN DIMIGO", "FOR HUMANITY", "JOIN MONAD"];
    let currentIndex = 0;

    setInterval(() => {
      // Fade Out
      footerText.style.opacity = '0';
      footerText.style.transform = 'translateY(10px) scale(0.95)'; // Subtle drop effect

      setTimeout(() => {
        // Change Text
        currentIndex = (currentIndex + 1) % words.length;
        footerText.textContent = words[currentIndex];

        // Fade In
        footerText.style.opacity = '1';
        footerText.style.transform = 'translateY(0) scale(1)';
      }, 500); // Wait for transition

    }, 2500); // Cycle every 2.5s
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
