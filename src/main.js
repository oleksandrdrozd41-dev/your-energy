import './css/styles.css';

const BASE_URL = 'https://your-energy.b.goit.study/api';
const EMAIL_RE = /^\w+(\.\w+)?@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;

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
  mode: 'categories', // categories | exercises
  category: null, // { typeKey, name }
  keyword: '',
  page: 1,
  limitCategories: 12,
  limitExercises: 10,
  totalPages: 1,
  currentExerciseId: null,
};

init();

async function init() {
  setupNav();
  setupMenu();
  setupSocialStubs();
  setupTabs();
  setupBackAndSearch();
  setupFooterSubscribe();
  setupModals();

  window.addEventListener('hashchange', onRouteChange);

  await loadQuoteCached();
  onRouteChange();
}

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

function setupNav() {
  // nothing extra; hash routing works by default
}

function setupMenu() {
  if (!els.burger || !els.menu) return;

  const open = () => {
    els.menu.classList.remove('is-hidden');
    els.burger.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    els.menu.classList.add('is-hidden');
    els.burger.setAttribute('aria-expanded', 'false');
  };

  els.burger.addEventListener('click', open);
  els.menuClose.addEventListener('click', close);
  els.menu.addEventListener('click', e => {
    if (e.target === els.menu) close();
  });
  els.menuLinks.forEach(l => l.addEventListener('click', close));
}

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
    const formData = new FormData(els.searchForm);
    state.keyword = String(formData.get('keyword') || '').trim();
    state.page = 1;
    loadExercises();
  });
}

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

function setupModals() {
  // Exercise modal
  els.exClose.addEventListener('click', closeExerciseModal);
  els.exBackdrop.addEventListener('click', e => {
    if (e.target === els.exBackdrop) closeExerciseModal();
  });

  // Rating modal
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
      const filter = state.filter;
      state.mode = 'exercises';
      state.page = 1;
      state.keyword = '';
      els.searchForm.classList.remove('is-hidden');
      els.backBtn.classList.remove('is-hidden');
      els.searchForm.reset();

      state.category = { name, typeKey: filterToKey(filter) };
      await loadExercises();
      return;
    }

    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) {
      const page = Number(pageBtn.getAttribute('data-page'));
      if (!Number.isFinite(page) || page < 1 || page > state.totalPages) return;
      state.page = page;
      if (state.route === 'favorites') {
        renderFavorites();
      } else if (state.mode === 'categories') {
        loadCategories();
      } else {
        loadExercises();
      }
      return;
    }

    const favToggle = e.target.closest('[data-fav-toggle]');
    if (favToggle) {
      const id = favToggle.getAttribute('data-fav-toggle');
      toggleFavoriteById(id);
      if (state.route === 'favorites') renderFavorites();
      else if (!els.exBackdrop.classList.contains('is-hidden')) {
        // refresh modal button label
        const ex = getFavoriteById(id);
        const btn = els.exContent.querySelector('[data-fav-toggle]');
        if (btn) btn.textContent = ex ? 'Remove from favorites' : 'Add to favorites';
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

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!els.rateBackdrop.classList.contains('is-hidden')) closeRatingModal();
    else if (!els.exBackdrop.classList.contains('is-hidden')) closeExerciseModal();
    else if (!els.menu.classList.contains('is-hidden')) {
      els.menu.classList.add('is-hidden');
      els.burger.setAttribute('aria-expanded', 'false');
    }
  });
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
  } catch (_) {
    // ignore
  }

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
    els.list.innerHTML = `<div class="card"><p class="meta">${escapeHtml(normalizeError(err))}</p></div>`;
  }
}

