// Merges the two secret spec files. Written once at M0, never edited after.
const stages = [...require('./movies'), ...require('./reviews')];

module.exports = {
  all: () => stages,
  byId: (id) => stages.find((stage) => stage.id === Number(id)) || null,
};
