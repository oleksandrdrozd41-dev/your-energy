import './css/styles.css';

/* -------------------- Config -------------------- */

const API_BASE = 'https://your-energy.b.goit.study/api';
const FAVORITES_KEY = 'yourEnergyFavorites';
const QUOTE_CACHE_KEY = 'yourEnergyQuoteCacheV1';

const FILTERS = ['Muscles', 'Body parts', 'Equipment'];
const FILTER_TO_API = {
  'Muscles': 'muscles',
  'Body parts': 'bodypart',
  'Equipment': 'equipment',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------- DOM -------------------- */

const els = {
  body: document.body,
  navLinks: [...document.querySelectorAll('[data-nav]')],

  titleBack: document.querySelector('[data-title-back]'),
  titleSep: document.querySelector('[data-title-sep]'),
  titleSub: document.querySelector('[data-title-sub]'),

  quoteText: document.querySelector('[data-quote-text]'),
  quoteAuthor: document.querySelector('[data-quote-author]'),

  tabs: document.querySelector('[data-tabs]'),

  searchForm: document.querySelector('[data-search]'),
  searchInput: document.querySelector('[data-search-input]'),

  list: document.querySelector('[data-list]'),
  pagination: document.querySelector('[data-pagination]'),
  pagerPrev: document.querySelector('[data-page-prev]'),
  pagerNext: document.querySelector('[data-page-next]'),
  pagerCurrent: document.querySelector('[data-page-current]'),
  pagerTotal: document.querySelector('[data-page-total]'),

  exBackdrop: document.querySelector('[data-ex-modal-backdrop]'),
  exClose: document.querySelector('[data-ex-modal-close]'),
  exContent: document.querySelector('[data-ex-modal-content]'),

  rateBackdrop: document.querySelector('[data-rate-modal-backdrop]'),
  rateClose: document.querySelector('[data-rate-modal-close]'),
  rateContent: document.querySelector('[data-rate-modal-content]'),

  burger: document.querySelector('[data-burger]'),
  menu: document.querySelector('[data-menu-backdrop]'),
  menuClose: document.querySelector('[data-menu-close]'),
  menuLinks: [...document.querySelectorAll('[data-menu-link]')],

  scrollTop: document.querySelector('[data-scroll-top]'),

  subForm: document.querySelector('[data-subscribe-form]'),
  subMsg: document.querySelector('[data-subscribe-msg]'),
};

/* -------------------- State -------------------- */

const state = {
  route: 'home',
  mode: 'categories', // categories | exercises | favorites
  filter: 'Muscles',
  category: null, // { name, typeKey }
  keyword: '',
  page: 1,
  totalPages: 1,
  currentExerciseId: null,
};

/* -------------------- Utils -------------------- */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('`', '&#096;');
}

function qs(params) {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    u.set(k, String(v));
  });
  return u.toString();
}

function normalizeError(err) {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'Something went wrong.';
}

function getLimits() {
  const w = window.innerWidth;
  return {
    categories: w < 768 ? 9 : 12,
    exercises: w < 768 ? 8 : 10,
    favorites: w < 768 ? 8 : 10,
  };
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

/* -------------------- Favorites storage (IDs only) -------------------- */

function getFavoriteIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
  } catch (_) {
    return [];
  }
}

function setFavoriteIds(ids) {
  const uniq = Array.from(new Set(ids.map(String)));
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(uniq));
}

function isFavoriteId(id) {
  return getFavoriteIds().includes(String(id));
}

function toggleFavoriteId(id) {
  const ids = getFavoriteIds();
  const sid = String(id);
  if (ids.includes(sid)) {
    setFavoriteIds(ids.filter(x => x !== sid));
    return false;
  }
  setFavoriteIds([...ids, sid]);
  return true;
}

/* -------------------- Routing -------------------- */

