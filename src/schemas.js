const store = require('./store');
const movie = require('./model/movie');

const toFieldRow = ({ name, type, required, example, notes }) => ({ name, type, required, example, notes });
const toQueryRow = ({ name, type, example, description }) => ({ name, type, example, description });

const resources = [
  {
    name: 'movie',
    plural: 'movies',
    basePath: '/api/movies',
    description:
      'A film in the archive. Movies are the parent resource: a movie can be created, replaced, patched and deleted, and it owns a list of reviews.',
    fields: movie.FIELDS.map(toFieldRow),
    query: movie.QUERY.map(toQueryRow),
    relation: {
      text: 'One movie has many reviews. They are reached through the movie itself, not through a query param.',
      path: '/api/movies/:id/reviews',
    },
  },
  {
    name: 'review',
    plural: 'reviews',
    basePath: '/api/reviews',
    description:
      'One person’s verdict on one movie. A review is created under the movie it belongs to, but once it exists it has its own address and can be replaced or deleted on its own.',
    fields: [
      { name: 'id', type: 'number', required: false, example: '4', notes: 'Assigned by the server.' },
      { name: 'movieId', type: 'number', required: false, example: '2', notes: 'Foreign key → movie.id. Taken from the path when the review is created.' },
      { name: 'author', type: 'string', required: true, example: '"noa"', notes: 'Non-empty.' },
      { name: 'score', type: 'number', required: true, example: '5', notes: 'Whole number, 1–5.' },
      { name: 'text', type: 'string', required: true, example: '"Every frame is a poster."', notes: 'Non-empty.' },
      { name: 'createdAt', type: 'string', required: false, example: '"2024-02-15T20:22:00.000Z"', notes: 'ISO timestamp, set by the server.' },
    ],
    query: [
      { name: 'minScore', type: 'number', example: 'minScore=4', description: 'Scored that high or higher.' },
      { name: 'author', type: 'string', example: 'author=noa', description: 'Written by that author. Case-insensitive, whole-value match.' },
      { name: 'sort', type: 'string', example: 'sort=score', description: 'Sort by id, score, createdAt or author.' },
      { name: 'order', type: 'string', example: 'order=desc', description: 'asc (default) or desc. Only valid together with sort.' },
    ],
    relation: {
      text: 'A review belongs to exactly one movie. Delete the movie and its reviews go with it — nothing is left pointing at a film that is gone.',
      path: '/api/movies/:id/reviews',
    },
  },
];

