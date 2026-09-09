// ---------------------------------------------------------------------------
// OWNER: Person A  —  the in-memory database
//
// The brief forbids a real database, so the two JSON seed files are read once
// at boot and everything after that happens in memory. A restart is the reset
// button: nothing is ever written back to disk.
//
// Reads hand out *copies*. A route can therefore never mutate a stored row by
// accident — the only way in is add / update / replace / remove — which is what
// keeps the game honest when a player sends the same wrong request twice.
//
// Exported shape (the contract src/routes/*.js depends on):
//   store.movies / store.reviews -> Collection
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const readSeed = (fileName) => {
  const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));
  if (!Array.isArray(rows)) throw new Error(`data/${fileName} must contain a JSON array.`);
  return rows;
};

/** `"3"` and `3` are the same id; `"abc"`, `-1` and `3.5` are not ids at all. */
const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Rows are flat, so a shallow copy is a real copy. */
const copy = (row) => (row ? { ...row } : null);

class Collection {
  #rows;
  #nextId;

  constructor(rows) {
    this.#rows = rows.map(copy);
    this.#nextId = this.#rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  }

  get size() {
    return this.#rows.length;
  }

  /** Every row, in insertion order. */
  get all() {
    return this.getAll();
  }

  getAll() {
    return this.#rows.map(copy);
  }

  getById(id) {
    return copy(this.#find(id));
  }

  exists(id) {
    return this.#find(id) !== undefined;
  }

  filter(predicate) {
    return this.#rows.filter(predicate).map(copy);
  }

  /** The server owns the id — whatever `fields.id` says is thrown away. */
  add(fields) {
    const { id: _ignored, ...rest } = fields;
    const created = { id: this.#nextId++, ...rest };
    this.#rows.push(created);
    return copy(created);
  }

  /** Partial update (PATCH): merge the given fields, keep the rest, keep the id. */
  update(id, fields) {
    const row = this.#find(id);
    if (!row) return null;
    const { id: _ignored, ...rest } = fields;
    Object.assign(row, rest);
    return copy(row);
  }

  /** Full replace (PUT): the row becomes exactly what was handed over. */
  replace(id, fields) {
    const index = this.#indexOf(id);
    if (index === -1) return null;
    const { id: _ignored, ...rest } = fields;
    const replaced = { id: this.#rows[index].id, ...rest };
    this.#rows[index] = replaced;
    return copy(replaced);
  }

  remove(id) {
    const index = this.#indexOf(id);
    if (index === -1) return null;
    return copy(this.#rows.splice(index, 1)[0]);
  }

  /** Used for cascading deletes: drop every row the predicate matches. */
  removeWhere(predicate) {
    const removed = this.#rows.filter(predicate);
    this.#rows = this.#rows.filter((row) => !predicate(row));
    return removed.map(copy);
  }

  #find(id) {
    const key = toId(id);
    return key === null ? undefined : this.#rows.find((row) => row.id === key);
  }

  #indexOf(id) {
    const key = toId(id);
    return key === null ? -1 : this.#rows.findIndex((row) => row.id === key);
  }
}

module.exports = {
  movies: new Collection(readSeed('movies.json')),
  reviews: new Collection(readSeed('reviews.json')),
  toId,
};
