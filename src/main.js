import './css/styles.css';

const BASE_URL = 'https://your-energy.b.goit.study/api';
const EMAIL_RE = /^\w+(\.\w+)?@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;

// Favorites must be stored as IDs only (teacher requirement)
const FAVORITES_KEY = 'yourEnergy:favoritesIds';

const els = {
  quoteText: document.querySelector('[data-quote-text]'),
  quoteAuthor: document.querySelector('[data-quote-author]'),
  tabs: Array.from(document.querySelectorAll('[data-filter]')),
  list: document.querySelector('[data-list]'),
  pagination: document.querySelector('[data-pagination]'),
  backBtn: document.querySelector('[data-back]'),
  searchForm: document.querySelector('[data-search-form]'),
  subscribeForm: document.querySelector('[data-subscribe-form]'),
  subscribeMsg: document.querySelector('[data-subscribe-msg]'),

  burger: document.querySelector('[data-burger]'),
  menu: document.querySelector('[data-menu]'),
  menuClose: document.querySelector('[data-menu-close]'),
  menuLinks: Array.from(document.querySelectorAll('[data-menu-link]')),

  topBtn: document.querySelector('[data-top]'),

  exBackdrop: document.querySelector('[data-ex-modal-backdrop]'),
  exClose: document.querySelector('[data-ex-modal-close]'),
  exContent: document.querySelector('[data-ex-modal-content]'),

  rateBackdrop: document.querySelector('[data-rate-modal-backdrop]'),
  rateClose: document.querySelector('[data-rate-modal-close]'),
  rateContent: document.querySelector('[data-rate-modal-content]'),
};

const state = {
  route: 'home', // home | favorites
  filter: 'Muscles',
  mode: 'categories', // categories | exercises | favorites
  category: null, // { typeKey, name }
  keyword: '',
  page: 1,
  limitCategories: 12,
  limitExercises: 9,
  totalPages: 1,
  currentExerciseId: null,
};

let escHandler = null;

init();

/* -------------------- Init -------------------- */

async function init() {
  setupMenu();
  setupTabs();
  setupBackAndSearch();
  setupFooterSubscribe();
  setupModals();
  setupScrollTop();

  window.addEventListener('hashchange', onRouteChange);

  await loadQuoteCached();
  onRouteChange();
}

/* -------------------- Routing -------------------- */

function onRouteChange() {
  const hash = window.location.hash || '#/';
  state.route = hash.startsWith('#/favorites') ? 'favorites' : 'home';

  highlightNav();

  state.page = 1;
  state.totalPages = 1;

  if (state.route === 'favorites') {
    state.mode = 'favorites';
    renderFavorites();
  } else {
    state.mode = 'categories';
    state.category = null;
    state.keyword = '';
    els.backBtn.classList.add('is-hidden');
    els.searchForm.classList.add('is-hidden');
    els.searchForm.reset();
    loadCategories();
  }
}

function highlightNav() {
  const current = state.route;
  document.querySelectorAll('[data-nav]').forEach(a => {
    const key = a.getAttribute('data-nav');
    a.classList.toggle('is-active', key === current);
  });
}

/* -------------------- Menu -------------------- */

function setupMenu() {
  if (!els.burger || !els.menu) return;

  const open = () => {
    els.menu.classList.remove('is-hidden');
    els.menu.setAttribute('aria-hidden', 'false');
    els.burger.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    els.menu.classList.add('is-hidden');
    els.menu.setAttribute('aria-hidden', 'true');
    els.burger.setAttribute('aria-expanded', 'false');
  };

  els.burger.addEventListener('click', open);
  els.menuClose.addEventListener('click', close);
  els.menu.addEventListener('click', e => {
    if (e.target === els.menu) close();
  });
  els.menuLinks.forEach(l => l.addEventListener('click', close));
}

/* -------------------- Tabs -------------------- */