function parseRoute() {
  const h = String(window.location.hash || '').replace(/^#/, '');
  if (h.startsWith('/favorites')) return 'favorites';
  if (h.startsWith('/home')) return 'home';
  if (h === '/favorites') return 'favorites';
  return 'home';
}

function applyActiveNav(route) {
  els.navLinks.forEach(a => {
    const r = a.getAttribute('data-nav');
    if (!r) return;
    a.classList.toggle('is-active', r === route);
  });
  // mobile menu links share same data-route via href, just close menu on click
}

function applyView() {
  els.body.setAttribute('data-route', state.route);
  applyActiveNav(state.route);

  const onHome = state.route === 'home';
  const isExercises = onHome && state.mode === 'exercises' && state.category;

  // Title (button acts as Back only in exercise list view)
  if (els.titleBack) {
    els.titleBack.textContent = state.route === 'favorites' ? 'Favorites' : 'Exercises';
    els.titleBack.disabled = !isExercises;
    els.titleBack.classList.toggle('is-disabled', !isExercises);
  }

  if (els.titleSep) els.titleSep.classList.toggle('is-hidden', !isExercises);
  if (els.titleSub) {
    els.titleSub.textContent = isExercises ? state.category.name : '';
    els.titleSub.classList.toggle('is-hidden', !isExercises);
  }

  // Tabs/search
  els.tabs?.classList.toggle('is-hidden', !onHome);
  const showSearch = onHome && state.mode === 'exercises';
  els.searchForm?.classList.toggle('is-hidden', !showSearch);

  // List variant
  if (state.route === 'favorites') {
    setListVariant('grid--favorites');
  } else if (state.mode === 'exercises') {
    setListVariant('grid--exercises');
  } else {
    setListVariant('grid--tiles');
  }
}

function setListVariant(variant) {
  if (!els.list) return;
  els.list.classList.remove('grid--tiles', 'grid--exercises', 'grid--favorites');
  els.list.classList.add(variant);
}

async function handleRoute() {
  state.route = parseRoute();
  if (state.route === 'favorites') {
    state.mode = 'favorites';
    state.category = null;
    state.keyword = '';
    state.page = 1;
    state.totalPages = 1;
    if (els.searchInput) els.searchInput.value = '';
    applyView();
    await loadFavorites();
    return;
  }

  // Home
  state.route = 'home';
  state.mode = 'categories';
  state.category = null;
  state.keyword = '';
  state.page = 1;
  state.totalPages = 1;
  if (els.searchInput) els.searchInput.value = '';
  applyView();
  await loadCategories();
}

/* -------------------- Quote -------------------- */

async function loadQuoteOfDay() {
  try {
    const cached = localStorage.getItem(QUOTE_CACHE_KEY);
    if (cached) {
      const obj = JSON.parse(cached);
      const today = new Date().toISOString().slice(0, 10);
      if (obj?.date === today && obj?.quote && obj?.author) {
        renderQuote(obj.quote, obj.author);
        return;
      }
    }
  } catch (_) {
    // ignore
  }

  try {
    const data = await apiGet('/quote');
    const quote = data?.quote || data?.text || '';
    const author = data?.author || '';
    if (quote) {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify({ date: today, quote, author }));
      renderQuote(quote, author);
    }
  } catch (_) {
    // fallback: keep empty
  }
}

function renderQuote(text, author) {
  if (els.quoteText) els.quoteText.textContent = text;
  if (els.quoteAuthor) els.quoteAuthor.textContent = author;
}

/* -------------------- Tabs / Categories -------------------- */

function setActiveTab(label) {
  state.filter = label;
  if (!els.tabs) return;
  const btns = Array.from(els.tabs.querySelectorAll('[data-filter-btn]'));
  btns.forEach(b => b.classList.toggle('is-active', b.getAttribute('data-filter-btn') === label));
}

