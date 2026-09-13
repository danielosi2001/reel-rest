const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('./support');
const store = require('../src/store');
const reviewsRouter = require('../src/routes/reviews');
const moviesRouter = require('../src/routes/movies');

const { request, close } = startServer((app) => {
  app.use('/api', reviewsRouter);
  app.use('/api/movies', moviesRouter);
});
test.after(() => close());

const REVIEW = { author: 'tester', score: 4, text: 'Fine.' };

const createReview = async (movieId = 3, fields = REVIEW) =>
  (await request(`/api/movies/${movieId}/reviews`, { method: 'POST', body: fields })).json.data;

test('GET /api/movies/:id/reviews lists only that movie reviews', async () => {
  const { status, json } = await request('/api/movies/2/reviews');
  assert.equal(status, 200);
  assert.equal(json.movieId, 2);
  assert.equal(json.count, json.data.length);
  assert.ok(json.data.length > 0);
  assert.ok(json.data.every((review) => review.movieId === 2));
});

test('a malformed movie id on the relation is 400, a missing one is 404', async () => {
  assert.equal((await request('/api/movies/abc/reviews')).status, 400);
  assert.equal((await request('/api/movies/999999/reviews')).status, 404);
  assert.equal((await request('/api/movies/abc/reviews', { method: 'POST', body: REVIEW })).status, 400);
});

test('the relation takes no query params', async () => {
  const { status, json } = await request('/api/movies/2/reviews?minScore=4');
  assert.equal(status, 400);
  assert.match(json.details[0], /\/api\/reviews/);
});

test('POST creates a review under the movie from the path', async () => {
  const { status, headers, json } = await request('/api/movies/3/reviews', { method: 'POST', body: REVIEW });
  assert.equal(status, 201);
  assert.equal(json.data.movieId, 3);
  assert.equal(json.data.author, 'tester');
  assert.equal(typeof json.data.createdAt, 'string');
  assert.equal(headers.get('location'), `/api/reviews/${json.data.id}`);
});

test('POST lists every problem with the body at once', async () => {
  const { status, json } = await request('/api/movies/3/reviews', { method: 'POST', body: { score: 9 } });
  assert.equal(status, 400);
  assert.equal(json.error, 'Bad Request');
  assert.equal(json.details.length, 3, 'author, text and the out-of-range score');
});

test('POST refuses fields the client does not own, and typos, with a suggestion', async () => {
  const owned = await request('/api/movies/3/reviews', {
    method: 'POST',
    body: { ...REVIEW, id: 7, movieId: 3, createdAt: 'now' },
  });
  assert.equal(owned.status, 400);
  assert.equal(owned.json.details.length, 3);
  assert.ok(owned.json.details.some((line) => /movieId comes from the path/.test(line)));

  const typo = await request('/api/movies/3/reviews', { method: 'POST', body: { ...REVIEW, scor: 4 } });
  assert.equal(typo.status, 400);
  assert.match(typo.json.details[0], /did you mean score\?/);
});

test('a score must be a whole JSON number from 1 to 5', async () => {
  for (const score of ['5', 0, 6, 4.5]) {
    const { status } = await request('/api/movies/3/reviews', { method: 'POST', body: { ...REVIEW, score } });
    assert.equal(status, 400, `score ${JSON.stringify(score)} must be refused`);
  }
});

test('GET /api/reviews filters, sorts and combines', async () => {
  const { status, json } = await request('/api/reviews?minScore=5&sort=createdAt&order=desc');
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(json), ['count', 'data']);
  assert.ok(json.data.every((review) => review.score >= 5));
  const dates = json.data.map((review) => review.createdAt);
  assert.deepEqual(dates, [...dates].sort().reverse());

  const byAuthor = (await request('/api/reviews?author=NOA')).json;
  assert.ok(byAuthor.count > 0);
  assert.ok(byAuthor.data.every((review) => review.author === 'noa'));
});

test('GET /api/reviews refuses a malformed query string, naming every problem', async () => {
  const typo = await request('/api/reviews?autor=noa');
  assert.equal(typo.status, 400);
  assert.match(typo.json.details[0], /did you mean author\?/);

  const many = await request('/api/reviews?minScore=high&sort=colour&author=');
  assert.equal(many.status, 400);
  assert.equal(many.json.details.length, 3);

  assert.equal((await request('/api/reviews?order=desc')).status, 400, 'order without sort');
});

test('PUT replaces the review from exactly what was sent', async () => {
  const review = await createReview();
  const { status, json } = await request(`/api/reviews/${review.id}`, {
    method: 'PUT',
    body: { author: 'moderator', score: 2, text: 'Rewritten.' },
  });
  assert.equal(status, 200);
  assert.deepEqual(
    { ...json.data },
    { id: review.id, movieId: review.movieId, author: 'moderator', score: 2, text: 'Rewritten.', createdAt: review.createdAt }
  );
});

test('PUT can move a review to another movie, but only to one that exists', async () => {
  const review = await createReview();
  const moved = await request(`/api/reviews/${review.id}`, { method: 'PUT', body: { ...REVIEW, movieId: 4 } });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.data.movieId, 4);

  const nowhere = await request(`/api/reviews/${review.id}`, { method: 'PUT', body: { ...REVIEW, movieId: 999999 } });
  assert.equal(nowhere.status, 400);
});

test('PUT without every field is refused, and ids are checked', async () => {
  const review = await createReview();
  const partial = await request(`/api/reviews/${review.id}`, { method: 'PUT', body: { score: 1 } });
  assert.equal(partial.status, 400);
  assert.equal(partial.json.details.length, 2);

  assert.equal((await request('/api/reviews/abc', { method: 'PUT', body: REVIEW })).status, 400);
  assert.equal((await request('/api/reviews/999999', { method: 'PUT', body: REVIEW })).status, 404);
});

test('DELETE answers 204 with no body, and a second delete is a 404', async () => {
  const review = await createReview();
  const { status, text } = await request(`/api/reviews/${review.id}`, { method: 'DELETE' });
  assert.equal(status, 204);
  assert.equal(text, '');
  assert.equal(store.reviews.exists(review.id), false);

  assert.equal((await request(`/api/reviews/${review.id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await request('/api/reviews/abc', { method: 'DELETE' })).status, 400);
});
