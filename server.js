// ---------------------------------------------------------------------------
// OWNER: Person B  —  app bootstrap
//
// Middleware order matters and is the whole trick:
//   json body parser  ->  game checker (/api)  ->  real routers  ->  404  ->  errors
// The checker has to see a parsed body, and the real routers have to run after
// it so that a wrong request still gets a genuine 404 / 400 from the API.
// ---------------------------------------------------------------------------
const path = require('path');
const express = require('express');

const checker = require('./src/game/checker');
const publicStages = require('./src/game/publicStages');
const schemas = require('./src/schemas');
const moviesRouter = require('./src/routes/movies');
const reviewsRouter = require('./src/routes/reviews');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- server-rendered pages --------------------------------------------------

app.get('/', (req, res) => {
  // publicStages strips every solution. The secret specs never reach a template.
  res.render('game', {
    title: 'Reel REST',
    page: 'game',
    stages: publicStages.all(),
  });
});

// OWNER: Person A — placeholder route for the second SSR page.
app.get('/schemas', (req, res) => {
  res.render('schemas', {
    title: 'Schemas · Reel REST',
    page: 'schemas',
    schemas,
  });
});

// --- API --------------------------------------------------------------------

app.use('/api', checker);
app.use('/api', reviewsRouter);
app.use('/api/movies', moviesRouter);

// Unknown /api path: a real 404, with a verdict attached by the patched res.json.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No API route matches ${req.method} /api${req.path}`,
  });
});

// --- 404 and central error handler -----------------------------------------

app.use((req, res) => {
  res.status(404).type('text/plain').send('404 — no such page. The game lives at /');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'The request body is not valid JSON.',
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', message: 'Something broke on the server.' });
});

app.listen(PORT, () => {
  console.log(`Reel REST running at http://localhost:${PORT}`);
});

module.exports = app;
