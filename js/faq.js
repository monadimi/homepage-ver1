document.addEventListener('DOMContentLoaded', () => {
  const faqContainer = document.getElementById('faq-list');
  if (!faqContainer) return;

  fetch('./data/faq.json')
    .then(response => response.json())
    .then(data => {
      data.forEach((item, index) => {
        const faqItem = document.createElement('div');
        faqItem.classList.add('faq-item');

        // Add specific delay for staggered animation
        faqItem.style.setProperty('--delay', `${index * 0.1}s`);

        faqItem.innerHTML = `
          <button class="faq-question" aria-expanded="false">
            <span class="question-text">${item.question}</span>
            <span class="faq-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </span>
          </button>
          <div class="faq-answer">
            <div class="answer-content">
              ${item.answer}
            </div>
          </div>
        `;

        const questionBtn = faqItem.querySelector('.faq-question');
        questionBtn.addEventListener('click', () => {
          const isExpanded = questionBtn.getAttribute('aria-expanded') === 'true';

          // Close all other items (accordion behavior) - Optional, can remove if multi-open is desired
          document.querySelectorAll('.faq-question').forEach(btn => {
            btn.setAttribute('aria-expanded', 'false');
            btn.parentElement.classList.remove('active');
          });

          if (!isExpanded) {
            questionBtn.setAttribute('aria-expanded', 'true');
            faqItem.classList.add('active');
          }
        });

        faqContainer.appendChild(faqItem);
      });
    })
    .catch(error => console.error('Error loading FAQ:', error));
});
