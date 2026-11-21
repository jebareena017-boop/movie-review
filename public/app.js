let currentRole = 'user';
let selectedRating = 0;

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

qsa('.tab').forEach((tab) => tab.addEventListener('click', () => {
  qsa('.tab').forEach((item) => item.classList.remove('active'));
  tab.classList.add('active');
  currentRole = tab.dataset.role;
  qs('#loginKicker').textContent = `${currentRole.toUpperCase()} PORTAL`;
  qs('#loginTitle').textContent = currentRole === 'admin' ? 'Admin console' : 'Welcome back';
  qs('#username').value = currentRole;
  qs('#password').value = '123';
  qs('#loginError').textContent = '';
}));

qs('#togglePassword').addEventListener('click', (event) => {
  const input = qs('#password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  event.target.textContent = show ? 'Hide' : 'Show';
});

qs('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  qs('#loginError').textContent = '';
  const response = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: currentRole, username: qs('#username').value, password: qs('#password').value })
  });
  const data = await response.json();
  if (!response.ok) return qs('#loginError').textContent = data.error;
  openDashboard(data.role);
});

async function openDashboard(role) {
  qs('#loginPage').classList.add('hidden');
  qs('#dashboardPage').classList.remove('hidden');
  qs('#writeNav').style.display = role === 'user' ? '' : 'none';
  qs('#adminNav').style.display = role === 'admin' ? '' : 'none';
  qs('#writeReviewBtn').style.display = role === 'user' ? '' : 'none';
  switchView(role === 'admin' ? 'admin' : 'reviews');
  await loadReviews();
}

async function checkSession() {
  const session = await (await fetch('/api/session')).json();
  if (session.user) openDashboard(session.user.role);
}

async function loadReviews() {
  const reviews = await (await fetch('/api/reviews')).json();
  renderReviews(reviews);
  if (await isAdmin()) renderAdmin(reviews);
}

async function isAdmin() {
  const session = await (await fetch('/api/session')).json();
  return session.user?.role === 'admin';
}

function renderReviews(reviews) {
  const grid = qs('#reviewGrid');
  qs('#emptyState').classList.toggle('hidden', reviews.length !== 0);
  grid.innerHTML = reviews.map((review) => `
    <article class="review-card">
      <div class="movie-line"><h3>${escapeHtml(review.movie_name)}</h3><span class="stars-display">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span></div>
      <p class="review-text">“${escapeHtml(review.review_text)}”</p>
      <div class="reviewer"><strong>${escapeHtml(review.name)}</strong><span>${escapeHtml(review.gender)} · ${escapeHtml(review.district)}</span></div>
    </article>`).join('');
}

async function renderAdmin(reviews) {
  const stats = await (await fetch('/api/admin/stats')).json();
  qs('#statTotal').textContent = stats.total;
  qs('#statAverage').textContent = stats.average.toFixed(1);
  qs('#statDistricts').textContent = stats.districts.map((item) => item.district).slice(0, 2).join(', ') || '—';
  qs('#adminTable').innerHTML = reviews.map((review) => `
    <tr><td><strong>${escapeHtml(review.name)}</strong><br><span>${escapeHtml(review.gender)}</span></td><td>${escapeHtml(review.movie_name)}</td><td>${escapeHtml(review.district)}</td><td>${'★'.repeat(review.rating)}</td><td>${formatDate(review.created_at)}</td><td><button class="delete-btn" data-id="${review.id}">Delete</button></td></tr>`).join('');
  qsa('.delete-btn').forEach((button) => button.addEventListener('click', () => deleteReview(button.dataset.id)));
}

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  const response = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
  if (response.ok) { showToast('Review deleted'); await loadReviews(); }
}

function switchView(view) {
  qsa('.view').forEach((item) => item.classList.remove('active'));
  qs(`#${view}View`).classList.add('active');
  qsa('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
}

qsa('.nav-link').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
qs('#writeReviewBtn').addEventListener('click', () => switchView('write'));
qs('#homeBtn').addEventListener('click', () => switchView('reviews'));

qsa('#stars button').forEach((button) => button.addEventListener('click', () => {
  selectedRating = Number(button.dataset.rating);
  qs('#rating').value = selectedRating;
  qsa('#stars button').forEach((item) => item.classList.toggle('selected', Number(item.dataset.rating) <= selectedRating));
}));

qs('#reviewForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  qs('#reviewError').textContent = '';
  if (!selectedRating) return qs('#reviewError').textContent = 'Please choose a rating.';
  const form = new FormData(event.target);
  const body = Object.fromEntries(form.entries());
  body.movieName = body.movieName;
  body.reviewText = body.reviewText;
  const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) return qs('#reviewError').textContent = data.error;
  event.target.reset(); selectedRating = 0;
  qsa('#stars button').forEach((item) => item.classList.remove('selected'));
  showToast('Your review is live');
  await loadReviews(); switchView('reviews');
});

qs('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  qs('#dashboardPage').classList.add('hidden');
  qs('#loginPage').classList.remove('hidden');
});

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message) {
  const toast = qs('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

checkSession();
