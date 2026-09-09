// ---------------------------------------------------------------------------
// OWNER: Person A  —  PLACEHOLDER
// Written by Person B only so the reviews slice and the game engine can run.
// Person A replaces this file wholesale; keep the exported shape below, it is
// the agreed contract that routes/reviews.js depends on.
//
//   store.movies / store.reviews  ->  { all, getAll, getById, add, update, replace, remove }
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

function loadCollection(fileName) {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'data', fileName), 'utf8');
  return JSON.parse(raw);
}

function makeCollection(rows) {
  let items = rows;
  let nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;

  return {
    // Live in-memory array. Mutations are lost on restart, which the brief allows.
    get all() {
      return items;
    },
    getAll() {
      return items.slice();
    },
    getById(id) {
      return items.find((item) => item.id === Number(id)) || null;
    },
    add(fields) {
      const created = Object.assign({ id: nextId++ }, fields);
      items.push(created);
      return created;
    },
    update(id, fields) {
      const found = items.find((item) => item.id === Number(id));
      if (!found) return null;
      Object.assign(found, fields, { id: found.id });
      return found;
    },
    replace(id, fields) {
      const index = items.findIndex((item) => item.id === Number(id));
      if (index === -1) return null;
      const replaced = Object.assign({ id: Number(id) }, fields);
      items[index] = replaced;
      return replaced;
    },
    remove(id) {
      const index = items.findIndex((item) => item.id === Number(id));
      if (index === -1) return null;
      return items.splice(index, 1)[0];
    },
    removeWhere(predicate) {
      const removed = items.filter(predicate);
      items = items.filter((item) => !predicate(item));
      return removed;
    },
  };
}

module.exports = {
  movies: makeCollection(loadCollection('movies.json')),
  reviews: makeCollection(loadCollection('reviews.json')),
};
