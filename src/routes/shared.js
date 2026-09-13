const badRequest = (res, message, details = []) =>
  res.status(400).json({
    error: 'Bad Request',
    message,
    ...(details.length ? { details } : {}),
  });

const notFound = (res, message) => res.status(404).json({ error: 'Not Found', message });

const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      const swap = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + cost);
      previous = swap;
    }
  }
  return row[b.length];
};

const didYouMean = (word, candidates) => {
  const [best] = candidates
    .map((candidate) => ({ candidate, score: distance(word, candidate) }))
    .sort((a, b) => a.score - b.score);
  return best && best.score <= Math.max(2, Math.ceil(word.length / 3)) ? best.candidate : null;
};

const unknownKeyError = (kind, name, allowed) => {
  const suggestion = didYouMean(name, allowed);
  return suggestion
    ? `${name} is not a ${kind} — did you mean ${suggestion}?`
    : `${name} is not a ${kind}. Allowed: ${allowed.join(', ')}`;
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const single = (raw) => (Array.isArray(raw) ? raw[raw.length - 1] : raw);

const text = (name, raw, errors) => {
  const value = String(single(raw)).trim();
  if (value === '') {
    errors.push(`${name} was sent without a value — give it something to match, or leave it out`);
    return null;
  }
  return value;
};

const numeric = (name, raw, errors) => {
  const value = text(name, raw, errors);
  if (value === null) return null;
  if (!Number.isFinite(Number(value))) {
    errors.push(`${name} must be a number, got "${value}"`);
    return null;
  }
  return Number(value);
};

const oneOf = (name, raw, allowed, errors) => {
  const value = text(name, raw, errors);
  if (value === null) return null;
  if (!allowed.includes(value)) {
    errors.push(`${name} must be one of: ${allowed.join(', ')}`);
    return null;
  }
  return value;
};

const compareBy = (field, direction) => (a, b) => {
  const left = a[field];
  const right = b[field];
  const result =
    typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, 'en', { sensitivity: 'base' })
      : Number(left) - Number(right);
  return result * direction;
};

module.exports = {
  badRequest,
  notFound,
  didYouMean,
  unknownKeyError,
  isPlainObject,
  single,
  text,
  numeric,
  oneOf,
  compareBy,
};