const endpoints = [
  {
    resource: 'movie',
    method: 'GET',
    path: '/api/movies',
    summary: 'The whole catalogue, after any filters, search, sorting and paging.',
    returns: '{ count, total, data: [movie] }',
    statuses: [
      { code: 200, meaning: 'Here is the list — an empty list is still a success.' },
      { code: 400, meaning: 'A query param was malformed, e.g. sort=colour.' },
    ],
  },
  {
    resource: 'movie',
    method: 'GET',
    path: '/api/movies/:id',
    summary: 'One movie, addressed by its id.',
    returns: '{ data: movie, links }',
    statuses: [
      { code: 200, meaning: 'Found it.' },
      { code: 400, meaning: 'The id is not a number at all.' },
      { code: 404, meaning: 'Well-formed request, but no movie has that id.' },
    ],
  },
  {
    resource: 'movie',
    method: 'POST',
    path: '/api/movies',
    summary: 'Adds a movie to the collection. The body is the movie; the server assigns the id.',
    returns: '{ data: movie, links } + Location header',
    statuses: [
      { code: 201, meaning: 'Created. Location points at the new movie.' },
      { code: 400, meaning: 'A required field is missing or a value is the wrong type.' },
    ],
  },
  {
    resource: 'movie',
    method: 'PUT',
    path: '/api/movies/:id',
    summary:
      'Replaces the whole movie. Every required field has to be there, and any optional field you leave out goes back to its default — that is the difference from PATCH.',
    returns: '{ data: movie, links }',
    statuses: [
      { code: 200, meaning: 'Replaced.' },
      { code: 400, meaning: 'A required field is missing, or a value is invalid.' },
      { code: 404, meaning: 'No movie with that id.' },
    ],
  },
  {
    resource: 'movie',
    method: 'PATCH',
    path: '/api/movies/:id',
    summary: 'Changes only the fields you send. Everything you leave out stays as it was.',
    returns: '{ data: movie }',
    statuses: [
      { code: 200, meaning: 'Updated — the whole movie comes back.' },
      { code: 400, meaning: 'Nothing writable was sent, or a value was invalid.' },
      { code: 404, meaning: 'No movie with that id.' },
    ],
  },
  {
    resource: 'movie',
    method: 'DELETE',
    path: '/api/movies/:id',
    summary: 'Removes the movie and, with it, every review of that movie.',
    returns: 'no body — X-Deleted-Reviews says how many reviews went with it',
    statuses: [
      { code: 204, meaning: 'Gone. Deliberately nothing to send back.' },
      { code: 404, meaning: 'No movie with that id — nothing was deleted.' },
    ],
  },
  {
    resource: 'review',
    method: 'GET',
    path: '/api/movies/:id/reviews',
    summary: 'Every review of one movie. This is the relation, expressed as a nested path.',
    returns: '{ movieId, count, data: [review] }',
    statuses: [
      { code: 200, meaning: 'Here they are — possibly none, if nobody has written one.' },
      { code: 400, meaning: 'The id is not a number, or a query param was sent — filter at /api/reviews instead.' },
      { code: 404, meaning: 'That movie does not exist, so it has no reviews to list.' },
    ],
  },
  {
    resource: 'review',
    method: 'POST',
    path: '/api/movies/:id/reviews',
    summary: 'Writes a review of that movie. The path says which movie, the body says what the review is.',
    returns: '{ data: review } + Location header',
    statuses: [
      { code: 201, meaning: 'Created and attached to that movie. Location points at the new review.' },
      { code: 400, meaning: 'author, text or score is missing or invalid, or the body names a field the server owns.' },
      { code: 404, meaning: 'No movie with that id to review.' },
    ],
  },
  {
    resource: 'review',
    method: 'GET',
    path: '/api/reviews',
    summary: 'Every review in the archive, across all movies.',
    returns: '{ count, data: [review] }',
    statuses: [
      { code: 200, meaning: 'Here is the list.' },
      { code: 400, meaning: 'A query param was malformed, unknown, or sent without a value.' },
    ],
  },
  {
    resource: 'review',
    method: 'PUT',
    path: '/api/reviews/:id',
    summary: 'Replaces the whole review. Anything you leave out is not kept — it is gone.',
    returns: '{ data: review }',
    statuses: [
      { code: 200, meaning: 'Replaced.' },
      { code: 400, meaning: 'A full replace needs author, score and text; movieId, if sent, must be a movie that exists.' },
      { code: 404, meaning: 'No review with that id.' },
    ],
  },
  {
    resource: 'review',
    method: 'DELETE',
    path: '/api/reviews/:id',
    summary: 'Removes one review.',
    returns: 'no body',
    statuses: [
      { code: 204, meaning: 'Gone.' },
      { code: 400, meaning: 'The id is not a number at all.' },
      { code: 404, meaning: 'No review with that id.' },
    ],
  },
];

const conventions = [
  {
    title: 'Every body is an object',
    text: 'Collections answer with { count, data } and single items with { data }, never with a bare array. That leaves room for metadata beside the payload — and it is where the game slips its verdict in, as _game.',
  },
  {
    title: 'The path identifies, the query filters',
    text: 'An id is part of the address of a thing, so it lives in the path. Anything that narrows, sorts or pages a list is a query param — the resource is the same, you are just asking for less of it.',
  },
  {
    title: 'Errors explain themselves',
    text: 'A 4xx body is { error, message, details? }, where details lists every individual problem at once, so one round trip is enough to fix the request.',
  },
  {
    title: 'Nothing is silently ignored',
    text: 'A query param that is not on the list, one sent with no value at all, or a body field that is not part of the resource is a 400 — with the nearest valid name suggested. An API that quietly drops what it does not understand teaches you nothing.',
  },
  {
    title: 'Memory, not a database',
    text: 'The two JSON files under data/ are read once at startup. Creates, updates and deletes change the server’s memory and are visible to every later request — and a restart puts everything back.',
  },
];

const statusCodes = [
  { code: 200, name: 'OK', meaning: 'The request worked and the answer is in the body.' },
  { code: 201, name: 'Created', meaning: 'Something new exists now. Location says where.' },
  { code: 204, name: 'No Content', meaning: 'It worked and there is deliberately nothing to send back.' },
  { code: 400, name: 'Bad Request', meaning: 'The request itself is malformed — fix it and try again.' },
  { code: 404, name: 'Not Found', meaning: 'The request was fine; the thing it asked for is not here.' },
];

const pageModel = () => ({
  resources: resources.map((resource) => ({ ...resource, count: store[resource.plural].size })),
  endpoints,
  conventions,
  statusCodes,
});

module.exports = { resources, endpoints, conventions, statusCodes, pageModel };
