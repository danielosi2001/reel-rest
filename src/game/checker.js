// ---------------------------------------------------------------------------
// OWNER: Person B  —  the matching engine
//
// Mounted at /api, ahead of the real routers. It reads X-Stage-Id / X-Stage-Step,
// judges the *request* against the secret stage spec, and records the verdict:
//
//   * as `_game` merged into any JSON body (patched res.json), and
//   * as the X-Game-Result header, so 204 responses still carry a verdict.
//
// The request then continues to the real route, so a wrong path really does
// come back 404 — nothing here short-circuits the API.
// ---------------------------------------------------------------------------
const stages = require('./stages');

// stageId -> number of attempts made in this server run.
const attempts = new Map();

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function isFilled(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function checkQuery(step, query) {
  const required = step.query || {};
  const requiredKeys = Object.keys(required);

  for (const key of requiredKeys) {
    if (query[key] === undefined) {
      return `The query string is missing \`${key}\`.`;
    }
    const expected = required[key];
    if (expected === null) continue; // key must be present, any value
    const actual = Array.isArray(query[key]) ? query[key][0] : query[key];
    if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
      return `\`${key}\` is set to \`${actual}\`, which is not what this stage asks for.`;
    }
  }

  if (!step.allowExtraQuery) {
    const extra = Object.keys(query).filter((key) => !requiredKeys.includes(key));
    if (extra.length) {
      return `This stage does not need the query param${extra.length > 1 ? 's' : ''} \`${extra.join('`, `')}\`.`;
    }
  }

  return null;
}

function checkBody(step, body) {
  const spec = step.body;
  if (!spec) {
    if (body && typeof body === 'object' && Object.keys(body).length) {
      return 'This stage does not send a request body.';
    }
    return null;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'This stage needs a JSON object as the request body.';
  }

  for (const field of spec.required || []) {
    if (!isFilled(body[field])) {
      return `The body is missing \`${field}\`.`;
    }
  }

  for (const [field, expected] of Object.entries(spec.equals || {})) {
    if (String(body[field]) !== String(expected)) {
      return `\`${field}\` should be \`${expected}\` for this stage.`;
    }
  }

  for (const field of spec.forbidden || []) {
    if (body[field] !== undefined) {
      return `Remove \`${field}\` — this stage should only send the field(s) it actually changes.`;
    }
  }

  if (spec.exact) {
    const allowed = new Set([...(spec.required || []), ...Object.keys(spec.equals || {})]);
    const extra = Object.keys(body).filter((key) => !allowed.has(key));
    if (extra.length) {
      return `Remove \`${extra.join('`, `')}\` — this stage should only send the field(s) it actually changes.`;
    }
  }

  return null;
}

function judge(step, req, fullPath) {
  const feedback = step.feedback || {};

  if (req.method.toUpperCase() !== step.method.toUpperCase()) {
    return { correct: false, message: feedback.method || `${req.method} is not the right method here.` };
  }

  if (normalizePath(fullPath) !== normalizePath(step.path)) {
    return { correct: false, message: feedback.path || `${normalizePath(fullPath)} is not the resource this stage is about.` };
  }

  const queryProblem = checkQuery(step, req.query);
  if (queryProblem) {
    return { correct: false, message: feedback.query || queryProblem };
  }

  const bodyProblem = checkBody(step, req.body);
  if (bodyProblem) {
    return { correct: false, message: feedback.body || bodyProblem };
  }

  return { correct: true, message: step.success || 'Correct.' };
}

function checker(req, res, next) {
  const stageId = Number(req.get('X-Stage-Id'));
  const stage = stages.byId(stageId);

  if (!stage) {
    // Not a game request (curl, a stray fetch). Leave the API alone.
    return next();
  }

  const requested = Number(req.get('X-Stage-Step'));
  const stepIndex = Number.isInteger(requested) && requested >= 0 && requested < stage.steps.length
    ? requested
    : 0;
  const step = stage.steps[stepIndex];

  const count = (attempts.get(stageId) || 0) + 1;
  attempts.set(stageId, count);

  const fullPath = '/api' + req.path;
  const verdict = judge(step, req, fullPath);

  const nextStep = verdict.correct ? stepIndex + 1 : stepIndex;
  const stageComplete = verdict.correct && nextStep >= stage.steps.length;

  const game = {
    stageId,
    step: stepIndex,
    stepsTotal: stage.steps.length,
    nextStep: stageComplete ? stepIndex : nextStep,
    correct: verdict.correct,
    stageComplete,
    message: verdict.message,
    attempts: count,
  };

  res.locals.game = game;
  // 204 and any non-JSON response still gets a verdict this way.
  res.set('X-Game-Result', encodeURIComponent(JSON.stringify(game)));

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return originalJson(Object.assign({}, payload, { _game: game }));
    }
    return originalJson({ data: payload, _game: game });
  };

  next();
}

module.exports = checker;
module.exports.resetAttempts = () => attempts.clear();
