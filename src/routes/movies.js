// ---------------------------------------------------------------------------
// OWNER: Person A  —  PLACEHOLDER
// Written by Person B only so the game is playable end to end. Person A
// replaces this file wholesale. Mounted at /api/movies by server.js.
// ---------------------------------------------------------------------------
const express = require('express');
const store = require('../store');
const reviewsRouter = require('./reviews');

const router = express.Router();

const SORTABLE = ['id', 'title', 'year', 'rating'];
const ORDERS = ['asc', 'desc'];

function badRequest(res, message, details) {
  return res.status(400).json({ error: 'Bad Request', message, details: details || undefined });
}

function notFound(res, message) {
  return res.status(404).json({ error: 'Not Found', message });
}

router.get('/', (req, res) => {
  const { genre, minYear, minRating, q, sort, order } = req.query;
  let data = store.movies.getAll();

  if (genre !== undefined) {
    data = data.filter((movie) => movie.genre.toLowerCase() === String(genre).toLowerCase());
  }
  if (minYear !== undefined) {
    const min = Number(minYear);
    if (!Number.isFinite(min)) return badRequest(res, 'minYear must be a number.');
    data = data.filter((movie) => movie.year >= min);
  }
  if (minRating !== undefined) {
    const min = Number(minRating);
    if (!Number.isFinite(min)) return badRequest(res, 'minRating must be a number.');
    data = data.filter((movie) => movie.rating >= min);
  }
  if (q !== undefined) {
    const needle = String(q).toLowerCase();
    data = data.filter(
      (movie) =>
        movie.title.toLowerCase().includes(needle) || movie.director.toLowerCase().includes(needle)
    );
  }
  if (sort !== undefined) {
    if (!SORTABLE.includes(sort)) {
      return badRequest(res, `sort must be one of: ${SORTABLE.join(', ')}`);
    }
    if (order !== undefined && !ORDERS.includes(order)) {
      return badRequest(res, `order must be one of: ${ORDERS.join(', ')}`);
    }
    const direction = order === 'desc' ? -1 : 1;
    data = data.slice().sort((a, b) => {
      if (a[sort] < b[sort]) return -1 * direction;
      if (a[sort] > b[sort]) return 1 * direction;
      return 0;
    });
  }

  res.status(200).json({ count: data.length, data });
});

router.get('/:id', (req, res) => {
  const movie = store.movies.getById(req.params.id);
  if (!movie) return notFound(res, `No movie with id ${req.params.id}`);
  res.status(200).json({ data: movie });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const missing = ['title', 'director', 'genre', 'year'].filter((field) => {
    const value = body[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length) {
    return badRequest(res, 'The movie could not be created.', missing.map((f) => `${f} is required`));
  }

  const created = store.movies.add({
    title: String(body.title),
    director: String(body.director),
    genre: String(body.genre),
    year: Number(body.year),
    rating: body.rating === undefined ? 0 : Number(body.rating),
    inStock: body.inStock === undefined ? true : Boolean(body.inStock),
  });

  res.status(201).json({ data: created });
});

router.patch('/:id', (req, res) => {
  const movie = store.movies.getById(req.params.id);
  if (!movie) return notFound(res, `No movie with id ${req.params.id}`);

  const body = req.body || {};
  const allowed = ['title', 'director', 'genre', 'year', 'rating', 'inStock'];
  const fields = Object.keys(body).filter((key) => allowed.includes(key));
  if (!fields.length) {
    return badRequest(res, `Send at least one of: ${allowed.join(', ')}`);
  }
  if (body.rating !== undefined && !Number.isFinite(Number(body.rating))) {
    return badRequest(res, 'rating must be a number.');
  }

  const patch = {};
  for (const field of fields) patch[field] = body[field];
  res.status(200).json({ data: store.movies.update(movie.id, patch) });
});

router.delete('/:id', (req, res) => {
  const removed = store.movies.remove(req.params.id);
  if (!removed) return notFound(res, `No movie with id ${req.params.id}`);
  reviewsRouter.cascadeDeleteForMovie(removed.id);
  res.status(204).end();
});

module.exports = router;