function setupTabs() {
  els.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.route !== 'home') return;
      const filter = btn.getAttribute('data-filter');
      state.filter = filter;
      state.mode = 'categories';
      state.category = null;
      state.keyword = '';
      state.page = 1;

      els.tabs.forEach(b => b.classList.toggle('is-active', b === btn));
      els.backBtn.classList.add('is-hidden');
      els.searchForm.classList.add('is-hidden');
      els.searchForm.reset();

      loadCategories();
    });
  });
}

/* -------------------- Back + Search -------------------- */

function setupBackAndSearch() {
  els.backBtn.addEventListener('click', () => {
    state.mode = 'categories';
    state.category = null;
    state.keyword = '';
    state.page = 1;
    els.backBtn.classList.add('is-hidden');
    els.searchForm.classList.add('is-hidden');
    els.searchForm.reset();
    loadCategories();
  });

  els.searchForm.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(els.searchForm);
    state.keyword = String(fd.get('keyword') || '').trim();
    state.page = 1;
    loadExercises();
  });
}

/* -------------------- Footer subscribe -------------------- */

function setupFooterSubscribe() {
  els.subscribeForm.addEventListener('submit', async e => {
    e.preventDefault();
    els.subscribeMsg.textContent = '';

    const fd = new FormData(els.subscribeForm);
    const email = String(fd.get('email') || '').trim();

    if (!EMAIL_RE.test(email)) {
      els.subscribeMsg.textContent = 'Invalid email format.';
      return;
    }

    try {
      await apiPost('/subscription', { email });
      els.subscribeMsg.textContent = 'Subscribed successfully!';
      els.subscribeForm.reset();
    } catch (err) {
      els.subscribeMsg.textContent = normalizeError(err);
    }
  });
}

/* -------------------- Scroll top -------------------- */

function setupScrollTop() {
  if (!els.topBtn) return;

  const toggle = () => {
    els.topBtn.classList.toggle('is-show', window.scrollY > 420);
  };
  toggle();
  window.addEventListener('scroll', toggle, { passive: true });

  els.topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* -------------------- Modals -------------------- */

function setupModals() {
  els.exClose.addEventListener('click', closeExerciseModal);
  els.exBackdrop.addEventListener('click', e => {
    if (e.target === els.exBackdrop) closeExerciseModal();
  });

  els.rateClose.addEventListener('click', closeRatingModal);
  els.rateBackdrop.addEventListener('click', e => {
    if (e.target === els.rateBackdrop) closeRatingModal();
  });

  document.addEventListener('click', async e => {
    const startBtn = e.target.closest('[data-start]');
    if (startBtn) {
      const id = startBtn.getAttribute('data-start');
      await openExerciseModal(id);
      return;
    }

    const catBtn = e.target.closest('[data-category]');
    if (catBtn) {
      const name = catBtn.getAttribute('data-category');
      state.mode = 'exercises';
      state.page = 1;
      state.keyword = '';

      els.searchForm.classList.remove('is-hidden');
      els.backBtn.classList.remove('is-hidden');
      els.searchForm.reset();

      state.category = { name, typeKey: filterToKey(state.filter) };
      await loadExercises();
      return;
    }

    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) {
      const page = Number(pageBtn.getAttribute('data-page'));
      if (!Number.isFinite(page) || page < 1 || page > state.totalPages) return;
      state.page = page;

      if (state.route === 'favorites') renderFavorites();
      else if (state.mode === 'categories') loadCategories();
      else loadExercises();
      return;
    }

    const favToggle = e.target.closest('[data-fav-toggle]');
    if (favToggle) {
      const id = favToggle.getAttribute('data-fav-toggle');
      toggleFavoriteId(id);

      if (state.route === 'favorites') {
        renderFavorites();
      } else if (!els.exBackdrop.classList.contains('is-hidden')) {
        const btn = els.exContent.querySelector('[data-fav-toggle]');
        if (btn) btn.innerHTML = favoriteBtnInner(isFavoriteId(id));
      }
      return;
    }

    const giveRating = e.target.closest('[data-give-rating]');
    if (giveRating) {
      const id = giveRating.getAttribute('data-give-rating');
      openRatingModal(id);
      return;
    }
  });
}

