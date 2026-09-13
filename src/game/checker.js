const stages = require('./stages');

const attempts = new Map();

const normalizePath = (pathname) =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

const isFilled = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const listOf = (keys) => `\`${keys.join('`, `')}\``;

const checkQuery = (step, query) => {
  const required = step.query || {};
  const requiredKeys = Object.keys(required);

  for (const key of requiredKeys) {
    if (query[key] === undefined) {
      return `The query string is missing \`${key}\`.`;
    }
    const expected = required[key];
    if (expected === null) continue;
    const actual = Array.isArray(query[key]) ? query[key][0] : query[key];
    if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
      return `\`${key}\` is set to \`${actual}\`, which is not what this stage asks for.`;
    }
  }

  if (!step.allowExtraQuery) {
    const extra = Object.keys(query).filter((key) => !requiredKeys.includes(key));
    if (extra.length) {
      return `This stage does not need the query param${extra.length > 1 ? 's' : ''} ${listOf(extra)}.`;
    }
  }

  return null;
};

const problem = (message, precise = false) => ({ message, precise });

const checkEquals = (field, actual, expected) => {
  if (actual === expected) return null;
  if (actual !== undefined && typeof actual !== typeof expected && String(actual) === String(expected)) {
    return problem(
      `\`${field}\` is the ${typeof actual} ${JSON.stringify(actual)} — send it as a JSON ${typeof expected}, without the quotes.`,
      true
    );
  }
  return problem(`\`${field}\` should be \`${JSON.stringify(expected)}\` for this stage.`);
};

const checkBody = (step, body) => {
  const spec = step.body;
  if (!spec) {
    return body && typeof body === 'object' && Object.keys(body).length
      ? problem('This stage does not send a request body.')
      : null;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return problem('This stage needs a JSON object as the request body.');
  }

  const missing = (spec.required || []).find((field) => !isFilled(body[field]));
  if (missing) return problem(`The body is missing \`${missing}\`.`);

  for (const [field, expected] of Object.entries(spec.equals || {})) {
    const mismatch = checkEquals(field, body[field], expected);
    if (mismatch) return mismatch;
  }

  const forbidden = (spec.forbidden || []).find((field) => body[field] !== undefined);
  if (forbidden) {
    return problem(`Remove \`${forbidden}\` — this stage should only send the field(s) it actually changes.`);
  }

  if (spec.exact) {
    const allowed = new Set([...(spec.required || []), ...Object.keys(spec.equals || {})]);
    const extra = Object.keys(body).filter((key) => !allowed.has(key));
    if (extra.length) {
      return problem(`Remove ${listOf(extra)} — this stage should only send the field(s) it actually changes.`);
    }
  }

  return null;
};

const judge = (step, req, fullPath) => {
  const feedback = step.feedback || {};

  if (req.method.toUpperCase() !== step.method.toUpperCase()) {
    return { correct: false, message: feedback.method || `${req.method} is not the right method here.` };
  }

  if (normalizePath(fullPath) !== normalizePath(step.path)) {
    return {
      correct: false,
      message: feedback.path || `${normalizePath(fullPath)} is not the resource this stage is about.`,
    };
  }

  const queryProblem = checkQuery(step, req.query);
  if (queryProblem) {
    return { correct: false, message: feedback.query || queryProblem };
  }

  const bodyProblem = checkBody(step, req.body);
  if (bodyProblem) {
    const message = bodyProblem.precise ? bodyProblem.message : feedback.body || bodyProblem.message;
    return { correct: false, message };
  }

  return { correct: true, message: step.success || 'Correct.' };
};

const refusal = (payload) => {
  const reasons = payload && Array.isArray(payload.details) && payload.details.length
    ? payload.details.join('; ')
    : payload && payload.message;
  return `The request has the right shape, but the server refused it with 400 Bad Request${reasons ? `: ${reasons}` : ''}. Read the response and fix the values.`;
};

const reject = (game, message) => ({ ...game, correct: false, stageComplete: false, nextStep: game.step, message });

const settle = (game, step, statusCode, payload) => {
  if (!game.correct) return game;
  if (step.expectStatus !== undefined) {
    if (statusCode === step.expectStatus) return game;
    const feedback = step.feedback && step.feedback.status;
    return reject(game, feedback || `This step expects the server to answer ${step.expectStatus}, but it answered ${statusCode}.`);
  }
  return statusCode === 400 ? reject(game, refusal(payload)) : game;
};

const writeVerdict = (res, game) => {
  res.locals.game = game;
  res.set('X-Game-Result', encodeURIComponent(JSON.stringify(game)));
};

const checker = (req, res, next) => {
  const stageId = Number(req.get('X-Stage-Id'));
  const stage = stages.byId(stageId);

  if (!stage) return next();

  const requested = Number(req.get('X-Stage-Step'));
  const stepIndex = Number.isInteger(requested) && requested >= 0 && requested < stage.steps.length
    ? requested
    : 0;
  const step = stage.steps[stepIndex];

  const count = (attempts.get(stageId) || 0) + 1;
  attempts.set(stageId, count);

  const verdict = judge(step, req, '/api' + req.path);
  const stageComplete = verdict.correct && stepIndex + 1 >= stage.steps.length;

  const game = {
    stageId,
    step: stepIndex,
    stepsTotal: stage.steps.length,
    nextStep: verdict.correct && !stageComplete ? stepIndex + 1 : stepIndex,
    correct: verdict.correct,
    stageComplete,
    message: verdict.message,
    attempts: count,
  };

  let final = null;
  const finalize = (payload) => {
    if (!final) {
      final = settle(game, step, res.statusCode, payload);
      writeVerdict(res, final);
    }
    return final;
  };

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const verdictForBody = finalize(payload);
    const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : { data: payload };
    return originalJson({ ...body, _game: verdictForBody });
  };

  const originalWriteHead = res.writeHead;
  res.writeHead = (...args) => {
    if (typeof args[0] === 'number') res.statusCode = args[0];
    finalize(null);
    return originalWriteHead.apply(res, args);
  };

  return next();
};

module.exports = checker;
module.exports.resetAttempts = () => attempts.clear();
module.exports.settle = settle;
