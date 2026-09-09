// ---------------------------------------------------------------------------
// OWNER: Person A  —  PLACEHOLDER
// Feeds GET /schemas. Person A replaces this file wholesale.
// ---------------------------------------------------------------------------
module.exports = [
  {
    resource: 'movie',
    basePath: '/api/movies',
    description: 'A film in the archive.',
    fields: [
      { name: 'id', type: 'number', notes: 'assigned by the server' },
      { name: 'title', type: 'string', notes: 'required on create' },
      { name: 'director', type: 'string', notes: 'required on create' },
      { name: 'genre', type: 'string', notes: 'Sci-Fi, Action, Drama, …' },
      { name: 'year', type: 'number', notes: 'release year' },
      { name: 'rating', type: 'number', notes: '0–5, one decimal' },
      { name: 'inStock', type: 'boolean', notes: 'available to borrow' },
    ],
    query: ['genre', 'minYear', 'minRating', 'q', 'sort', 'order'],
    relation: 'A movie has many reviews, reachable at /api/movies/:id/reviews.',
  },
  {
    resource: 'review',
    basePath: '/api/reviews',
    description: 'One person’s verdict on one movie.',
    fields: [
      { name: 'id', type: 'number', notes: 'assigned by the server' },
      { name: 'movieId', type: 'number', notes: 'foreign key → movie.id' },
      { name: 'author', type: 'string', notes: 'required' },
      { name: 'score', type: 'number', notes: 'whole number 1–5' },
      { name: 'text', type: 'string', notes: 'required' },
      { name: 'createdAt', type: 'string', notes: 'ISO timestamp, set by the server' },
    ],
    query: ['minScore', 'author', 'sort', 'order'],
    relation: 'A review belongs to exactly one movie.',
  },
];