function attachEscForModals() {
  if (escHandler) return;

  escHandler = e => {
    if (e.key !== 'Escape') return;
    if (!els.rateBackdrop.classList.contains('is-hidden')) closeRatingModal();
    else if (!els.exBackdrop.classList.contains('is-hidden')) closeExerciseModal();
  };
  document.addEventListener('keydown', escHandler);
}

function detachEscIfModalsClosed() {
  const anyModalOpen =
    !els.rateBackdrop.classList.contains('is-hidden') ||
    !els.exBackdrop.classList.contains('is-hidden');

  if (anyModalOpen) return;
  if (!escHandler) return;

  document.removeEventListener('keydown', escHandler);
  escHandler = null;
}

/* -------------------- Quote (cached) -------------------- */

async function loadQuoteCached() {
  const key = 'yourEnergy:quote';
  const today = new Date().toISOString().slice(0, 10);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.date === today && cached.quote) {
        renderQuote(cached.quote);
        return;
      }
    }
  } catch (_) {}

  try {
    const quote = await apiGet('/quote');
    localStorage.setItem(key, JSON.stringify({ date: today, quote }));
    renderQuote(quote);
  } catch (err) {
    els.quoteText.textContent = 'Failed to load quote.';
    els.quoteAuthor.textContent = '';
  }
}

function renderQuote(quote) {
  const text = quote?.quote || quote?.text || '';
  const author = quote?.author || '';
  els.quoteText.textContent = text || '—';
  els.quoteAuthor.textContent = author;
}

/* -------------------- Home: categories -------------------- */

async function loadCategories() {
  if (state.route !== 'home') return;

  setLoading();
  els.pagination.innerHTML = '';

  const filter = state.filter;
  const page = state.page;
  const limit = state.limitCategories;

  try {
    const data = await apiGet(`/filters?${qs({ filter, page, limit })}`);
    const items = Array.isArray(data?.results) ? data.results : [];
    state.totalPages = Number(data?.totalPages) || 1;

    renderCategories(items);
    renderPagination(state.page, state.totalPages);
  } catch (err) {
    els.list.innerHTML = `<div class="card"><p class="muted">${escapeHtml(normalizeError(err))}</p></div>`;
  }
}

function renderCategories(items) {
  state.mode = 'categories';

  els.list.innerHTML = items
    .map(it => {
      const name = it?.name || '';
      const subtitle = it?.filter || state.filter;
      const img = it?.imgURL || it?.imgUrl || it?.imageUrl || it?.img || '';
      return `
        <button class="card-tile" type="button" data-category="${escapeAttr(name)}">
          <div class="card-tile__bg" style="${img ? `background-image:url('${escapeAttr(img)}')` : ''}"></div>

          <div class="card-tile__top">
            <span class="badge">${escapeHtml(subtitle)}</span>
            <span class="open" aria-hidden="true">
              Open
              <svg class="icon" width="18" height="18">
                <use href="./img/sprite.svg#icon-arrow-right"></use>
              </svg>
            </span>
          </div>

          <h3 class="card-tile__title">${escapeHtml(name)}</h3>
          <p class="card-tile__hint">Tap to see exercises</p>
        </button>
      `;
    })
    .join('');

  els.backBtn.classList.add('is-hidden');
  els.searchForm.classList.add('is-hidden');
}

/* -------------------- Home: exercises -------------------- */

async function loadExercises() {
  if (state.route !== 'home') return;

  if (!state.category || !state.category.typeKey) {
    state.mode = 'categories';
    return loadCategories();
  }

  setLoading();
  els.pagination.innerHTML = '';

  const page = state.page;
  const limit = state.limitExercises;

  const params = { page, limit };
  params[state.category.typeKey] = state.category.name;
  if (state.keyword) params.keyword = state.keyword;

  try {
    const data = await apiGet(`/exercises?${qs(params)}`);
    const items = Array.isArray(data?.results) ? data.results : [];
    state.totalPages = Number(data?.totalPages) || 1;

    renderExercises(items);
    renderPagination(state.page, state.totalPages);
  } catch (err) {
    els.list.innerHTML = `<div class="card"><p class="muted">${escapeHtml(normalizeError(err))}</p></div>`;
  }
}

