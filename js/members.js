// members.js - Cleaned up and fixed
const DEFAULT_IMAGE = 'https://placehold.co/160x160?text=Member';
const state = {
  cohorts: [],
  byCohort: {},
  current: '',
  indexByCohort: {}
};
const SWIPE_THRESHOLD = 50;
const FAN_MAX_VISIBLE = 8;
const FAN_ANGLE_STEP = 18;
const FAN_RADIUS_BASE = 720;
const DRAG_STEP_PX = 90;

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
  state.indexByCohort = {};
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
  const slider = document.createElement('div');
  slider.className = 'member-slider';

  const slides = [];
  members.forEach((member, index) => {
    const slide = document.createElement('div');
    slide.className = 'member-slide';
    slide.dataset.index = index;
    slide.appendChild(createMemberCard(member));
    slider.appendChild(slide);
    slides.push(slide);
  });

  const counter = document.createElement('div');
  counter.className = 'slider-counter';

  slider.appendChild(counter);
  container.appendChild(slider);

  const maxIndex = members.length - 1;
  let currentIndex = Math.min(state.indexByCohort[cohort] || 0, maxIndex);
  let currentPosition = currentIndex;

  const wrapIndex = (value) => {
    const len = members.length;
    return ((value % len) + len) % len;
  };

  const fanOffset = (idx, position, len) => {
    const offset = idx - position;
    const mod = ((offset % len) + len) % len;
    if (mod > len / 2) return mod - len;
    return mod;
  };

  const layoutSlides = (useAnimation = true, position = currentPosition) => {
    const radius = Math.max(FAN_RADIUS_BASE, slider.clientHeight * 0.9);

    slides.forEach((slide, idx) => {
      const offset = fanOffset(idx, position, members.length);
      const abs = Math.abs(offset);
      if (abs > FAN_MAX_VISIBLE) {
        slide.style.opacity = '0';
        slide.style.pointerEvents = 'none';
        slide.style.transform = 'translateZ(-1200px)';
        slide.style.clipPath = 'inset(0px 0px 0px 0px)';
        return;
      }

      const angle = offset * FAN_ANGLE_STEP;
      const lean = offset * 6;
      const depth = -abs * 140;
      const lift = -abs * 10;
      const scale = 1 - Math.min(abs * 0.06, 0.32);
      const inset = Math.max(0, Math.min(35, (abs - (FAN_MAX_VISIBLE - 1)) * 18));

      slide.style.opacity = String(1 - Math.min(abs, FAN_MAX_VISIBLE) / (FAN_MAX_VISIBLE + 0.6));
      slide.style.pointerEvents = 'auto';
      slide.style.zIndex = String(100 - abs);
      slide.style.transition = useAnimation ? 'transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.3s ease' : 'none';
      slide.style.clipPath = inset > 0 ? `inset(0px ${inset}px 0px ${inset}px round 18px)` : 'inset(0px 0px 0px 0px round 18px)';
      slide.style.transform = `
        translateX(-50%)
        rotate(${angle}deg)
        translateY(-${radius}px)
        translateZ(${depth}px)
        translateY(${lift}px)
        rotate(${lean}deg)
        scale(${scale})
      `;
    });
    counter.textContent = `${wrapIndex(Math.round(position)) + 1} / ${members.length}`;
    state.indexByCohort[cohort] = wrapIndex(Math.round(position));
  };

  const goNext = () => {
    currentIndex = wrapIndex(currentIndex + 1);
    currentPosition = currentIndex;
    layoutSlides(true);
  };

  const goPrev = () => {
    currentIndex = wrapIndex(currentIndex - 1);
    currentPosition = currentIndex;
    layoutSlides(true);
  };

  let isDragging = false;
  let startX = 0;
  let lastX = 0;
  let baseIndex = 0;
  let pointerId = null;
  let dragStartTime = 0;

  const onPointerDown = (e) => {
    e.preventDefault();
    isDragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    lastX = startX;
    baseIndex = currentIndex;
    currentPosition = currentIndex;
    slider.setPointerCapture(pointerId);
    slider.classList.add('dragging');
    dragStartTime = performance.now();
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    lastX = e.clientX;
    const delta = lastX - startX;
    const offset = delta / DRAG_STEP_PX;
    currentPosition = baseIndex - offset;
    layoutSlides(false, currentPosition);
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    const elapsed = performance.now() - dragStartTime;
    const momentumStep = Math.abs(lastX - startX) > SWIPE_THRESHOLD && elapsed < 350 ? Math.sign(startX - lastX) : 0;
    currentIndex = wrapIndex(Math.round(currentPosition + momentumStep));
    currentPosition = currentIndex;
    if (pointerId !== null) {
      slider.releasePointerCapture(pointerId);
      pointerId = null;
    }
    slider.classList.remove('dragging');
    layoutSlides(true);
  };

  slider.addEventListener('pointerdown', onPointerDown);
  slider.addEventListener('pointermove', onPointerMove);
  slider.addEventListener('pointerup', onPointerUp);
  slider.addEventListener('pointercancel', onPointerUp);
  slider.addEventListener('pointerleave', onPointerUp);

  layoutSlides(false);
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
