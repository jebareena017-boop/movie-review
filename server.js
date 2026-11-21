require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const session = require('express-session');
const Database = require('node:sqlite').DatabaseSync;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'movie_reviews.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    genre TEXT NOT NULL,
    language TEXT NOT NULL,
    release_year INTEGER NOT NULL,
    director TEXT NOT NULL,
    description TEXT NOT NULL,
    poster_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    district TEXT NOT NULL,
    movie_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const seededReviews = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;
if (seededReviews === 0) {
  db.prepare(`
    INSERT INTO reviews (name, gender, district, movie_name, rating, review_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Ananya Rao', 'Female', 'Central', 'The Eternal Frame', 5, 'A beautifully layered film that stayed with me long after the final scene.');
  db.prepare(`
    INSERT INTO reviews (name, gender, district, movie_name, rating, review_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Marcus Lee', 'Male', 'North', 'Midnight Boulevard', 4, 'Stylish, tense, and wonderfully performed. The pacing dips once, but the ending earns it.');
  db.prepare(`
    INSERT INTO reviews (name, gender, district, movie_name, rating, review_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Samira Khan', 'Prefer not to say', 'West', 'A Summer in June', 5, 'Warm, honest, and visually stunning. Every frame feels carefully considered.');
}

const seededMovies = db.prepare('SELECT COUNT(*) AS count FROM movies').get().count;
if (seededMovies === 0) {
  db.prepare(`INSERT INTO movies (title, genre, language, release_year, director, description)
    VALUES (?, ?, ?, ?, ?, ?)`).run('The Eternal Frame', 'Drama', 'English', 2025, 'Ari Sterling', 'A moving story about memory, art, and the moments that define a life.');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'cinereview-local-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const { role, username, password } = req.body;
  if (!['user', 'admin'].includes(role) || password !== '123') {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  if (role === 'admin' && username.trim().toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Invalid admin username.' });
  }
  if (role === 'user' && username.trim().toLowerCase() !== 'user') {
    return res.status(401).json({ error: 'Invalid user username.' });
  }
  req.session.user = { role, username: username.trim().toLowerCase() };
  res.json({ role, username: username.trim().toLowerCase() });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(401).json({ error: 'Please log in first.' });
    }
    next();
  };
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

app.get('/api/reviews', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) return res.status(500).json({ error: 'Could not load Supabase reviews.', details: error.message });
    return res.json(data);
  }
  const reviews = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC, id DESC').all();
  res.json(reviews);
});

app.post('/api/reviews', requireRole('user'), async (req, res) => {
  const { name, gender, district, movieName, rating, reviewText } = req.body;
  const values = [name, gender, district, movieName, rating, reviewText];
  if (values.some((value) => value === undefined || String(value).trim() === '')) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  if (supabase) {
    const payload = {
      name: name.trim(), gender, district: district.trim(), movie_name: movieName.trim(),
      rating: numericRating, review_text: reviewText.trim()
    };
    const { data, error } = await supabase.from('reviews').insert(payload).select('*').single();
    if (error) return res.status(500).json({ error: 'Could not save review to Supabase.', details: error.message });
    return res.status(201).json(data);
  }

  const result = db.prepare(`
    INSERT INTO reviews (name, gender, district, movie_name, rating, review_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), gender, district.trim(), movieName.trim(), numericRating, reviewText.trim());
  res.status(201).json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/reviews/:id', requireRole('admin'), async (req, res) => {
  if (supabase) {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Could not delete review.', details: error.message });
    return res.json({ ok: true });
  }
  const result = db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Review not found.' });
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireRole('admin'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('reviews').select('district,rating');
    if (error) return res.status(500).json({ error: 'Could not load statistics.', details: error.message });
    const total = data.length;
    const average = total ? data.reduce((sum, review) => sum + review.rating, 0) / total : 0;
    const counts = data.reduce((map, review) => {
      map[review.district] = (map[review.district] || 0) + 1;
      return map;
    }, {});
    const districts = Object.entries(counts)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return res.json({ total, average: Number(average.toFixed(1)), districts });
  }
  const total = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;
  const average = db.prepare('SELECT AVG(rating) AS average FROM reviews').get().average;
  const districts = db.prepare('SELECT district, COUNT(*) AS count FROM reviews GROUP BY district ORDER BY count DESC LIMIT 5').all();
  res.json({ total, average: average ? Number(average.toFixed(1)) : 0, districts });
});

app.get('/api/movies', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Could not load movies.', details: error.message });
    return res.json(data);
  }
  res.json(db.prepare('SELECT * FROM movies ORDER BY created_at DESC, id DESC').all());
});

app.post('/api/movies', requireRole('admin'), async (req, res) => {
  const { title, genre, language, releaseYear, director, description, posterUrl } = req.body;
  const values = [title, genre, language, releaseYear, director, description];
  if (values.some((value) => value === undefined || String(value).trim() === '')) {
    return res.status(400).json({ error: 'Title, genre, language, release year, director, and description are required.' });
  }
  const numericYear = Number(releaseYear);
  if (!Number.isInteger(numericYear) || numericYear < 1888 || numericYear > 2100) {
    return res.status(400).json({ error: 'Enter a valid release year.' });
  }

  if (supabase) {
    const payload = {
      title: title.trim(), genre: genre.trim(), language: language.trim(), release_year: numericYear,
      director: director.trim(), description: description.trim(), poster_url: posterUrl?.trim() || null
    };
    const { data, error } = await supabase.from('movies').insert(payload).select('*').single();
    if (error) return res.status(500).json({ error: 'Could not save movie to Supabase.', details: error.message });
    return res.status(201).json(data);
  }

  const result = db.prepare(`
    INSERT INTO movies (title, genre, language, release_year, director, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), genre.trim(), language.trim(), numericYear, director.trim(), description.trim());
  res.status(201).json(db.prepare('SELECT * FROM movies WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/movies/:id', requireRole('admin'), async (req, res) => {
  if (supabase) {
    const { error } = await supabase.from('movies').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'Could not delete movie.', details: error.message });
    return res.json({ ok: true });
  }
  const result = db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Movie not found.' });
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
