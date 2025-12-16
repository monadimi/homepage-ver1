// projects.js
const DEFAULT_PROJECT_IMAGE = 'https://placehold.co/600x400/101010/ffffff?text=Project';

function init() {
  setupMenu();
  loadMenu();
  renderProjectsPage();
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
      // Handle relative links for subpage
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

async function renderProjectsPage() {
  const container = document.getElementById('projects-container');
  if (!container) return;

  try {
    const data = await fetchProjects();
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="projects-empty">진행 중인 프로젝트가 없습니다.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'project-grid';

    data.forEach((project, index) => {
      // Stagger animation delay
      const card = createProjectCard(project);
      card.style.animationDelay = `${index * 0.1}s`;
      grid.appendChild(card);
    });

    container.appendChild(grid);

  } catch (err) {
    console.warn('Could not load projects:', err);
    container.innerHTML = '<p class="projects-empty">프로젝트 정보를 불러오지 못했습니다.</p>';
  }
}

async function fetchProjects() {
  const response = await fetch('data/projects.json?v=' + AppConfig.VERSION);
  if (!response.ok) throw new Error('projects.json not found');
  return response.json();
}

function createProjectCard(project) {
  const { title, description, image, icon, link, tags } = project;

  const article = document.createElement('article');
  article.className = 'project-card';

  // Convert tags array to HTML
  const tagsHtml = (tags || []).map(tag => `<span class="project-tag">${tag}</span>`).join('');

  article.innerHTML = `
        <div class="project-image" style="background-image: url('${image || DEFAULT_PROJECT_IMAGE}')">
            <div class="project-overlay">
                <a href="${link || '#'}" class="project-link-btn">View Project</a>
            </div>
        </div>
        <div class="project-content">
            <div class="project-header">
                <div class="project-icon" style="background-image: url('${icon}')"></div>
                <h3 class="project-title">${title}</h3>
            </div>
            <p class="project-desc">${description}</p>
            <div class="project-tags">${tagsHtml}</div>
        </div>
    `;

  // Entire card click redirect if desired, but user asked for "link" property.
  // Creating a clickable card area or button is fine. 
  article.addEventListener('click', () => {
    if (link && link !== '#') window.location.href = link;
  });

  return article;
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
