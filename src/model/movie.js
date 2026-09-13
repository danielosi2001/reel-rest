const YEAR = Object.freeze({ min: 1888, max: 2100 });
const RATING = Object.freeze({ min: 0, max: 5, decimals: 1 });
const MAX_LIMIT = 50;

const SORTABLE = Object.freeze(['id', 'title', 'director', 'genre', 'year', 'rating']);
const ORDERS = Object.freeze(['asc', 'desc']);

const asString = (name) => (raw) =>
  typeof raw === 'string' && raw.trim() !== ''
    ? { value: raw.trim() }
    : { error: `${name} must be a non-empty string` };

const asInteger = (name, { min, max }) => (raw) => {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return Number.isInteger(value) && value >= min && value <= max
    ? { value }
    : { error: `${name} must be a whole number between ${min} and ${max}` };
};

const asDecimal = (name, { min, max, decimals }) => (raw) => {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return { error: `${name} must be a number between ${min} and ${max}` };
  }
  return { value: Number(value.toFixed(decimals)) };
};

const asBoolean = (name) => (raw) => {
  if (typeof raw === 'boolean') return { value: raw };
  if (raw === 'true' || raw === 'false') return { value: raw === 'true' };
  return { error: `${name} must be true or false` };
};

const FIELDS = Object.freeze([
  {
    name: 'id',
    type: 'number',
    writable: false,
    required: false,
    example: '1',
    notes: 'Assigned by the server, and never taken from the request.',
  },
  {
    name: 'title',
    type: 'string',
    writable: true,
    required: true,
    example: '"Blade Runner"',
    notes: 'Non-empty text.',
    parse: asString('title'),
  },
  {
    name: 'director',
    type: 'string',
    writable: true,
    required: true,
    example: '"Ridley Scott"',
    notes: 'Non-empty text.',
    parse: asString('director'),
  },
  {
    name: 'genre',
    type: 'string',
    writable: true,
    required: true,
    example: '"Sci-Fi"',
    notes: 'Sci-Fi, Action, Crime, Thriller, Comedy, Drama, Animation.',
    parse: asString('genre'),
  },
  {
    name: 'year',
    type: 'number',
    writable: true,
    required: true,
    example: '1982',
    notes: `Whole number, ${YEAR.min}–${YEAR.max}.`,
    parse: asInteger('year', YEAR),
  },
  {
    name: 'rating',
    type: 'number',
    writable: true,
    required: false,
    default: 0,
    example: '4.4',
    notes: `${RATING.min}–${RATING.max}, one decimal. Defaults to ${RATING.min}.`,
    parse: asDecimal('rating', RATING),
  },
  {
    name: 'inStock',
    type: 'boolean',
    writable: true,
    required: false,
    default: true,
    example: 'true',
    notes: 'Available to borrow. Defaults to true.',
    parse: asBoolean('inStock'),
  },
]);

const WRITABLE = Object.freeze(FIELDS.filter((field) => field.writable));
const WRITABLE_NAMES = Object.freeze(WRITABLE.map((field) => field.name));
const REQUIRED_NAMES = Object.freeze(WRITABLE.filter((field) => field.required).map((f) => f.name));

const FIELD_ORDER = Object.freeze(FIELDS.map((field) => field.name));

const QUERY = Object.freeze([
  { name: 'genre', type: 'string', kind: 'filter', example: 'genre=Sci-Fi', description: 'Keeps only that genre. Case-insensitive, whole-value match.' },
  { name: 'q', type: 'string', kind: 'search', example: 'q=blade', description: 'Free-text search across title and director.' },
  { name: 'minYear', type: 'number', kind: 'filter', example: 'minYear=2010', description: 'Released in that year or later.' },
  { name: 'maxYear', type: 'number', kind: 'filter', example: 'maxYear=1999', description: 'Released in that year or earlier.' },
  { name: 'minRating', type: 'number', kind: 'filter', example: 'minRating=4', description: 'Rated that high or higher.' },
  { name: 'inStock', type: 'boolean', kind: 'filter', example: 'inStock=true', description: 'Only borrowable copies, or only the ones that are out.' },
  { name: 'sort', type: 'string', kind: 'sort', example: 'sort=year', description: `Sort by ${SORTABLE.join(', ')}.` },
  { name: 'order', type: 'string', kind: 'sort', example: 'order=desc', description: `${ORDERS.join(' (default) or ')}. Only valid together with sort.` },
  { name: 'limit', type: 'number', kind: 'page', example: 'limit=5', description: `At most this many rows, 1–${MAX_LIMIT}.` },
  { name: 'offset', type: 'number', kind: 'page', example: 'offset=10', description: 'Skip this many rows first. Pairs with limit for paging.' },
]);

const QUERY_NAMES = Object.freeze(QUERY.map((param) => param.name));

module.exports = {
  YEAR,
  RATING,
  MAX_LIMIT,
  SORTABLE,
  ORDERS,
  FIELDS,
  FIELD_ORDER,
  WRITABLE,
  WRITABLE_NAMES,
  REQUIRED_NAMES,
  QUERY,
  QUERY_NAMES,
};
