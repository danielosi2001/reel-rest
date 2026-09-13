// ---------------------------------------------------------------------------
// OWNER: Person A  —  the movies resource
//
// Mounted at /api/movies by server.js, so the paths declared here are:
//   GET    /api/movies        list, with filtering + search + sort + paging
//   GET    /api/movies/:id    one movie
//   POST   /api/movies        create              -> 201 + Location
//   PUT    /api/movies/:id    full replace
//   PATCH  /api/movies/:id    partial update
//   DELETE /api/movies/:id    remove, cascading to that movie's reviews -> 204
//
// What a movie is — its fields, their types, the query params, the limits —
// lives in src/model/movie.js, which the /schemas page reads too. This file
// only enforces it.
//
// Three rules the whole file follows:
//   1. Every response body is a JSON *object*, never a bare array, so the game
//      checker can merge its `_game` verdict into it (see src/game/checker.js).
//   2. A 400 lists *every* problem at once in `details`, because someone
//      debugging a request needs all of them, not one per round trip.
//   3. Nothing is silently ignored. A typo'd query param or an unknown body
//      field is an error with a suggestion, not a shrug — this API is being
//      read by people who are still learning what it accepts.
// ---------------------------------------------------------------------------
const express = require('express');
const store = require('../store');
const { cascadeDeleteForMovie } = require('./reviews');
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
const {
  MAX_LIMIT,
  SORTABLE,
  ORDERS,
  WRITABLE,
  WRITABLE_NAMES,
  REQUIRED_NAMES,
  QUERY_NAMES,
} = require('../model/movie');

const router = express.Router();

// --- responses --------------------------------------------------------------

/** Where else you can go from a movie — the relation, spelled out for the player. */
const linksFor = (movie) => ({
  self: `/api/movies/${movie.id}`,
  reviews: `/api/movies/${movie.id}/reviews`,
});

// --- request body -----------------------------------------------------------

/**
 * Reads the writable fields out of a request body.
 * `mustHave` is the list that has to be present — everything for a create or a
 * full replace, nothing for a partial update.
 */
const readFields = (body, { mustHave = [] } = {}) => {
  const errors = [];
  const values = {};

  if (!isPlainObject(body)) {
    return { errors: ['the request body must be a JSON object'], values };
  }

  for (const key of Object.keys(body)) {
    if (WRITABLE_NAMES.includes(key)) continue;
    errors.push(
      key === 'id'
        ? 'id is assigned by the server and belongs in the path, not the body'
        : unknownKeyError('movie field', key, WRITABLE_NAMES)
    );
  }

  for (const field of WRITABLE) {
    if (body[field.name] === undefined) continue;
    const { value, error } = field.parse(body[field.name]);
    if (error) errors.push(error);
    else values[field.name] = value;
  }

  for (const name of mustHave) {
    if (body[name] === undefined) errors.push(`${name} is required`);
  }

  return { errors, values };
};

/** Builds a whole movie in the model's field order, filling in the defaults. */
const buildMovie = (values) =>
  Object.fromEntries(WRITABLE.map((field) => [field.name, values[field.name] ?? field.default]));

// --- query string -----------------------------------------------------------

