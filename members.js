(() => {
  const DEFAULT_IMAGE = 'https://placehold.co/160x160?text=Member';
  const state = {
    cohorts: [],
    byCohort: {},
    current: ''
  };
  const isMembersPage = !!document.getElementById('members-page');

  document.addEventListener('DOMContentLoaded', () => {
    if (!isMembersPage) return;
    loadMenu();
    renderMembersPage();
  });

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
    const response = await fetch('members.json');
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

  async function loadMenu() {
    try {
      const response = await fetch('menu.json');
      if (!response.ok) return;
      const items = await response.json();

      const nav = document.getElementById('main-nav');
      if (!nav) return;

      nav.innerHTML = '';
      items.forEach(item => {
        let href = item.link;
        if (isMembersPage && href.startsWith('#')) {
          href = `index.html${href}`;
        }
        const a = document.createElement('a');
        a.href = href;
        a.textContent = item.name;
        nav.appendChild(a);
      });
    } catch (e) {
      console.warn("Could not load menu:", e);
    }
  }
})();