function renderExercises(items) {
  state.mode = 'exercises';

  els.list.innerHTML = items
    .map(ex => {
      const id = ex?._id || ex?.id || '';
      const name = ex?.name || 'Exercise';
      const rating = Number(ex?.rating) || 0;
      const bodyPart = ex?.bodyPart || ex?.bodypart || '';
      const target = ex?.target || '';
      const burned = ex?.burnedCalories ?? ex?.burnedcalories ?? ex?.calories ?? 0;

      return `
        <div class="card exercise-card">
          <div class="exercise-card__top">
            <span class="badge">WORKOUT</span>
            <span class="muted">${escapeHtml(rating.toFixed(1))} ${renderStars(rating)}</span>
          </div>

          <h3 class="card__title" style="margin:0;">${escapeHtml(name)}</h3>
          <p class="muted" style="margin:0;">Burned calories: ${escapeHtml(String(burned))} / 3 min</p>
          <p class="muted" style="margin:0;">Body part: ${escapeHtml(String(bodyPart))} · Target: ${escapeHtml(String(target))}</p>

          <div class="actions" style="margin-top:6px;">
            <button class="btn" type="button" data-start="${escapeAttr(id)}">Start</button>
          </div>
        </div>
      `;
    })
    .join('');

  els.backBtn.classList.remove('is-hidden');
  els.searchForm.classList.remove('is-hidden');
}

function filterToKey(filter) {
  if (filter === 'Body parts') return 'bodypart';
  if (filter === 'Equipment') return 'equipment';
  return 'muscles';
}

/* -------------------- Favorites -------------------- */

async function renderFavorites() {
  state.mode = 'favorites';
  els.backBtn.classList.add('is-hidden');
  els.searchForm.classList.add('is-hidden');
  els.searchForm.reset();

  els.pagination.innerHTML = '';

  const ids = getFavoriteIds();
  if (!ids.length) {
    els.list.innerHTML = `<div class="card"><h3 class="card__title">Favorites is empty</h3><p class="muted">Add exercises from Home.</p></div>`;
    return;
  }

  const perPage = 9;
  const totalPages = Math.max(1, Math.ceil(ids.length / perPage));
  state.totalPages = totalPages;

  const page = Math.min(state.page, totalPages);
  state.page = page;

  const start = (page - 1) * perPage;
  const chunk = ids.slice(start, start + perPage);

  setLoading();

  const exercises = await Promise.all(
    chunk.map(async id => {
      try {
        return await apiGet(`/exercises/${encodeURIComponent(id)}`);
      } catch {
        return { id, name: 'Exercise (not found)' };
      }
    })
  );

  els.list.innerHTML = exercises
    .map(ex => {
      const id = ex?._id || ex?.id || '';
      const name = ex?.name || 'Exercise';
      const bodyPart = ex?.bodyPart || ex?.bodypart || '';
      const target = ex?.target || '';
      const burned = ex?.burnedCalories ?? ex?.burnedcalories ?? ex?.calories ?? 0;

      return `
        <div class="card exercise-card">
          <div class="exercise-card__top">
            <span class="badge">FAVORITE</span>
            <button class="icon-btn" type="button" aria-label="Remove from favorites" data-fav-toggle="${escapeAttr(id)}">
              <svg class="icon" width="20" height="20" aria-hidden="true">
                <use href="./img/sprite.svg#icon-trash"></use>
              </svg>
            </button>
          </div>

          <h3 class="card__title" style="margin:0;">${escapeHtml(name)}</h3>
          <p class="muted" style="margin:0;">Burned calories: ${escapeHtml(String(burned))} / 3 min</p>
          <p class="muted" style="margin:0;">Body part: ${escapeHtml(String(bodyPart))} · Target: ${escapeHtml(String(target))}</p>

          <div class="actions" style="margin-top:6px;">
            <button class="btn" type="button" data-start="${escapeAttr(id)}">Start</button>
          </div>
        </div>
      `;
    })
    .join('');

  renderPagination(state.page, state.totalPages);
}