function renderCategories(items) {
  state.mode = 'categories';

  els.list.innerHTML = items
    .map(it => {
      const name = it?.name || '';
      const subtitle = it?.filter || state.filter;
      const img = it?.imgURL || it?.imgUrl || it?.imageUrl || '';
      const style = img ? `style="background-image:url('${escapeAttr(img)}')"` : '';
      return `
        <button class="card" type="button" data-category="${escapeAttr(name)}" ${style}>
          <div class="card__top">
            <span class="badge">${escapeHtml(subtitle)}</span>
            <span class="meta">Open →</span>
          </div>
          <h3 class="title">${escapeHtml(name)}</h3>
          <p class="meta">Tap to see exercises</p>
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

  const params = {
    page,
    limit,
  };

  params[state.category.typeKey] = state.category.name;

  if (state.keyword) params.keyword = state.keyword;

  try {
    const data = await apiGet(`/exercises?${qs(params)}`);
    const items = Array.isArray(data?.results) ? data.results : [];
    state.totalPages = Number(data?.totalPages) || 1;

    renderExercises(items);
    renderPagination(state.page, state.totalPages);
  } catch (err) {
    els.list.innerHTML = `<div class="card"><p class="meta">${escapeHtml(normalizeError(err))}</p></div>`;
  }
}

function renderExercises(items) {
  els.list.innerHTML = items
    .map(ex => {
      const id = ex?._id || ex?.id || '';
      const name = ex?.name || 'Exercise';
      const rating = Number(ex?.rating) || 0;
      const bodyPart = ex?.bodyPart || ex?.bodypart || '';
      const target = ex?.target || '';
      const burned = ex?.burnedCalories ?? ex?.burnedcalories ?? ex?.calories ?? 0;

      return `
        <div class="card">
          <div class="card__top">
            <span class="badge">WORKOUT</span>
            <span class="meta">${escapeHtml(rating.toFixed(2))} ${renderStars(rating)}</span>
          </div>
          <h3 class="title">${escapeHtml(name)}</h3>
          <p class="meta">Burned calories: ${escapeHtml(String(burned))} / 3 min</p>
          <p class="meta">Body part: ${escapeHtml(String(bodyPart))} · Target: ${escapeHtml(String(target))}</p>
          <div class="actions">
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

function renderFavorites() {
  state.mode = 'favorites';
  els.backBtn.classList.add('is-hidden');
  els.searchForm.classList.add('is-hidden');
  els.searchForm.reset();

  const favs = getFavorites();
  els.pagination.innerHTML = '';

  if (!favs.length) {
    els.list.innerHTML = `<div class="card"><h3 class="title">Favorites is empty</h3><p class="meta">Add exercises from Home.</p></div>`;
    return;
  }

  // simple pagination for favorites (client-side)
  const perPage = 9;
  const totalPages = Math.max(1, Math.ceil(favs.length / perPage));
  state.totalPages = totalPages;

  const page = Math.min(state.page, totalPages);
  state.page = page;

  const start = (page - 1) * perPage;
  const chunk = favs.slice(start, start + perPage);

  els.list.innerHTML = chunk
    .map(ex => {
      const id = ex?._id || ex?.id || '';
      const name = ex?.name || 'Exercise';
      const bodyPart = ex?.bodyPart || ex?.bodypart || '';
      const target = ex?.target || '';
      const burned = ex?.burnedCalories ?? ex?.burnedcalories ?? ex?.calories ?? 0;

      return `
        <div class="card">
          <div class="card__top">
            <span class="badge">FAVORITE</span>
            <button class="icon-btn" type="button" aria-label="Remove from favorites" data-fav-toggle="${escapeAttr(id)}">♥</button>
          </div>
          <h3 class="title">${escapeHtml(name)}</h3>
          <p class="meta">Burned calories: ${escapeHtml(String(burned))} / 3 min</p>
          <p class="meta">Body part: ${escapeHtml(String(bodyPart))} · Target: ${escapeHtml(String(target))}</p>
          <div class="actions">
            <button class="btn" type="button" data-start="${escapeAttr(id)}">Start</button>
          </div>
        </div>
      `;
    })
    .join('');

  renderPagination(state.page, state.totalPages);
}

/* -------------------- Modals -------------------- */

async function openExerciseModal(id) {
  state.currentExerciseId = id;
  els.exContent.innerHTML = `<p class="meta">Loading...</p>`;
  els.exBackdrop.classList.remove('is-hidden');

  try {
    const ex = await apiGet(`/exercises/${encodeURIComponent(id)}`);
    const isFav = Boolean(getFavoriteById(id));
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
      <div class="grid" style="grid-template-columns: 1fr; gap: 16px;">
        <div>
          ${img ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(name)}" style="width:100%; max-width:380px; border-radius:14px; border:1px solid var(--line);" />` : ''}
        </div>
        <div>
          <h2 class="title" style="font-size:22px; margin:0 0 10px;">${escapeHtml(name)}</h2>
          <p class="meta">${escapeHtml(rating.toFixed(2))} ${renderStars(rating)}</p>
          <p class="meta"><b>Target:</b> ${escapeHtml(String(target))}</p>
          <p class="meta"><b>Body part:</b> ${escapeHtml(String(bodyPart))}</p>
          <p class="meta"><b>Equipment:</b> ${escapeHtml(String(equipment))}</p>
          <p class="meta"><b>Popular:</b> ${escapeHtml(String(popularity))}</p>
          <p class="meta"><b>Burned calories:</b> ${escapeHtml(String(burned))} / 3 min</p>
          <p class="meta" style="margin-top:10px;">${escapeHtml(desc)}</p>

          <div class="actions" style="justify-content:flex-start; margin-top:14px;">
            <button class="btn" type="button" data-fav-toggle="${escapeAttr(id)}">${isFav ? 'Remove from favorites' : 'Add to favorites'}</button>
            <button class="btn" type="button" data-give-rating="${escapeAttr(id)}">Give a rating</button>
          </div>
        </div>
      </div>
    `;

    // Store minimal in favorites (so Favorites page has data)
    if (!getFavoriteById(id)) {
      // do nothing; only add by button
    }
    // keep last fetched exercise in memory for toggle action
    cacheLastExercise(ex);
  } catch (err) {
    els.exContent.innerHTML = `<p class="meta">${escapeHtml(normalizeError(err))}</p>`;
  }
}

function closeExerciseModal() {
  els.exBackdrop.classList.add('is-hidden');
  els.exContent.innerHTML = '';
}

function openRatingModal(id) {
  state.currentExerciseId = id;
  closeExerciseModal();

  els.rateContent.innerHTML = `
    <form data-rate-form>
      <p class="meta" style="margin-top:0;">Rating</p>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
        ${[1,2,3,4,5].map(n => `
          <label style="display:flex; align-items:center; gap:6px; border:1px solid var(--line); padding:8px 10px; border-radius:10px;">
            <input type="radio" name="rating" value="${n}" required />
            <span>${'★'.repeat(n)}</span>
          </label>
        `).join('')}
      </div>

      <input class="subscribe__input" type="email" name="email" placeholder="Email" required />
      <textarea class="subscribe__input" name="comment" placeholder="Your comment" rows="3" style="resize:vertical;"></textarea>

      <button class="subscribe__btn" type="submit">Send</button>
      <p class="meta" data-rate-msg style="min-height:16px;"></p>
    </form>
  `;

  els.rateBackdrop.classList.remove('is-hidden');

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
}

/* -------------------- Favorites storage -------------------- */

function getFavorites() {
  try {
    const raw = localStorage.getItem('yourEnergy:favorites');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function setFavorites(arr) {
  localStorage.setItem('yourEnergy:favorites', JSON.stringify(arr));
}

function getFavoriteById(id) {
  return getFavorites().find(x => (x?._id || x?.id) === id);
}

function toggleFavoriteById(id) {
  const favs = getFavorites();
  const idx = favs.findIndex(x => (x?._id || x?.id) === id);

  if (idx >= 0) {
    favs.splice(idx, 1);
    setFavorites(favs);
    return;
  }

  // add from last cached exercise details if possible
  const ex = getLastExercise();
  if (ex && ((ex._id || ex.id) === id)) {
    favs.unshift(ex);
    setFavorites(favs);
    return;
  }

  // fallback: store minimal
  favs.unshift({ id });
  setFavorites(favs);
}

let _lastExercise = null;
function cacheLastExercise(ex) { _lastExercise = ex; }
function getLastExercise() { return _lastExercise; }

/* -------------------- Pagination -------------------- */

function renderPagination(page, totalPages) {
  const p = Number(page) || 1;
  const t = Number(totalPages) || 1;

  const maxButtons = 7;
  let start = Math.max(1, p - Math.floor(maxButtons / 2));
  let end = Math.min(t, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  const buttons = [];

  if (p > 1) buttons.push(btn(p - 1, 'Prev'));

  for (let i = start; i <= end; i++) {
    buttons.push(btn(i, String(i), i === p));
  }

  if (p < t) buttons.push(btn(p + 1, 'Next'));

  els.pagination.innerHTML = buttons.join('');
}

function btn(page, label, active = false) {
  return `<button class="page-btn ${active ? 'is-active' : ''}" type="button" data-page="${page}">${escapeHtml(label)}</button>`;
}

function setLoading() {
  els.list.innerHTML = `<div class="card"><p class="meta">Loading...</p></div>`;
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
  } catch (_) {
    // ignore
  }
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
  const r = Math.max(0, Math.min(5, rating));
  const full = Math.round(r);
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;
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