const wholeNumber = (name, raw, { min, max }, errors) => {
  const value = numeric(name, raw, errors);
  if (value === null) return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be a whole number between ${min} and ${max}`);
    return null;
  }
  return value;
};

const matches = (haystack, needle) => haystack.toLowerCase().includes(needle.toLowerCase());

// --- :id ---------------------------------------------------------------------
// One place decides what a movie id means, so every route below can assume
// `req.movie` exists. `/api/movies/abc` is a malformed request (400) while
// `/api/movies/999` is a well-formed request for something absent (404).

router.param('id', (req, res, next, raw) => {
  if (store.toId(raw) === null) {
    return badRequest(res, `"${raw}" is not a movie id — an id is a positive whole number.`);
  }
  const movie = store.movies.getById(raw);
  if (!movie) {
    return notFound(res, `No movie with id ${raw}. The archive never had one, or it was deleted.`);
  }
  req.movie = movie;
  return next();
});

// --- the collection ----------------------------------------------------------

router.get('/', (req, res) => {
  const errors = [];

  for (const key of Object.keys(req.query)) {
    if (!QUERY_NAMES.includes(key)) errors.push(unknownKeyError('query param', key, QUERY_NAMES));
  }

  const { genre, q, minYear, maxYear, minRating, inStock, sort, order, limit, offset } = req.query;
  let data = store.movies.getAll();

  if (genre !== undefined) {
    const wanted = text('genre', genre, errors);
    if (wanted !== null) data = data.filter((movie) => movie.genre.toLowerCase() === wanted.toLowerCase());
  }

  if (q !== undefined) {
    const needle = text('q', q, errors);
    if (needle !== null) data = data.filter((movie) => matches(movie.title, needle) || matches(movie.director, needle));
  }

  if (minYear !== undefined) {
    const min = numeric('minYear', minYear, errors);
    if (min !== null) data = data.filter((movie) => movie.year >= min);
  }

  if (maxYear !== undefined) {
    const max = numeric('maxYear', maxYear, errors);
    if (max !== null) data = data.filter((movie) => movie.year <= max);
  }

  if (minRating !== undefined) {
    const min = numeric('minRating', minRating, errors);
    if (min !== null) data = data.filter((movie) => movie.rating >= min);
  }

  if (inStock !== undefined) {
    const wanted = oneOf('inStock', inStock, ['true', 'false'], errors);
    if (wanted !== null) data = data.filter((movie) => movie.inStock === (wanted === 'true'));
  }

  // `order` on its own is meaningless: there is nothing to reverse.
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

  const total = data.length;
  const start = offset === undefined ? 0 : wholeNumber('offset', offset, { min: 0, max: Number.MAX_SAFE_INTEGER }, errors);
  const take = limit === undefined ? null : wholeNumber('limit', limit, { min: 1, max: MAX_LIMIT }, errors);

  if (errors.length) {
    return badRequest(res, 'The query string could not be understood.', errors);
  }

  if (start > 0 || take !== null) {
    data = data.slice(start, take === null ? undefined : start + take);
  }

  return res.status(200).json({ count: data.length, total, data });
});

router.post('/', (req, res) => {
  const { errors, values } = readFields(req.body, { mustHave: REQUIRED_NAMES });
  if (errors.length) {
    return badRequest(res, 'The movie could not be created.', errors);
  }

  const created = store.movies.add(buildMovie(values));

  return res
    .status(201)
    .location(`/api/movies/${created.id}`)
    .json({ data: created, links: linksFor(created) });
});

// --- one movie ---------------------------------------------------------------

router.get('/:id', (req, res) => res.status(200).json({ data: req.movie, links: linksFor(req.movie) }));

// PUT is a *replace*: the movie becomes exactly what was sent, and the optional
// fields fall back to their defaults rather than to their old values. That is
// the whole difference from the PATCH below.
router.put('/:id', (req, res) => {
  const { errors, values } = readFields(req.body, { mustHave: REQUIRED_NAMES });
  if (errors.length) {
    return badRequest(
      res,
      'PUT replaces the whole movie, so every required field has to be in the body.',
      errors
    );
  }

  const replaced = store.movies.replace(req.movie.id, buildMovie(values));
  return res.status(200).json({ data: replaced, links: linksFor(replaced) });
});

router.patch('/:id', (req, res) => {
  const { errors, values } = readFields(req.body);
  if (errors.length) {
    return badRequest(res, 'The movie could not be updated.', errors);
  }
  if (Object.keys(values).length === 0) {
    return badRequest(res, 'A PATCH has to change something.', [
      `send at least one of: ${WRITABLE_NAMES.join(', ')}`,
    ]);
  }

  return res.status(200).json({ data: store.movies.update(req.movie.id, values) });
});

router.delete('/:id', (req, res) => {
  store.movies.remove(req.movie.id);
  // A review cannot outlive its movie, so the relation is cleaned up here.
  const orphans = cascadeDeleteForMovie(req.movie.id);

  // 204 has no body by definition, so what happened rides in a header.
  return res.status(204).set('X-Deleted-Reviews', String(orphans.length)).end();
});

module.exports = router;
