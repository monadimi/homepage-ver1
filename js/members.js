// members.js - Cleaned up and fixed
const DEFAULT_IMAGE = 'https://placehold.co/160x160?text=Member';
const state = {
  cohorts: [],
  byCohort: {},
  current: ''
};

function init() {
  setupMenu(); // Setup static button immediately
  loadMenu();  // Fetch links
  renderMembersPage();
}

function setupMenu() {
  const toggleBtn = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');

  if (toggleBtn && nav) {
    // Toggle Menu
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent immediate closing if persistent
      nav.classList.toggle('active');
      toggleBtn.classList.toggle('active');
      console.log("Toggle Clicked", nav.classList.contains('active'));
    });

    // Close when clicking outside or on link
    nav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        nav.classList.remove('active');
        toggleBtn.classList.remove('active');
      }
    });
  } else {
    console.warn("Menu toggle or nav not found");
  }
}

async function loadMenu() {
  try {
    const response = await fetch('data/menu.json?v=' + AppConfig.VERSION);
    if (!response.ok) return;
    const items = await response.json();

    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Don't wipe the nav entirely if we want to keep structure, but usually it's empty.
    nav.innerHTML = '';
    items.forEach(item => {
      // Handle relative links for subpage
      let link = item.link;
      // If we are on member.html and link is anchor (#), prepend index.html
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

async function renderMembersPage() {
  const container = document.getElementById('members-container');
  const buttonsWrap = document.getElementById('cohort-buttons');
  if (!container || !buttonsWrap) return;

  try {
    const data = await fetchMembers();
    buildCohortState(data);
    buildButtons(buttonsWrap, container);
    renderSelectedCohort(container, state.current);
  } catch (err) {
    console.warn('Could not load members:', err);
    container.innerHTML = '<p class="members-empty">멤버 정보를 불러오지 못했습니다.</p>';
  }
}

async function fetchMembers() {
  // If running in some environments, path might need ./
  const response = await fetch('data/members.json?v=' + AppConfig.VERSION);
  if (!response.ok) throw new Error('members.json not found');
  return response.json();
}

function buildCohortState(members = []) {
  const byCohort = members.reduce((acc, member) => {
    const key = member.cohort || '동아리 기수 미정';
    if (!acc[key]) acc[key] = [];
    acc[key].push(member);
    return acc;
  }, {});

  // Sort descending
  const cohorts = Object.keys(byCohort).sort((a, b) => parseCohort(b) - parseCohort(a));

  state.cohorts = cohorts;
  state.byCohort = byCohort;
  state.current = cohorts[0] || '';
}

function buildButtons(wrapper, container) {
  wrapper.innerHTML = '';
  state.cohorts.forEach(cohort => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cohort-button';
    btn.textContent = cohort;
    btn.dataset.cohort = cohort;
    btn.addEventListener('click', () => {
      setActiveButton(wrapper, cohort);
      renderSelectedCohort(container, cohort);
    });
    wrapper.appendChild(btn);
  });
  setActiveButton(wrapper, state.current);
}

function setActiveButton(wrapper, cohort) {
  Array.from(wrapper.querySelectorAll('.cohort-button')).forEach(btn => {
    if (btn.dataset.cohort === cohort) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderSelectedCohort(container, cohort) {
  state.current = cohort;
  const members = state.byCohort[cohort] || [];
  if (members.length === 0) {
    container.innerHTML = '<p class="members-empty">해당 기수의 멤버가 없습니다.</p>';
    return;
  }

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'member-grid';

  members.forEach(member => {
    grid.appendChild(createMemberCard(member));
  });

  container.appendChild(grid);
}

function createMemberCard(member) {
  const { image, cohort, generalCohort, department, name, description } = member;
  const generalLabel = formatGeneralCohort(department, generalCohort);
  const card = document.createElement('article');
  card.className = 'member-card';

  const avatar = document.createElement('div');
  avatar.className = 'member-avatar';
  avatar.style.backgroundImage = `url('${image || DEFAULT_IMAGE}')`;

  const meta = document.createElement('div');
  meta.className = 'member-meta';
  meta.innerHTML = `
      <p class="member-cohort">${generalLabel}</p>
      <h4 class="member-name">${name || '이름 미정'}</h4>
      <p class="member-desc">${description || ''}</p>
    `;

  card.appendChild(avatar);
  card.appendChild(meta);
  return card;
}

function parseCohort(label = '') {
  const num = parseInt(label.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? 0 : num;
}

function formatGeneralCohort(department, generalCohort) {
  const dept = department || '학과 미정';
  const gen = generalCohort ? `${generalCohort}` : '기수 미정';
  return `${dept} ${gen}`;
}

// Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