async function loadCategories() {
  if (state.route !== 'home') return;
  state.mode = 'categories';
  applyView();

  const { categories: limit } = getLimits();
  const filter = state.filter;
  const page = state.page;

  setLoading();
  els.pagination.innerHTML = '';

  try {
    const data = await apiGet(`/filters?${qs({ filter, page, limit })}`);
    const items = Array.isArray(data?.results) ? data.results : [];
    state.totalPages = Number(data?.totalPages) || 1;
    renderCategoryTiles(items);
    renderPagination(state.page, state.totalPages);
  } catch (err) {
    renderError(normalizeError(err));
  }
}

function renderCategoryTiles(items) {
  els.list.innerHTML = items
    .map(it => {
      const name = it?.name || '';
      const img = it?.imgURL || it?.imgUrl || it?.img || '';
      return `
        <button class="tile" type="button" data-tile-name="${escapeAttr(name)}">
          ${img ? `<img class="tile__img" src="${escapeAttr(img)}" alt="${escapeAttr(name)}" loading="lazy" />` : ''}
          <div class="tile__content">
            <div>
              <div class="tile__name">${escapeHtml(name)}</div>
              <div class="tile__sub">${escapeHtml(state.filter)}</div>
            </div>
          </div>
        </button>
      `;
    })
    .join('');
}

/* -------------------- Exercises -------------------- */

async function loadExercises() {
  if (state.route !== 'home') return;
  if (!state.category) return;
  state.mode = 'exercises';
  applyView();

  const { exercises: limit } = getLimits();
  const page = state.page;

  const params = { page, limit };
  params[state.category.typeKey] = state.category.name;
  if (state.keyword) params.keyword = state.keyword;

  setLoading();
  els.pagination.innerHTML = '';

  try {
    const data = await apiGet(`/exercises?${qs(params)}`);
    const items = Array.isArray(data?.results) ? data.results : [];
    state.totalPages = Number(data?.totalPages) || 1;
    renderExerciseCards(items, false);
    renderPagination(state.page, state.totalPages);
  } catch (err) {
    renderError(normalizeError(err));
  }
}

