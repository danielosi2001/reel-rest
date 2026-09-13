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

app.get('/', (req, res) => {
  res.render('game', {
    title: 'Reel REST',
    page: 'game',
    stages: publicStages.all(),
  });
});

app.get('/schemas', (req, res) => {
  res.render('schemas', {
    title: 'Schemas · Reel REST',
    page: 'schemas',
    ...schemas.pageModel(),
  });
});

app.use('/api', checker);
app.use('/api', reviewsRouter);
app.use('/api/movies', moviesRouter);

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No API route matches ${req.method} /api${req.path}`,
  });
});

app.use((req, res) => {
  res.status(404).type('text/plain').send('404 — no such page. The game lives at /');
});

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Reel REST running at http://localhost:${PORT}`);
  });
}

module.exports = app;
