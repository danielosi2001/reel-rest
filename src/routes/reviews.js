const express = require('express');
const store = require('../store');
const {
  badRequest,
  notFound,
  unknownKeyError,
  isPlainObject,
  text,
  numeric,
  oneOf,
  compareBy,
} = require('./shared');

const router = express.Router();

const REQUIRED = ['author', 'score', 'text'];
const QUERY = ['minScore', 'author', 'sort', 'order'];
const SORTABLE = ['id', 'score', 'createdAt', 'author'];
const ORDERS = ['asc', 'desc'];
const SCORE = { min: 1, max: 5 };

const SERVER_OWNED = {
  id: 'id is assigned by the server and belongs in the path, not the body',
  createdAt: 'createdAt is set by the server when the review is written',
};

const MOVIE_FROM_PATH = 'movieId comes from the path — /api/movies/:id/reviews already says which movie';

const reviewOrder = ({ id, movieId, author, score, text: body, createdAt }) => ({
  id,
  movieId,
  author,
  score,
  text: body,
  createdAt,
});

const readReview = (body, { allowMovieId }) => {
  if (!isPlainObject(body)) {
    return { errors: ['the request body must be a JSON object'], values: {} };
  }

  const allowed = allowMovieId ? [...REQUIRED, 'movieId'] : REQUIRED;
  const errors = Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((key) => {
      if (SERVER_OWNED[key]) return SERVER_OWNED[key];
      if (key === 'movieId') return MOVIE_FROM_PATH;
      return unknownKeyError('review field', key, allowed);
    });

  const values = {};

  for (const name of ['author', 'text']) {
    const raw = body[name];
    if (raw === undefined) errors.push(`${name} is required`);
    else if (typeof raw !== 'string' || raw.trim() === '') errors.push(`${name} must be a non-empty string`);
    else values[name] = raw.trim();
  }

  if (body.score === undefined) errors.push('score is required');
  else if (!Number.isInteger(body.score) || body.score < SCORE.min || body.score > SCORE.max) {
    errors.push(`score must be a whole number between ${SCORE.min} and ${SCORE.max}`);
  } else values.score = body.score;

  if (allowMovieId && body.movieId !== undefined) {
    if (!Number.isInteger(body.movieId) || !store.movies.exists(body.movieId)) {
      errors.push('movieId must be the id of a movie that exists');
    } else values.movieId = body.movieId;
  }

  return { errors, values };
};

const lookUp = (collection, noun, key) => (req, res, next, raw) => {
  if (store.toId(raw) === null) {
    return badRequest(res, `"${raw}" is not a ${noun} id — an id is a positive whole number.`);
  }
  const row = store[collection].getById(raw);
  if (!row) {
    return notFound(res, `No ${noun} with id ${raw}.`);
  }
  req[key] = row;
  return next();
};

router.param('movieId', lookUp('movies', 'movie', 'movie'));
router.param('reviewId', lookUp('reviews', 'review', 'review'));

router.get('/movies/:movieId/reviews', (req, res) => {
  const params = Object.keys(req.query);
  if (params.length) {
    return badRequest(res, 'The reviews of one movie take no query params.', [
      `${params.join(', ')} ${params.length > 1 ? 'are' : 'is'} not accepted here — filter and sort every review at /api/reviews instead`,
    ]);
  }

  const data = store.reviews.filter((review) => review.movieId === req.movie.id).map(reviewOrder);
  return res.status(200).json({ movieId: req.movie.id, count: data.length, data });
});

router.post('/movies/:movieId/reviews', (req, res) => {
  const { errors, values } = readReview(req.body, { allowMovieId: false });
  if (errors.length) {
    return badRequest(res, 'The review could not be created.', errors);
  }

  const created = store.reviews.add(
    reviewOrder({ movieId: req.movie.id, ...values, createdAt: new Date().toISOString() })
  );

  return res.status(201).location(`/api/reviews/${created.id}`).json({ data: created });
});

router.get('/reviews', (req, res) => {
  const errors = Object.keys(req.query)
    .filter((key) => !QUERY.includes(key))
    .map((key) => unknownKeyError('query param', key, QUERY));

  const { minScore, author, sort, order } = req.query;
  let data = store.reviews.getAll();

  if (minScore !== undefined) {
    const min = numeric('minScore', minScore, errors);
    if (min !== null) data = data.filter((review) => review.score >= min);
  }

  if (author !== undefined) {
    const wanted = text('author', author, errors);
    if (wanted !== null) data = data.filter((review) => review.author.toLowerCase() === wanted.toLowerCase());
  }

  if (order !== undefined && sort === undefined) {
    errors.push('order only makes sense together with sort');
  }

  if (sort !== undefined) {
    const field = oneOf('sort', sort, SORTABLE, errors);
    const direction = order === undefined ? 'asc' : oneOf('order', order, ORDERS, errors);
    if (field !== null && direction !== null) {
      data = data.sort(compareBy(field, direction === 'desc' ? -1 : 1));
    }
  }

  if (errors.length) {
    return badRequest(res, 'The query string could not be understood.', errors);
  }

  return res.status(200).json({ count: data.length, data: data.map(reviewOrder) });
});

router.put('/reviews/:reviewId', (req, res) => {
  const { errors, values } = readReview(req.body, { allowMovieId: true });
  if (errors.length) {
    return badRequest(res, 'PUT replaces the whole review, so author, score and text all have to be in the body.', errors);
  }

  const replaced = store.reviews.replace(
    req.review.id,
    reviewOrder({ movieId: req.review.movieId, ...values, createdAt: req.review.createdAt })
  );

  return res.status(200).json({ data: replaced });
});

router.delete('/reviews/:reviewId', (req, res) => {
  store.reviews.remove(req.review.id);
  return res.status(204).end();
});

const cascadeDeleteForMovie = (movieId) =>
  store.reviews.removeWhere((review) => review.movieId === Number(movieId));

module.exports = router;
module.exports.cascadeDeleteForMovie = cascadeDeleteForMovie;
