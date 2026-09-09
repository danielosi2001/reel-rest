// ---------------------------------------------------------------------------
// OWNER: Person B  —  the leak-proof client payload
//
// The only thing allowed to cross into EJS or into a response. Anything that
// would give the answer away (path, method, query, body specs, feedback) is
// dropped here, deliberately by allow-list rather than by delete.
// ---------------------------------------------------------------------------
const stages = require('./stages');

function toPublic(stage) {
  return {
    id: stage.id,
    title: stage.title,
    scenario: stage.scenario,
    hint: stage.hint,
    needs: {
      routeParam: Boolean(stage.needs && stage.needs.routeParam),
      query: Boolean(stage.needs && stage.needs.query),
      body: Boolean(stage.needs && stage.needs.body),
    },
    stepsTotal: stage.steps.length,
    stepLabels: stage.steps.map((step) => step.label || null),
  };
}

module.exports = {
  all() {
    return stages.all().map(toPublic);
  },
  count() {
    return stages.all().length;
  },
};
