const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

const { startServer } = require('./support');
const store = require('../src/store');
const schemas = require('../src/schemas');
const model = require('../src/model/movie');
const moviesRouter = require('../src/routes/movies');
const stages = require('../src/game/stages');
const publicStages = require('../src/game/publicStages');

const { request, close } = startServer((app) => app.use('/api/movies', moviesRouter));
test.after(() => close());

const movieDocs = () => schemas.pageModel().resources.find((resource) => resource.name === 'movie');
const reviewDocs = () => schemas.pageModel().resources.find((resource) => resource.name === 'review');

test('every query param the schemas page advertises is really accepted', async () => {
  for (const param of movieDocs().query) {
    const url = param.name === 'order' ? '/api/movies?sort=year&order=desc' : `/api/movies?${param.example}`;
    const { status } = await request(url);
    assert.equal(status, 200, `${param.example} is documented but the API answered ${status}`);
  }
});

test('a param the page does NOT list is refused, so the list is exhaustive', async () => {
  const { status } = await request('/api/movies?director=Nolan');
  assert.equal(status, 400, 'an undocumented param must not quietly work');
});

test('the documented fields are the fields a movie actually has', () => {
  const documented = movieDocs().fields.map((field) => field.name);
  assert.deepEqual(documented, model.FIELD_ORDER, 'page and model agree');

  for (const movie of store.movies.getAll()) {
    assert.deepEqual(Object.keys(movie).sort(), [...documented].sort(), `movie ${movie.id} has the documented shape`);
  }
});

test('a created movie has the documented shape too, defaults included', async () => {
  const { json } = await request('/api/movies', {
    method: 'POST',
    body: { title: 'Contract', director: 'Someone', genre: 'Drama', year: 2020 },
  });
  assert.deepEqual(Object.keys(json.data), model.FIELD_ORDER);
});

test('the documented review fields match the reviews the server really holds', () => {
  const documented = reviewDocs().fields.map((field) => field.name).sort();
  const actual = Object.keys(store.reviews.getAll()[0]).sort();
  assert.deepEqual(actual, documented, 'the hand-written half of the page has drifted');
});

test('the field types on the page are the types in the data', () => {
  const movie = store.movies.getById(1);
  for (const field of movieDocs().fields) {
    assert.equal(typeof movie[field.name], field.type, `${field.name} is documented as ${field.type}`);
  }
});

test('/schemas renders on the server with every field and param baked in', async () => {
  const html = await ejs.renderFile(
    path.join(__dirname, '..', 'views', 'schemas.ejs'),
    { title: 'Schemas', page: 'schemas', ...schemas.pageModel() },
    { views: [path.join(__dirname, '..', 'views')] }
  );
  for (const field of movieDocs().fields) assert.ok(html.includes(field.name), `${field.name} is missing from the page`);
  for (const param of movieDocs().query) assert.ok(html.includes(param.example), `${param.example} is missing from the page`);
  assert.ok(html.includes('PUT'), 'every implemented method is listed');
});

test('no stage solution survives the trip to the browser', () => {
  const exposed = JSON.stringify(publicStages.all());

  for (const stage of stages.all()) {
    for (const step of stage.steps) {
      assert.ok(!exposed.includes(step.path), `stage ${stage.id} leaks its path`);
      if (step.success) assert.ok(!exposed.includes(step.success), `stage ${stage.id} leaks its success message`);
      for (const [key, value] of Object.entries(step.query ?? {})) {
        assert.ok(!exposed.includes(`${key}=${value}`), `stage ${stage.id} leaks ${key}=${value}`);
      }
    }
  }
});

test('the public payload is an allow-list, not a delete-list', () => {
  for (const stage of publicStages.all()) {
    assert.deepEqual(Object.keys(stage), ['id', 'title', 'scenario', 'hint', 'needs', 'stepsTotal', 'stepLabels']);
    assert.deepEqual(Object.keys(stage.needs), ['routeParam', 'query', 'body']);
  }
});

test('the game covers every method and concept the brief asks for', () => {
  const steps = stages.all().flatMap((stage) => stage.steps);
  const methods = new Set(steps.map((step) => step.method));

  for (const method of ['GET', 'POST', 'DELETE']) assert.ok(methods.has(method), `no stage uses ${method}`);
  assert.ok(methods.has('PUT') || methods.has('PATCH'), 'no stage uses PUT or PATCH');

  assert.ok(steps.some((step) => /\/\d+/.test(step.path)), 'no stage uses a route parameter');
  assert.ok(steps.some((step) => Object.keys(step.query ?? {}).length > 1), 'no stage needs more than one query param');
  assert.ok(steps.some((step) => step.body), 'no stage sends a request body');

  const combined = steps.filter(
    (step) =>
      [/\/\d+/.test(step.path), Object.keys(step.query ?? {}).length > 1, Boolean(step.body)].filter(Boolean).length > 1
  );
  assert.ok(combined.length >= 3, 'the brief wants at least three stages combining more than one concept');
});
