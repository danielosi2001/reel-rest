const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('./support');
const store = require('../src/store');
const moviesRouter = require('../src/routes/movies');

const { request, close } = startServer((app) => app.use('/api/movies', moviesRouter));
test.after(() => close());

const NEW_MOVIE = { title: 'Sicario', director: 'Denis Villeneuve', genre: 'Thriller', year: 2015 };
const create = async (fields = NEW_MOVIE) => (await request('/api/movies', { method: 'POST', body: fields })).json.data;

test('GET /api/movies returns an object envelope, never a bare array', async () => {
  const { status, json } = await request('/api/movies');
  assert.equal(status, 200);
  assert.ok(!Array.isArray(json), 'the body must be an object so the game verdict can be merged in');
  assert.deepEqual(Object.keys(json), ['count', 'total', 'data']);
  assert.equal(json.count, json.data.length);
});

test('query params really filter, and they combine', async () => {
  const comedies = (await request('/api/movies?genre=Comedy')).json;
  assert.ok(comedies.count > 0);
  assert.ok(comedies.data.every((movie) => movie.genre === 'Comedy'));

  const { data } = (await request('/api/movies?q=blade&minRating=4')).json;
  assert.ok(data.length >= 2);
  assert.ok(data.every((movie) => /blade/i.test(`${movie.title} ${movie.director}`) && movie.rating >= 4));
});

test('sort and order actually reorder the list', async () => {
  const { data } = (await request('/api/movies?genre=Sci-Fi&sort=year&order=desc')).json;
  const years = data.map((movie) => movie.year);
  assert.deepEqual(years, [...years].sort((a, b) => b - a));
});

test('limit and offset page without changing the total', async () => {
  const all = (await request('/api/movies?sort=id')).json;
  const page = (await request('/api/movies?sort=id&limit=3&offset=2')).json;
  assert.equal(page.total, all.total, 'total is the size of the match, not of the page');
  assert.equal(page.count, 3);
  assert.deepEqual(page.data.map((m) => m.id), all.data.slice(2, 5).map((m) => m.id));
});

test('a malformed query string is a 400 that names every problem at once', async () => {
  const { status, json } = await request('/api/movies?sort=colour&limit=999');
  assert.equal(status, 400);
  assert.equal(json.error, 'Bad Request');
  assert.equal(json.details.length, 2, 'both problems are reported in one round trip');
});

test('a typo in a query param is rejected with a suggestion', async () => {
  const { status, json } = await request('/api/movies?genrre=Comedy');
  assert.equal(status, 400);
  assert.match(json.details[0], /did you mean genre\?/);
});

test('a query param sent with no value is a mistake, not "no filter"', async () => {
  const { status, json } = await request('/api/movies?minRating=');
  assert.equal(status, 400);
  assert.match(json.details[0], /without a value/);
});

test('order without sort is refused', async () => {
  const { status } = await request('/api/movies?order=desc');
  assert.equal(status, 400);
});

test('a malformed id is 400, a missing one is 404', async () => {
  assert.equal((await request('/api/movies/abc')).status, 400, 'not an id at all');
  assert.equal((await request('/api/movies/999999')).status, 404, 'a fine request for something absent');
});

test('GET one movie carries links to its reviews', async () => {
  const { status, json } = await request('/api/movies/1');
  assert.equal(status, 200);
  assert.equal(json.data.id, 1);
  assert.equal(json.links.reviews, '/api/movies/1/reviews');
});

test('POST creates, answers 201 + Location, and fills in the defaults', async () => {
  const { status, headers, json } = await request('/api/movies', { method: 'POST', body: NEW_MOVIE });
  assert.equal(status, 201);
  assert.equal(headers.get('location'), `/api/movies/${json.data.id}`);
  assert.equal(json.data.rating, 0);
  assert.equal(json.data.inStock, true);

  const fetched = await request(`/api/movies/${json.data.id}`);
  assert.equal(fetched.json.data.title, 'Sicario', 'the create is visible to later requests');
});

test('POST rejects a missing field and a client-invented id', async () => {
  const missing = await request('/api/movies', { method: 'POST', body: { title: 'Half a movie' } });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.details.length, 3, 'director, genre and year');

  const withId = await request('/api/movies', { method: 'POST', body: { ...NEW_MOVIE, id: 500 } });
  assert.equal(withId.status, 400);
  assert.match(withId.json.details[0], /id is assigned by the server/);
});

test('PUT replaces the whole movie: what you leave out goes back to its default', async () => {
  const movie = await create({ ...NEW_MOVIE, rating: 4.8, inStock: false });
  const { status, json } = await request(`/api/movies/${movie.id}`, {
    method: 'PUT',
    body: { title: 'Replaced', director: 'Someone Else', genre: 'Drama', year: 2001 },
  });
  assert.equal(status, 200);
  assert.equal(json.data.title, 'Replaced');
  assert.equal(json.data.rating, 0, 'PUT is a replace, so the old rating is gone');
  assert.equal(json.data.inStock, true);
  assert.equal(json.data.id, movie.id, 'the id survives — it is the address, not the content');
});

test('PUT without the required fields is refused', async () => {
  const movie = await create();
  const { status } = await request(`/api/movies/${movie.id}`, { method: 'PUT', body: { rating: 4 } });
  assert.equal(status, 400);
});

test('PATCH changes only what it was given', async () => {
  const movie = await create();
  const { status, json } = await request(`/api/movies/${movie.id}`, { method: 'PATCH', body: { rating: 4.5 } });
  assert.equal(status, 200);
  assert.equal(json.data.rating, 4.5);
  assert.equal(json.data.title, movie.title, 'everything left out is untouched — the PATCH/PUT difference');
});

test('PATCH refuses an empty change and an unknown field', async () => {
  const movie = await create();
  assert.equal((await request(`/api/movies/${movie.id}`, { method: 'PATCH', body: {} })).status, 400);

  const unknown = await request(`/api/movies/${movie.id}`, { method: 'PATCH', body: { rating: 4, nope: 1 } });
  assert.equal(unknown.status, 400, 'a field that is not part of a movie is not silently dropped');
});

test('a value outside its range is refused with the range in the message', async () => {
  const movie = await create();
  const { status, json } = await request(`/api/movies/${movie.id}`, { method: 'PATCH', body: { rating: 9 } });
  assert.equal(status, 400);
  assert.match(json.details[0], /between 0 and 5/);
});

test('DELETE answers 204 with no body and takes the movie reviews with it', async () => {
  const movie = await create();
  store.reviews.add({ movieId: movie.id, author: 'tester', score: 5, text: 'Doomed.', createdAt: new Date().toISOString() });

  const { status, headers, text } = await request(`/api/movies/${movie.id}`, { method: 'DELETE' });
  assert.equal(status, 204);
  assert.equal(text, '', '204 means there is deliberately nothing to send back');
  assert.equal(headers.get('x-deleted-reviews'), '1');

  assert.equal((await request(`/api/movies/${movie.id}`)).status, 404, 'it is really gone');
  assert.equal(store.reviews.filter((review) => review.movieId === movie.id).length, 0, 'no orphans left behind');
});

test('deleting something that is not there is a 404, not a silent success', async () => {
  assert.equal((await request('/api/movies/999999', { method: 'DELETE' })).status, 404);
});
