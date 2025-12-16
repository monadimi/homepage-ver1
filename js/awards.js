// js/awards.js

const awardsState = {
  allData: [],
  years: [],
  currentYear: null
};

function init() {
  setupMenu();
  loadMenu();
  loadAwards();
  setupScroll();
  setupYearNavigation();
}

function setupMenu() {
  const toggleBtn = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');

  if (toggleBtn && nav) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      nav.classList.toggle('active');
      toggleBtn.classList.toggle('active');
    });

    nav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        nav.classList.remove('active');
        toggleBtn.classList.remove('active');
      }
    });
  }
}

async function loadMenu() {
  try {
    const response = await fetch('data/menu.json?v=' + AppConfig.VERSION);
    if (!response.ok) return;
    const items = await response.json();

    const nav = document.getElementById('main-nav');
    if (!nav) return;

    nav.innerHTML = '';
    items.forEach(item => {
      let link = item.link;
      if (link.startsWith('#')) {
        link = 'index.html' + link;
      }

      const a = document.createElement('a');
      a.href = link;
      a.textContent = item.name;
      nav.appendChild(a);
    });
  } catch (e) {
    console.warn("Could not load menu:", e);
  }
}

async function loadAwards() {
  try {
    const response = await fetch('data/awards.json?v=' + AppConfig.VERSION);
    if (!response.ok) return;
    const data = await response.json();

    awardsState.allData = data;

    // Extract Years
    const uniqueYears = new Set(data.map(item => parseInt(item.year)).filter(y => !isNaN(y)));
    awardsState.years = Array.from(uniqueYears).sort((a, b) => b - a); // Descending

    // Default to latest
    if (awardsState.years.length > 0) {
      awardsState.currentYear = awardsState.years[0];
    } else {
      // Fallback if no valid years found but data exists
      awardsState.currentYear = new Date().getFullYear();
    }

    // Initial Render
    renderOrbit(data.slice(0, 8)); // Top 8 overall for orbit? Or Top 8 of current year? 
    // "수상 목록 상단에... 연도 이동 기능" => Implies filtering LIST, Orbit might remain as "Highlights".
    // Let's keep Orbit as Top 8 Highlights (from all time or just latest? usually all time highlights).
    // I'll leave Orbit as is (First 8 of JSON).

    updateYearNavigator();
    renderAwardsList();

  } catch (e) {
    console.warn("Could not load awards:", e);
  }
}

function renderOrbit(orbitData) {
  const orbitContainer = document.getElementById('awards-orbit');
  if (!orbitContainer) return;

  orbitContainer.innerHTML = '';
  const total = orbitData.length;
  const radius = 300; // px

  orbitData.forEach((award, index) => {
    const bubble = document.createElement('div');
    bubble.classList.add('award-bubble');
    bubble.innerHTML = `
                  <strong>${award.title}</strong>
                  <span>${award.org} • ${award.year}</span>
              `;

    const angle = (index / total) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    bubble.style.left = '50%';
    bubble.style.top = '50%';
    bubble.style.marginLeft = `${x}px`;
    bubble.style.marginTop = `${y}px`;

    orbitContainer.appendChild(bubble);
  });
}

function setupYearNavigation() {
  const prevBtn = document.getElementById('prev-year-btn');
  const nextBtn = document.getElementById('next-year-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const target = getNearbyYear(-1); // Older
      if (target) {
        awardsState.currentYear = target;
        updateYearNavigator();
        renderAwardsList();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const target = getNearbyYear(1); // Newer
      if (target) {
        awardsState.currentYear = target;
        updateYearNavigator();
        renderAwardsList();
      }
    });
  }
}

function getNearbyYear(direction) {
  // direction: -1 (Older, Previous), 1 (Newer, Next)
  // Years are sorted DESC: [2025, 2024, 2023]
  if (!awardsState.currentYear) return null;

  const current = awardsState.currentYear;
  // Find all years less than current
  const older = awardsState.years.filter(y => y < current);
  // Find all years greater than current
  const newer = awardsState.years.filter(y => y > current);

  if (direction === -1) {
    // Want older (Previous Year button) -> Max of older
    if (older.length === 0) return null;
    return Math.max(...older);
  } else {
    // Want newer (Next Year button) -> Min of newer
    if (newer.length === 0) return null;
    return Math.min(...newer);
  }
}

function updateYearNavigator() {
  const display = document.getElementById('current-year-display');
  const prevBtn = document.getElementById('prev-year-btn');
  const nextBtn = document.getElementById('next-year-btn');

  if (display) display.textContent = awardsState.currentYear || "ALL"; // Fallback

  if (prevBtn) {
    const hasPrev = getNearbyYear(-1) !== null;
    prevBtn.disabled = !hasPrev;
    prevBtn.style.opacity = hasPrev ? '1' : '0.3';
    prevBtn.style.pointerEvents = hasPrev ? 'auto' : 'none';
  }

  if (nextBtn) {
    const hasNext = getNearbyYear(1) !== null;
    nextBtn.disabled = !hasNext;
    nextBtn.style.opacity = hasNext ? '1' : '0.3';
    nextBtn.style.pointerEvents = hasNext ? 'auto' : 'none';
  }
}

function renderAwardsList() {
  const listContainer = document.getElementById('awards-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  // Filter by year
  const listData = awardsState.allData.filter(item => parseInt(item.year) === awardsState.currentYear);

  if (listData.length === 0) {
    listContainer.innerHTML = '<div class="award-card" style="opacity:0.5; background:none; border:none;">No awards found for this year.</div>';
  } else {
    listContainer.style.display = 'flex';
    listData.forEach(award => {
      const card = document.createElement('div');
      card.classList.add('award-card');
      card.innerHTML = `
                      <strong>${award.title}</strong>
                      <div class="award-details">
                          <p>${award.description || "Awarded for excellence in digital craft."}</p>
                          <span>${award.org} • ${award.year}</span>
                      </div>
                   `;
      card.addEventListener('click', () => {
        card.classList.toggle('active');
      });
      listContainer.appendChild(card);
    });
  }
}

function setupScroll() {
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const orbitContainer = document.getElementById('awards-orbit');
    if (orbitContainer) {
      requestAnimationFrame(() => {
        const rotation = scrollY * 0.2;
        orbitContainer.style.transform = `rotate(${rotation}deg)`;

        const bubbles = orbitContainer.querySelectorAll('.award-bubble');
        bubbles.forEach(bubble => {
          bubble.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
        });
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