function renderExerciseCards(items, isFavorites) {
  els.list.innerHTML = items
    .map(ex => {
      const id = ex?._id || ex?.id || '';
      const name = ex?.name || 'Exercise';
      const rating = Number(ex?.rating) || 0;
      const bodyPart = ex?.bodyPart || ex?.bodypart || '';
      const target = ex?.target || '';
      const burned = ex?.burnedCalories ?? ex?.burnedcalories ?? ex?.calories ?? 0;

      const leftTop = isFavorites
        ? `
          <div class="ex-card__actions">
            <span class="pill">WORKOUT</span>
            <button class="icon-btn" type="button" aria-label="Remove" data-fav-toggle="${escapeAttr(id)}">
              <svg class="icon" width="16" height="16" aria-hidden="true">
                <use href="#icon-trash"></use>
              </svg>
            </button>
          </div>
        `
        : `
          <div class="ex-card__actions">
            <span class="pill">WORKOUT</span>
            <span class="ex-card__rating">${escapeHtml(rating.toFixed(1))}
              <svg class="icon icon--fill" width="14" height="14" aria-hidden="true">
                <use href="#icon-star-filled"></use>
              </svg>
            </span>
          </div>
        `;

      return `
        <div class="ex-card" data-ex-id="${escapeAttr(id)}">
          <div class="ex-card__top">
            ${leftTop}

            <button class="ex-card__start" type="button" data-start="${escapeAttr(id)}">
              Start
              <svg class="icon" width="18" height="18" aria-hidden="true">
                <use href="#icon-arrow-right"></use>
              </svg>
            </button>
          </div>

          <div class="ex-card__mid">
            <span class="ex-card__icon" aria-hidden="true">
              <svg class="icon" width="14" height="14"><use href="#icon-logo"></use></svg>
            </span>
            <h3 class="ex-card__name">${escapeHtml(name)}</h3>
          </div>

          <div class="ex-card__meta">
            <span><strong>Burned calories:</strong> ${escapeHtml(String(burned))} / 3 min</span>
            <span><strong>Body part:</strong> ${escapeHtml(String(bodyPart))}</span>
            <span><strong>Target:</strong> ${escapeHtml(String(target))}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

/* -------------------- Favorites -------------------- */

async function loadFavorites() {
  if (state.route !== 'favorites') return;
  state.mode = 'favorites';
  applyView();

  const ids = getFavoriteIds();
  if (!ids.length) {
    renderFavoritesEmpty();
    els.pagination.innerHTML = '';
    return;
  }

  // pagination client-side (API has no batch-by-ids endpoint)
  const { favorites: limit } = getLimits();
  const totalPages = Math.max(1, Math.ceil(ids.length / limit));
  state.totalPages = totalPages;
  state.page = clamp(state.page, 1, totalPages);

  setLoading();
  els.pagination.innerHTML = '';

  const start = (state.page - 1) * limit;
  const pageIds = ids.slice(start, start + limit);

  try {
    const items = await Promise.all(
      pageIds.map(id => apiGet(`/exercises/${encodeURIComponent(id)}`).catch(() => null))
    );
    const ok = items.filter(Boolean);
    if (!ok.length) {
      renderFavoritesEmpty();
      els.pagination.innerHTML = '';
      return;
    }
    renderExerciseCards(ok, true);
    renderPagination(state.page, state.totalPages);
  } catch (err) {
    renderError(normalizeError(err));
  }
}

function renderFavoritesEmpty() {
  // Text matches the design screenshot wording.
  els.list.innerHTML = `
    <div class="empty-fav">
      <p class="empty-fav__text">It appears that you haven’t added any exercises to your favorites yet. To get started, you can add exercises to your favorites for easier access in the future.</p>
    </div>
  `;
}

/* -------------------- Pagination -------------------- */

function renderPagination(page, total) {
  if (!els.pagination) return;
  const t = Number(total) || 1;
  if (t <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  const maxBtns = 7;
  const cur = clamp(Number(page) || 1, 1, t);
  let start = Math.max(1, cur - Math.floor(maxBtns / 2));
  let end = Math.min(t, start + maxBtns - 1);
  start = Math.max(1, end - maxBtns + 1);

  const btns = [];
  for (let p = start; p <= end; p += 1) {
    btns.push(
      `<button class="page ${p === cur ? 'is-active' : ''}" type="button" data-page="${p}">${p}</button>`
    );
  }
  els.pagination.innerHTML = btns.join('');
}

/* -------------------- Modals -------------------- */

function renderStars(rating) {
  const r = clamp(Number(rating) || 0, 0, 5);
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  const stars = [];
  for (let i = 1; i <= 5; i += 1) {
    const filled = i <= full || (i === full + 1 && half);
    stars.push(
      `<svg class="star" width="18" height="18" aria-hidden="true"><use href="#${filled ? 'icon-star-filled' : 'icon-star-empty'}"></use></svg>`
    );
  }
  return stars.join('');
}

async function openExerciseModal(id) {
  state.currentExerciseId = String(id);
  els.exContent.innerHTML = `<p class="modal__loading">Loading...</p>`;
  els.exBackdrop.classList.remove('is-hidden');
  lockScroll(true);

  try {
    const ex = await apiGet(`/exercises/${encodeURIComponent(id)}`);
    const isFav = isFavoriteId(id);

    const name = ex?.name || 'Exercise';
    const rating = Number(ex?.rating) || 0;
    const target = ex?.target || '';
    const bodyPart = ex?.bodyPart || ex?.bodypart || '';
    const equipment = ex?.equipment || '';
    const popularity = ex?.popularity ?? '';
    const burned = ex?.burnedCalories ?? ex?.burnedcalories ?? ex?.calories ?? 0;
    const desc = ex?.description || '';
    const img = ex?.gifUrl || ex?.imgURL || ex?.imgUrl || '';

    els.exContent.innerHTML = `
      <div class="ex-modal__grid">
        <div class="ex-modal__media">
          ${img ? `<img class="ex-modal__img" src="${escapeAttr(img)}" alt="${escapeAttr(name)}" />` : ''}
        </div>
        <div class="ex-modal__info">
          <h2 class="ex-modal__title">${escapeHtml(name)}</h2>

          <div class="ex-modal__rating">
            <span class="ex-modal__rating-val">${escapeHtml(rating.toFixed(1))}</span>
            <div class="stars" aria-hidden="true">${renderStars(rating)}</div>
          </div>

          <div class="ex-modal__props">
            <div class="prop"><span class="prop__label">Target</span><span class="prop__val">${escapeHtml(target)}</span></div>
            <div class="prop"><span class="prop__label">Body part</span><span class="prop__val">${escapeHtml(bodyPart)}</span></div>
            <div class="prop"><span class="prop__label">Equipment</span><span class="prop__val">${escapeHtml(equipment)}</span></div>
            <div class="prop"><span class="prop__label">Popular</span><span class="prop__val">${escapeHtml(String(popularity))}</span></div>
            <div class="prop"><span class="prop__label">Burned calories</span><span class="prop__val">${escapeHtml(String(burned))} / 3 min</span></div>
          </div>

          <p class="ex-modal__desc">${escapeHtml(desc)}</p>

          <div class="modal-actions">
            <button class="btn btn--light" type="button" data-fav-toggle="${escapeAttr(id)}">
              <span class="btn__inner">
                <svg class="icon" width="18" height="18" aria-hidden="true"><use href="#icon-heart"></use></svg>
                <span>${isFav ? 'Remove from favorites' : 'Add to favorites'}</span>
              </span>
            </button>

            <button class="btn" type="button" data-give-rating="${escapeAttr(id)}">Give a rating</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    els.exContent.innerHTML = `<p class="modal__loading">${escapeHtml(normalizeError(err))}</p>`;
  }
}

function closeExerciseModal() {
  els.exBackdrop.classList.add('is-hidden');
  els.exContent.innerHTML = '';
  lockScroll(false);
}

function openRatingModal(id) {
  state.currentExerciseId = String(id);
  closeExerciseModal();
  els.rateBackdrop.classList.remove('is-hidden');
  lockScroll(true);

  els.rateContent.innerHTML = `
    <form class="rate-form" data-rate-form>
      <p class="rate-form__label">Rating</p>

      <div class="rate-stars" data-rate-stars>
        ${[1, 2, 3, 4, 5]
          .map(
            n =>
              `<button class="rate-star" type="button" data-rate="${n}" aria-label="Rate ${n}">
                <svg class="star" width="24" height="24" aria-hidden="true"><use href="#icon-star-empty"></use></svg>
              </button>`
          )
          .join('')}
      </div>

      <input class="field" type="email" name="email" placeholder="Email" required />
      <textarea class="field" name="comment" placeholder="Your comment" rows="3"></textarea>

      <button class="btn btn--wide" type="submit">Send</button>
      <p class="form-msg" data-rate-msg></p>
    </form>
  `;

  const form = els.rateContent.querySelector('[data-rate-form]');
  const msg = els.rateContent.querySelector('[data-rate-msg]');
  const starsWrap = els.rateContent.querySelector('[data-rate-stars]');

  let selected = 0;
  const paint = () => {
    const btns = Array.from(starsWrap.querySelectorAll('[data-rate]'));
    btns.forEach(btn => {
      const n = Number(btn.getAttribute('data-rate'));
      const use = btn.querySelector('use');
      if (use) use.setAttribute('href', `#${n <= selected ? 'icon-star-filled' : 'icon-star-empty'}`);
    });
  };

  starsWrap.addEventListener('click', e => {
    const btn = e.target.closest('[data-rate]');
    if (!btn) return;
    selected = Number(btn.getAttribute('data-rate')) || 0;
    paint();
  });

  form.addEventListener(
    'submit',
    async e => {
      e.preventDefault();
      msg.textContent = '';

      const fd = new FormData(form);
      const email = String(fd.get('email') || '').trim();
      const comment = String(fd.get('comment') || '').trim();

      if (!EMAIL_RE.test(email)) {
        msg.textContent = 'Invalid email format.';
        return;
      }
      if (!selected) {
        msg.textContent = 'Choose rating 1..5.';
        return;
      }

      try {
        // API endpoint (works with the current backend used in the starter repo)
        // Extra fields are sent too (backend may ignore them).
        await apiPatch(`/exercises/${encodeURIComponent(id)}/rating`, {
          rating: selected,
          email,
          comment,
        });

        closeRatingModal();
        await openExerciseModal(id);
      } catch (err) {
        msg.textContent = normalizeError(err);
      }
    },
    { once: true }
  );

  paint();
}

function closeRatingModal() {
  els.rateBackdrop.classList.add('is-hidden');
  els.rateContent.innerHTML = '';
  lockScroll(false);
}

let _scrollLockY = 0;

function lockScroll(lock) {
  const root = document.documentElement;

  if (lock) {
    _scrollLockY = window.scrollY || 0;
    root.classList.add('is-locked');
    // Prevent page jump on mobile when opening modals
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  } else {
    root.classList.remove('is-locked');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, _scrollLockY);
  }
}

