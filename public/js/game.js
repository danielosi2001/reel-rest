((window, document) => {
  'use strict';

  const STORAGE_KEY = 'reel-rest-progress';

  const readStages = () => {
    try {
      return JSON.parse(document.querySelector('.shell').dataset.stages || '[]');
    } catch (error) {
      return [];
    }
  };

  const STAGES = readStages();

  const state = {
    index: 0,
    step: 0,
    solved: [],
    attempts: 0,
    history: [],
  };

  const ui = {};

  const $ = (id) => document.getElementById(id);

  const cacheUi = () => {
    ['stage-now', 'stage-total', 'score', 'attempts', 'progress-fill', 'stage-dots',
      'stage-eyebrow', 'stage-title', 'stage-scenario', 'step-label', 'stage-needs',
      'stage-hint', 'send', 'copy-curl', 'sent-url', 'verdict', 'verdict-text', 'next',
      'status-pill', 'response-headers', 'response-body', 'history-list', 'reset-progress'].forEach((id) => {
      ui[id] = $(id);
    });
  };

  const current = () => STAGES[state.index];

  const isSolved = (id) => state.solved.includes(id);

  const saveProgress = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        index: state.index,
        solved: state.solved,
        attempts: state.attempts,
        history: state.history,
      }));
    } catch (error) {
      return;
    }
  };

  const loadProgress = () => {
    let saved = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return;
    }
    if (!saved || typeof saved !== 'object') return;

    const ids = STAGES.map((stage) => stage.id);
    state.solved = Array.isArray(saved.solved) ? [...new Set(saved.solved.filter((id) => ids.includes(id)))] : [];
    state.attempts = Number.isInteger(saved.attempts) && saved.attempts >= 0 ? saved.attempts : 0;
    state.history = Array.isArray(saved.history)
      ? saved.history
        .filter((entry) => entry && typeof entry.method === 'string' && typeof entry.url === 'string' && Number.isInteger(entry.status))
        .map(({ method, url, status, correct }) => ({ method, url, status, correct: Boolean(correct) }))
        .slice(0, 20)
      : [];

    const firstOpen = STAGES.findIndex((stage) => !state.solved.includes(stage.id));
    const reachable = firstOpen === -1 ? STAGES.length - 1 : firstOpen;
    const index = Number.isInteger(saved.index) ? saved.index : 0;
    state.index = index >= 0 && index < STAGES.length && (index <= reachable || state.solved.includes(STAGES[index].id))
      ? index
      : reachable;
  };

  const muted = (text) => {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = text;
    return span;
  };

  const renderNeeds = (stage) => {
    const labels = [
      stage.needs.routeParam && 'route param',
      stage.needs.query && 'query params',
      stage.needs.body && 'JSON body',
    ].filter(Boolean);

    ui['stage-needs'].replaceChildren(...labels.map((label) => {
      const chip = document.createElement('span');
      chip.className = 'need-chip';
      chip.textContent = label;
      return chip;
    }));
  };

  const renderStepLabel = (stage) => {
    const label = stage.stepLabels && stage.stepLabels[state.step];
    const show = stage.stepsTotal > 1 && Boolean(label);
    ui['step-label'].textContent = show ? label : '';
    ui['step-label'].hidden = !show;
  };

  const furthestUnlocked = () => {
    const index = STAGES.findIndex((stage) => !isSolved(stage.id));
    return index === -1 ? STAGES.length - 1 : index;
  };

  const renderProgress = () => {
    ui['stage-now'].textContent = state.index + 1;
    ui.score.textContent = state.solved.length;
    ui.attempts.textContent = state.attempts;
    ui['progress-fill'].style.width = `${(state.solved.length / STAGES.length) * 100}%`;
    ui['reset-progress'].hidden = state.attempts === 0 && state.solved.length === 0;

    const unlocked = furthestUnlocked();
    ui['stage-dots'].querySelectorAll('.dot').forEach((dot) => {
      const index = Number(dot.dataset.index);
      const id = Number(dot.dataset.stage);
      dot.classList.toggle('is-done', isSolved(id));
      dot.classList.toggle('is-current', index === state.index);
      dot.disabled = !(isSolved(id) || index === state.index || index <= unlocked);
    });
  };

  const renderStage = () => {
    const stage = current();
    ui['stage-eyebrow'].textContent = `Stage ${state.index + 1}${isSolved(stage.id) ? ' · solved' : ''}`;
    ui['stage-title'].textContent = stage.title;
    ui['stage-scenario'].textContent = stage.scenario;
    ui['stage-hint'].textContent = stage.hint;
    renderNeeds(stage);
    renderStepLabel(stage);
    renderProgress();

    window.Builder.setNeeds(stage.needs);
    ui.verdict.hidden = true;
    ui.next.hidden = true;
  };

  const statusClass = (status) => {
    if (status >= 500) return 'is-5xx';
    if (status >= 400) return 'is-4xx';
    if (status >= 300) return 'is-3xx';
    return 'is-2xx';
  };

  const renderHeaders = (headers) => {
    ui['response-headers'].replaceChildren(...headers.flatMap(({ name, value }) => {
      const term = document.createElement('dt');
      term.textContent = name;
      const detail = document.createElement('dd');
      detail.textContent = value;
      return [term, detail];
    }));
    ui['response-headers'].hidden = headers.length === 0;
  };

  const clearResponse = () => {
    ui['response-body'].replaceChildren(muted("Send a request and the server's answer shows up here."));
    ui['status-pill'].hidden = true;
    ui['sent-url'].textContent = '';
    renderHeaders([]);
  };

  const renderResponse = (result) => {
    ui['status-pill'].hidden = false;
    ui['status-pill'].textContent = `${result.status} ${result.statusText || ''}`.trim();
    ui['status-pill'].className = `status-pill ${statusClass(result.status)}`;
    ui['sent-url'].textContent = `${result.method} ${result.url}`;
    renderHeaders(result.headers);

    if (result.empty) {
      ui['response-body'].replaceChildren(muted('No body — 204 means "done, and there is nothing to send back".'));
    } else if (result.json) {
      ui['response-body'].textContent = JSON.stringify(result.json, null, 2);
    } else {
      ui['response-body'].textContent = result.text;
    }
  };

  const renderVerdict = (kind, message, showNext) => {
    ui.verdict.hidden = false;
    ui.verdict.className = `verdict is-${kind}`;
    ui['verdict-text'].textContent = message;
    ui.next.hidden = !showNext;
    if (showNext) ui.next.focus();
  };

  const historyItem = (entry) => {
    const li = document.createElement('li');
    li.className = `history-item ${entry.correct ? 'is-ok' : 'is-no'}`;

    const cell = (className, text) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      return span;
    };

    li.append(
      cell('h-mark', entry.correct ? '✓' : '✗'),
      cell('h-method', entry.method),
      cell('h-url mono', entry.url),
      cell(`h-status ${statusClass(entry.status)}`, String(entry.status))
    );
    return li;
  };

  const renderHistory = () => {
    if (!state.history.length) {
      const empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = 'Nothing sent yet.';
      ui['history-list'].replaceChildren(empty);
      return;
    }
    ui['history-list'].replaceChildren(...state.history.map(historyItem));
  };

  const pushHistory = (result) => {
    state.history = [
      {
        method: result.method,
        url: result.url,
        status: result.status,
        correct: Boolean(result.game && result.game.correct),
      },
      ...state.history,
    ].slice(0, 20);

    renderHistory();
  };

  const goTo = (index) => {
    state.index = index;
    state.step = 0;
    saveProgress();
    window.Builder.reset();
    renderStage();
    clearResponse();
    document.querySelector('.brief').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const noVerdictMessage = (result) =>
    result.status === 400
      ? 'The server could not read that body, so the request never reached the game. A request body has to be a JSON object, like { "field": "value" }.'
      : 'The server did not send a verdict for that request. Check the path — it may not be an API route at all.';

  const handleVerdict = (result) => {
    const stage = current();
    const { game } = result;

    if (!game) {
      renderVerdict('no', noVerdictMessage(result), false);
      return;
    }

    if (!game.correct) {
      renderVerdict('no', game.message, false);
      return;
    }

    if (!game.stageComplete) {
      state.step = game.nextStep;
      renderStepLabel(stage);
      renderVerdict('part', game.message, false);
      window.Builder.reset();
      window.Builder.setNeeds(stage.needs);
      return;
    }

    if (!isSolved(stage.id)) state.solved.push(stage.id);
    renderProgress();

    if (state.solved.length === STAGES.length) {
      renderVerdict('ok', `${game.message}  That was the last stage — you have finished Reel REST.`, false);
    } else {
      renderVerdict('ok', game.message, true);
    }
  };

  const send = async () => {
    const problem = window.Builder.validate();
    if (problem) {
      renderVerdict('no', problem, false);
      return;
    }

    const request = window.Builder.getRequest();
    ui.send.disabled = true;

    try {
      const result = await window.Api.send({
        method: request.method,
        path: request.path,
        query: request.query,
        body: request.body,
        stageId: current().id,
        step: state.step,
      });
      state.attempts += 1;
      renderResponse(result);
      pushHistory(result);
      handleVerdict(result);
      renderProgress();
      saveProgress();
    } catch (error) {
      renderVerdict('no', `The request could not be sent: ${error.message}`, false);
    } finally {
      ui.send.disabled = false;
    }
  };

  const copyCurl = () => {
    const text = window.Builder.toCurl(window.Builder.getRequest());
    const done = () => {
      const label = ui['copy-curl'].textContent;
      ui['copy-curl'].textContent = 'Copied';
      window.setTimeout(() => { ui['copy-curl'].textContent = label; }, 1200);
    };
    const fallback = () => window.prompt('Copy this:', text);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  };

  const nextStage = () => {
    const ahead = STAGES.findIndex((stage, index) => index > state.index && !isSolved(stage.id));
    if (ahead !== -1) return goTo(ahead);
    const behind = STAGES.findIndex((stage) => !isSolved(stage.id));
    if (behind !== -1) return goTo(behind);
    return goTo(Math.min(state.index + 1, STAGES.length - 1));
  };

  const forgetProgress = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  };

  const startOver = () => {
    forgetProgress();
    state.solved = [];
    state.attempts = 0;
    state.history = [];
    renderHistory();
    goTo(0);
  };

  const init = () => {
    cacheUi();
    loadProgress();
    window.Builder.mount($('builder'));

    ui.send.addEventListener('click', send);
    ui.next.addEventListener('click', nextStage);
    ui['copy-curl'].addEventListener('click', copyCurl);
    ui['reset-progress'].addEventListener('click', startOver);

    ui['stage-dots'].addEventListener('click', (event) => {
      const dot = event.target.closest('.dot');
      if (dot && !dot.disabled) goTo(Number(dot.dataset.index));
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        send();
      }
    });

    renderHistory();
    renderStage();
  };

  document.addEventListener('DOMContentLoaded', init);
})(window, document);
