const test = require('node:test');
const assert = require('node:assert/strict');

const { listen } = require('./support');
const app = require('../server');
const { settle } = require('../src/game/checker');

const { server, request, close } = listen(app);
test.after(() => close());

const play = (stageId, path, options = {}, step = 0) =>
  request(path, { ...options, headers: { 'X-Stage-Id': String(stageId), 'X-Stage-Step': String(step) } });

const verdictHeader = (response) => JSON.parse(decodeURIComponent(response.headers.get('x-game-result')));

test('requiring server.js does not start listening on its own', () => {
  assert.equal(typeof app, 'function');
});

test('a request without stage headers gets no verdict', async () => {
  const response = await request('/api/movies/1');
  assert.equal(response.status, 200);
  assert.equal(response.json._game, undefined);
  assert.equal(response.headers.get('x-game-result'), null);
});

test('the right request is judged correct and the verdict rides in the body', async () => {
  const { status, json } = await play(6, '/api/movies/2/reviews');
  assert.equal(status, 200);
  assert.equal(json._game.correct, true);
  assert.equal(json._game.stageComplete, true);
});

test('a wrong path is judged wrong and still reaches the real API', async () => {
  const { status, json } = await play(6, '/api/reviews/2');
  assert.equal(json._game.correct, false);
  assert.equal(status, 404);
});

test('an equals rule compares JSON types, not just text', async () => {
  const { json } = await play(7, '/api/movies/2/reviews', {
    method: 'POST',
    body: { author: 'me', text: 'Loved it.', score: '5' },
  });
  assert.equal(json._game.correct, false);
  assert.match(json._game.message, /number/);
});

test('a request of the right shape that the API refuses with 400 is not correct', async () => {
  const { status, json, headers } = await play(8, '/api/movies/1', { method: 'PATCH', body: { rating: 9 } });
  assert.equal(status, 400);
  assert.equal(json._game.correct, false);
  assert.equal(json._game.stageComplete, false);
  assert.match(json._game.message, /between 0 and 5/);
  assert.equal(verdictHeader({ headers }).correct, false, 'the header agrees with the body');
});

test('a 204 carries its verdict in the header, and step 2 of stage 10 expects the 404', async () => {
  const deleted = await play(10, '/api/reviews/2', { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  const first = verdictHeader(deleted);
  assert.equal(first.correct, true);
  assert.equal(first.stageComplete, false);
  assert.equal(first.nextStep, 1);

  const missing = await play(10, '/api/movies/999', {}, 1);
  assert.equal(missing.status, 404);
  assert.equal(missing.json._game.correct, true);
  assert.equal(missing.json._game.stageComplete, true);
});

test('stage 11 wants the 400 first, then the corrected request', async () => {
  const review = { author: 'critic', text: 'Ten out of ten.' };

  const valid = await play(11, '/api/movies/3/reviews', { method: 'POST', body: { ...review, score: 5 } });
  assert.equal(valid.json._game.correct, false, 'step 1 is about sending it as written');

  const refused = await play(11, '/api/movies/3/reviews', { method: 'POST', body: { ...review, score: 10 } });
  assert.equal(refused.status, 400);
  assert.equal(refused.json._game.correct, true, 'the expected 400 is the right answer here');
  assert.equal(refused.json._game.stageComplete, false);
  assert.equal(refused.json._game.nextStep, 1);
  assert.equal(verdictHeader(refused).correct, true, 'the header agrees with the body');

  const again = await play(11, '/api/movies/3/reviews', { method: 'POST', body: { ...review, score: 10 } }, 1);
  assert.equal(again.json._game.correct, false, 'step 2 has to act on what the 400 said');

  const fixed = await play(11, '/api/movies/3/reviews', { method: 'POST', body: { ...review, score: 5 } }, 1);
  assert.equal(fixed.status, 201);
  assert.equal(fixed.json._game.correct, true);
  assert.equal(fixed.json._game.stageComplete, true);
});

test('a step that expects a status is judged wrong when the server answers something else', () => {
  const game = { stageId: 11, step: 0, stepsTotal: 2, nextStep: 1, correct: true, stageComplete: false, message: 'ok', attempts: 1 };

  const expected = settle(game, { expectStatus: 400 }, 400, {});
  assert.equal(expected.correct, true);

  const other = settle(game, { expectStatus: 400, feedback: { status: 'Send it as written.' } }, 404, {});
  assert.equal(other.correct, false);
  assert.equal(other.nextStep, 0);
  assert.equal(other.message, 'Send it as written.');

  assert.equal(settle(game, {}, 400, { message: 'no' }).correct, false, 'without expectStatus a 400 is never a solve');
  assert.equal(settle(game, {}, 404, {}).correct, true, 'and a 404 is left to the path rule');
  assert.equal(settle({ ...game, correct: false }, { expectStatus: 400 }, 400, {}).correct, false, 'a wrong request stays wrong');
});

test('every stage can be solved against the real API', async () => {
  const solutions = [
    [1, '/api/movies'],
    [2, '/api/movies/3'],
    [3, '/api/movies?genre=Sci-Fi&sort=year&order=desc'],
    [4, '/api/movies?q=blade&minRating=4'],
    [5, '/api/movies', { method: 'POST', body: { title: 'Sicario', director: 'Denis Villeneuve', genre: 'Thriller', year: 2015 } }],
    [6, '/api/movies/2/reviews'],
    [7, '/api/movies/2/reviews', { method: 'POST', body: { author: 'me', text: 'Loved it.', score: 5 } }],
    [8, '/api/movies/1', { method: 'PATCH', body: { rating: 4.5 } }],
    [9, '/api/reviews/4', { method: 'PUT', body: { author: 'mod', score: 2, text: 'Rewritten.' } }],
  ];

  for (const [stageId, path, options] of solutions) {
    const { status, json } = await play(stageId, path, options);
    assert.ok(status < 400, `stage ${stageId} answered ${status}`);
    assert.equal(json._game.correct, true, `stage ${stageId}: ${json._game.message}`);
  }
});

test('an unknown API path is a JSON 404, and bad JSON is a 400', async () => {
  const unknown = await request('/api/nothing');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.json.error, 'Not Found');

  const response = await fetch(`http://localhost:${server.address().port}/api/movies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"title": oops',
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /not valid JSON/);
});
