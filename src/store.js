const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const readSeed = (fileName) => {
  const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));
  if (!Array.isArray(rows)) throw new Error(`data/${fileName} must contain a JSON array.`);
  return rows;
};

const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

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

  add(fields) {
    const { id: _ignored, ...rest } = fields;
    const created = { id: this.#nextId++, ...rest };
    this.#rows.push(created);
    return copy(created);
  }

  update(id, fields) {
    const row = this.#find(id);
    if (!row) return null;
    const { id: _ignored, ...rest } = fields;
    Object.assign(row, rest);
    return copy(row);
  }

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
