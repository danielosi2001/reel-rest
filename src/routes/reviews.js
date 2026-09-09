// ---------------------------------------------------------------------------
// OWNER: Person B  —  reviews slice
//
// Mounted at /api by server.js, so the paths declared here are:
//   GET    /api/movies/:id/reviews
//   POST   /api/movies/:id/reviews
//   GET    /api/reviews
//   PUT    /api/reviews/:id
//   DELETE /api/reviews/:id
//
// Every response body is an object, never a bare array, so the game checker can
// merge its `_game` verdict into it (see src/game/checker.js).
// ---------------------------------------------------------------------------
const express = require('express');
const store = require('../store');

const router = express.Router();

const SORTABLE = ['id', 'score', 'createdAt', 'author'];
const ORDERS = ['asc', 'desc'];

function badRequest(res, message, details) {
  return res.status(400).json({
    error: 'Bad Request',
    message,
    details: details || undefined,
  });
}

function notFound(res, message) {
  return res.status(404).json({ error: 'Not Found', message });
}

// Validates the writable fields of a review. `partial` is unused for now — PUT
// is a full replace and POST always requires everything — but it keeps the
// signature honest if a PATCH on reviews is ever added.
function validateReview(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['body must be a JSON object'] };
  }

  const author = body.author;
  if (typeof author !== 'string' || author.trim() === '') {
    errors.push('author is required and must be a non-empty string');
  }

  const text = body.text;
  if (typeof text !== 'string' || text.trim() === '') {
    errors.push('text is required and must be a non-empty string');
  }

  const score = body.score;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    errors.push('score is required and must be a whole number between 1 and 5');
  }

  if (errors.length) return { errors };

  return {
    errors: [],
    value: { author: author.trim(), text: text.trim(), score },
  };
}

// --- the relation: reviews that belong to one movie -------------------------

router.get('/movies/:id/reviews', (req, res) => {
  const movie = store.movies.getById(req.params.id);
  if (!movie) {
    return notFound(res, `No movie with id ${req.params.id}`);
  }

  const data = store.reviews.getAll().filter((review) => review.movieId === movie.id);
  res.status(200).json({ movieId: movie.id, count: data.length, data });
});

router.post('/movies/:id/reviews', (req, res) => {
  const movie = store.movies.getById(req.params.id);
  if (!movie) {
    return notFound(res, `No movie with id ${req.params.id}`);
  }

  const { errors, value } = validateReview(req.body);
  if (errors.length) {
    return badRequest(res, 'The review could not be created.', errors);
  }

  const created = store.reviews.add({
    movieId: movie.id,
    author: value.author,
    score: value.score,
    text: value.text,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ data: created });
});

// --- the flat review list ---------------------------------------------------

router.get('/reviews', (req, res) => {
  const { minScore, author, sort, order } = req.query;
  let data = store.reviews.getAll();

  if (minScore !== undefined) {
    const min = Number(minScore);
    if (!Number.isFinite(min)) {
      return badRequest(res, 'minScore must be a number.');
    }
    data = data.filter((review) => review.score >= min);
  }

  if (author !== undefined) {
    const needle = String(author).toLowerCase();
    data = data.filter((review) => review.author.toLowerCase() === needle);
  }

  if (sort !== undefined) {
    if (!SORTABLE.includes(sort)) {
      return badRequest(res, `sort must be one of: ${SORTABLE.join(', ')}`);
    }
    const direction = order === undefined || order === 'asc' ? 1 : -1;
    if (order !== undefined && !ORDERS.includes(order)) {
      return badRequest(res, `order must be one of: ${ORDERS.join(', ')}`);
    }
    data = data.slice().sort((a, b) => {
      if (a[sort] < b[sort]) return -1 * direction;
      if (a[sort] > b[sort]) return 1 * direction;
      return 0;
    });
  }

  res.status(200).json({ count: data.length, data });
});

// --- full replace -----------------------------------------------------------

router.put('/reviews/:id', (req, res) => {
  const existing = store.reviews.getById(req.params.id);
  if (!existing) {
    return notFound(res, `No review with id ${req.params.id}`);
  }

  const { errors, value } = validateReview(req.body);
  if (errors.length) {
    return badRequest(res, 'PUT replaces the whole review, so every field is required.', errors);
  }

  const movieId = req.body.movieId === undefined ? existing.movieId : Number(req.body.movieId);
  if (!Number.isInteger(movieId) || !store.movies.getById(movieId)) {
    return badRequest(res, 'movieId must point at a movie that exists.');
  }

  const replaced = store.reviews.replace(existing.id, {
    movieId,
    author: value.author,
    score: value.score,
    text: value.text,
    createdAt: typeof req.body.createdAt === 'string' ? req.body.createdAt : existing.createdAt,
  });

  res.status(200).json({ data: replaced });
});

// --- delete -----------------------------------------------------------------

router.delete('/reviews/:id', (req, res) => {
  const removed = store.reviews.remove(req.params.id);
  if (!removed) {
    return notFound(res, `No review with id ${req.params.id}`);
  }
  // 204 carries no body, so the game verdict rides in the X-Game-Result header.
  res.status(204).end();
});

// Called by Person A's DELETE /api/movies/:id so a deleted movie does not leave
// orphan reviews behind.
function cascadeDeleteForMovie(movieId) {
  return store.reviews.removeWhere((review) => review.movieId === Number(movieId));
}

module.exports = router;
module.exports.cascadeDeleteForMovie = cascadeDeleteForMovie;
