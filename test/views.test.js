const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

const publicStages = require('../src/game/publicStages');

const render = () =>
  ejs.renderFile(
    path.join(__dirname, '..', 'views', 'game.ejs'),
    { title: 'Reel REST', page: 'game', stages: publicStages.all() },
    { views: [path.join(__dirname, '..', 'views')] }
  );

const decode = (value) =>
  value.replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('the game page has no inline JavaScript or CSS', async () => {
  const html = await render();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  assert.ok(scripts.length > 0);
  for (const tag of scripts) assert.match(tag, /\ssrc="\/js\/[\w-]+\.js"/, `${tag} is not an external script`);
  assert.doesNotMatch(html, /<style\b|\sstyle="|\son[a-z]+="/);
});

test('the public stages reach the page as data, in full', async () => {
  const html = await render();
  const [, raw] = html.match(/data-stages="([^"]*)"/) ?? [];
  assert.ok(raw, 'the stage list is embedded as a data attribute');
  assert.deepEqual(JSON.parse(decode(raw)), publicStages.all());
});