/* -------------------- Exercise modal -------------------- */

async function openExerciseModal(id) {
  state.currentExerciseId = id;
  els.exContent.innerHTML = `<p class="muted">Loading...</p>`;
  els.exBackdrop.classList.remove('is-hidden');
  attachEscForModals();

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
    const img = ex?.gifUrl || ex?.imgURL || ex?.imgUrl || ex?.imageUrl || '';

    els.exContent.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
        <div>
          ${img ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(name)}" style="width:100%; border-radius:18px; border:1px solid var(--line);" />` : ''}
        </div>

        <div>
          <h2 style="margin:0 0 8px; font-size:22px;">${escapeHtml(name)}</h2>
          <div class="muted" style="margin-bottom:10px;">${escapeHtml(rating.toFixed(1))} ${renderStars(rating)}</div>

          <p class="muted" style="margin:0 0 6px;"><b>Target:</b> ${escapeHtml(String(target))}</p>
          <p class="muted" style="margin:0 0 6px;"><b>Body part:</b> ${escapeHtml(String(bodyPart))}</p>
          <p class="muted" style="margin:0 0 6px;"><b>Equipment:</b> ${escapeHtml(String(equipment))}</p>
          <p class="muted" style="margin:0 0 6px;"><b>Popular:</b> ${escapeHtml(String(popularity))}</p>
          <p class="muted" style="margin:0 0 6px;"><b>Burned calories:</b> ${escapeHtml(String(burned))} / 3 min</p>
          <p class="muted" style="margin:10px 0 0;">${escapeHtml(desc)}</p>

          <div class="actions" style="justify-content:flex-start; margin-top:14px;">
            <button class="btn btn--light" type="button" data-fav-toggle="${escapeAttr(id)}">
              ${favoriteBtnInner(isFav)}
            </button>
            <button class="btn" type="button" data-give-rating="${escapeAttr(id)}">Give a rating</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    els.exContent.innerHTML = `<p class="muted">${escapeHtml(normalizeError(err))}</p>`;
  }
}

function closeExerciseModal() {
  els.exBackdrop.classList.add('is-hidden');
  els.exContent.innerHTML = '';
  detachEscIfModalsClosed();
}

function favoriteBtnInner(isFav) {
  return `
    <span style="display:inline-flex; align-items:center; gap:8px;">
      <svg class="icon" width="18" height="18" aria-hidden="true">
        <use href="./img/sprite.svg#icon-heart"></use>
      </svg>
      <span>${isFav ? 'Remove from favorites' : 'Add to favorites'}</span>
    </span>
  `;
}

/* -------------------- Rating modal -------------------- */

function openRatingModal(id) {
  state.currentExerciseId = id;
  closeExerciseModal();

  els.rateContent.innerHTML = `
    <form data-rate-form>
      <p class="muted" style="margin-top:0;">Rating</p>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
        ${[1,2,3,4,5].map(n => `
          <label style="display:flex; align-items:center; gap:8px; border:1px solid var(--line); padding:10px 12px; border-radius:12px;">
            <input type="radio" name="rating" value="${n}" required />
            <span class="stars">${renderStars(n)}</span>
          </label>
        `).join('')}
      </div>

      <input class="subscribe__input" style="background:var(--surface); color:var(--text); border:1px solid var(--line);" type="email" name="email" placeholder="Email" required />
      <textarea class="subscribe__input" style="background:var(--surface); color:var(--text); border:1px solid var(--line); border-radius:18px;" name="comment" placeholder="Your comment" rows="3"></textarea>

      <button class="btn" type="submit">Send</button>
      <p class="muted" data-rate-msg style="min-height:16px;"></p>
    </form>
  `;

  els.rateBackdrop.classList.remove('is-hidden');
  attachEscForModals();

  const form = els.rateContent.querySelector('[data-rate-form]');
  const msg = els.rateContent.querySelector('[data-rate-msg]');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';

    const fd = new FormData(form);
    const rating = Number(fd.get('rating'));
    const email = String(fd.get('email') || '').trim();

    if (!EMAIL_RE.test(email)) {
      msg.textContent = 'Invalid email format.';
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      msg.textContent = 'Choose rating 1..5';
      return;
    }

    try {
      await apiPatch(`/exercises/${encodeURIComponent(id)}/rating`, { rating });
      closeRatingModal();
      await openExerciseModal(id);
    } catch (err) {
      msg.textContent = normalizeError(err);
    }
  }, { once: true });
}