/* -------------------- Rendering helpers -------------------- */

function setLoading() {
  els.list.innerHTML = `
    <div class="loading">
      <div class="spinner" aria-hidden="true"></div>
    </div>
  `;
}

function renderError(text) {
  els.list.innerHTML = `
    <div class="loading">
      <p class="empty-fav__text">${escapeHtml(text)}</p>
    </div>
  `;
}

/* -------------------- Events -------------------- */

function closeMenu() {
  if (!els.menu) return;
  els.menu.classList.add('is-hidden');
  lockScroll(false);
}

function openMenu() {
  if (!els.menu) return;
  els.menu.classList.remove('is-hidden');
  lockScroll(true);
}

function attachEvents() {
  window.addEventListener('hashchange', handleRoute);

  els.burger?.addEventListener('click', openMenu);
  els.menuClose?.addEventListener('click', closeMenu);
  els.menu?.addEventListener('click', e => {
    if (e.target === els.menu) closeMenu();
  });
  els.menuLinks.forEach(a => a.addEventListener('click', closeMenu));

  els.tabs?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-filter-btn]');
    if (!btn) return;
    const label = btn.getAttribute('data-filter-btn');
    if (!label || !FILTERS.includes(label)) return;
    if (state.route !== 'home') return;
    if (state.filter === label && state.mode === 'categories') return;

    setActiveTab(label);
    state.page = 1;
    state.totalPages = 1;
    state.mode = 'categories';
    state.category = null;
    state.keyword = '';
    if (els.searchInput) els.searchInput.value = '';
    applyView();
    await loadCategories();
  });

  els.titleBack?.addEventListener('click', async () => {
    if (state.route !== 'home') return;
    state.mode = 'categories';
    state.category = null;
    state.keyword = '';
    state.page = 1;
    if (els.searchInput) els.searchInput.value = '';
    applyView();
    await loadCategories();
  });

  els.searchForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (state.route !== 'home' || state.mode !== 'exercises' || !state.category) return;
    state.keyword = String(els.searchInput?.value || '').trim();
    state.page = 1;
    await loadExercises();
  });

  els.pagination?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    const p = Number(btn.getAttribute('data-page')) || 1;
    if (p === state.page) return;
    state.page = p;
    if (state.route === 'favorites') return loadFavorites();
    if (state.mode === 'exercises') return loadExercises();
    return loadCategories();
  });

  els.list?.addEventListener('click', async e => {
    const tile = e.target.closest('[data-tile-name]');
    if (tile && state.route === 'home' && state.mode === 'categories') {
      const name = tile.getAttribute('data-tile-name') || '';
      const typeKey = FILTER_TO_API[state.filter] || 'muscles';
      state.category = { name, typeKey };
      state.mode = 'exercises';
      state.page = 1;
      state.keyword = '';
      if (els.searchInput) els.searchInput.value = '';
      applyView();
      return loadExercises();
    }

    const start = e.target.closest('[data-start]');
    if (start) {
      const id = start.getAttribute('data-start');
      if (id) return openExerciseModal(id);
    }

    const favToggle = e.target.closest('[data-fav-toggle]');
    if (favToggle) {
      const id = favToggle.getAttribute('data-fav-toggle');
      if (!id) return;
      toggleFavoriteId(id);

      // If we are on favorites page, refresh.
      if (state.route === 'favorites') {
        return loadFavorites();
      }
      // If inside exercise modal, refresh modal content so button text updates.
      if (!els.exBackdrop.classList.contains('is-hidden') && state.currentExerciseId === String(id)) {
        return openExerciseModal(id);
      }
    }

    const giveRating = e.target.closest('[data-give-rating]');
    if (giveRating) {
      const id = giveRating.getAttribute('data-give-rating');
      if (id) return openRatingModal(id);
    }
  });

  // Modals close
  els.exClose?.addEventListener('click', closeExerciseModal);
  // Handle buttons inside Exercise modal (favorites + rating)
  els.exBackdrop?.addEventListener('click', async e => {
    // Toggle favorite (modal button)
    const favToggle = e.target.closest('[data-fav-toggle]');
    if (favToggle) {
      const id = favToggle.getAttribute('data-fav-toggle');
      if (!id) return;
      toggleFavoriteId(id);

      // If opened from Favorites page, close modal and refresh list
      if (state.route === 'favorites') {
        closeExerciseModal();
        return loadFavorites();
      }
      // Otherwise re-render modal so button label updates
      if (state.currentExerciseId === String(id)) {
        return openExerciseModal(id);
      }
      return;
    }

    // Open rating modal (modal button)
    const giveRating = e.target.closest('[data-give-rating]');
    if (giveRating) {
      const id = giveRating.getAttribute('data-give-rating');
      if (id) return openRatingModal(id);
      return;
    }

    // Click outside content closes modal
    if (e.target === els.exBackdrop) closeExerciseModal();
  });

  els.rateClose?.addEventListener('click', closeRatingModal);
  els.rateBackdrop?.addEventListener('click', e => {
    if (e.target === els.rateBackdrop) closeRatingModal();
  });

  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!els.rateBackdrop.classList.contains('is-hidden')) return closeRatingModal();
    if (!els.exBackdrop.classList.contains('is-hidden')) return closeExerciseModal();
    if (els.menu && !els.menu.classList.contains('is-hidden')) return closeMenu();
  });

  // Subscribe
  els.subForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (els.subMsg) els.subMsg.textContent = '';

    const emailEl = els.subForm.querySelector('input[type="email"]');
    const email = String(emailEl?.value || '').trim();

    if (!EMAIL_RE.test(email)) {
      if (els.subMsg) els.subMsg.textContent = 'Invalid email format.';
      return;
    }

    try {
      await apiPost('/subscription', { email });
      if (els.subMsg) els.subMsg.textContent = 'Subscription successful.';
      if (emailEl) emailEl.value = '';
    } catch (err) {
      if (els.subMsg) els.subMsg.textContent = normalizeError(err);
    }
  });

  // Scroll top
  const onScroll = () => {
    const show = window.scrollY > 500;
    els.scrollTop?.classList.toggle('is-visible', show);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  els.scrollTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* -------------------- Init -------------------- */

function init() {
  // Default route
  if (!window.location.hash) {
    window.location.hash = '#/home';
  }
  setActiveTab(state.filter);
  attachEvents();
  loadQuoteOfDay();
  handleRoute();
}

init();