function closeRatingModal() {
  els.rateBackdrop.classList.add('is-hidden');
  els.rateContent.innerHTML = '';
  detachEscIfModalsClosed();
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
  const key = String(id);
  const idx = ids.indexOf(key);

  if (idx >= 0) {
    ids.splice(idx, 1);
    setFavoriteIds(ids);
    return;
  }

  ids.unshift(key);
  setFavoriteIds(ids);
}

/* -------------------- Pagination -------------------- */

function renderPagination(page, totalPages) {
  const p = Number(page) || 1;
  const t = Number(totalPages) || 1;

  const parts = [];

  parts.push(pageBtn(p - 1, 'Prev', p === 1, true));

  if (t <= 7) {
    for (let i = 1; i <= t; i++) parts.push(pageBtn(i, String(i), false, false, i === p));
  } else {
    let start = Math.max(2, p - 2);
    let end = Math.min(t - 1, p + 2);

    if (p <= 3) { start = 2; end = 6; }
    if (p >= t - 2) { start = t - 5; end = t - 1; }

    parts.push(pageBtn(1, '1', false, false, p === 1));
    if (start > 2) parts.push(dots());

    for (let i = start; i <= end; i++) parts.push(pageBtn(i, String(i), false, false, i === p));

    if (end < t - 1) parts.push(dots());
    parts.push(pageBtn(t, String(t), false, false, p === t));
  }

  parts.push(pageBtn(p + 1, 'Next', p === t, false, false, true));

  els.pagination.innerHTML = parts.join('');
}

function dots() {
  return `<span class="page-dots" aria-hidden="true">…</span>`;
}

function pageBtn(page, label, disabled = false, isPrev = false, active = false, isNext = false) {
  const icon = isPrev
    ? `<svg class="icon" width="18" height="18" aria-hidden="true"><use href="./img/sprite.svg#icon-chev-left"></use></svg>`
    : isNext
      ? `<svg class="icon" width="18" height="18" aria-hidden="true"><use href="./img/sprite.svg#icon-chev-right"></use></svg>`
      : '';

  const text = (isPrev || isNext) ? '' : escapeHtml(label);

  const safePage = Number(page);
  const data = Number.isFinite(safePage) ? `data-page="${safePage}"` : '';

  return `
    <button class="page-btn ${active ? 'is-active' : ''}" type="button" ${data} ${disabled ? 'disabled' : ''} aria-label="${escapeAttr(label)}">
      ${isPrev ? icon : ''}
      ${text}
      ${isNext ? icon : ''}
    </button>
  `;
}

function setLoading() {
  els.list.innerHTML = `<div class="card"><p class="muted">Loading...</p></div>`;
}

/* -------------------- API -------------------- */

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw await toError(res);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return res.json().catch(() => ({}));
}

async function apiPatch(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return res.json().catch(() => ({}));
}

async function toError(res) {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const data = await res.json();
    msg = data?.message || data?.error || msg;
  } catch (_) {}
  return new Error(msg);
}

function normalizeError(err) {
  return (err && err.message) ? err.message : 'Request failed';
}

/* -------------------- Utils -------------------- */

function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    p.set(k, s);
  });
  return p.toString();
}

function renderStars(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.round(r);

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const id = i <= full ? 'icon-star-filled' : 'icon-star-empty';
    stars.push(
      `<svg class="icon" width="16" height="16" aria-hidden="true">
        <use href="./img/sprite.svg#${id}"></use>
      </svg>`
    );
  }
  return `<span class="stars">${stars.join('')}</span>`;
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
