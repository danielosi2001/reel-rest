/* ---------------------------------------------------------------------------
 * OWNER: Person B  —  the UI state machine
 *
 * Holds which stage (and which step within it) the player is on, sends the
 * request the builder produced, and reacts to the server's verdict. It never
 * decides whether an answer is right — it only reads `_game.correct`.
 * No navigation, no reload: everything below happens in place.
 * ------------------------------------------------------------------------- */
(function (window, document) {
  'use strict';

  var STAGES = window.__STAGES__ || [];

  var state = {
    index: 0,
    step: 0,
    solved: [],       // stage ids the server has confirmed
    attempts: 0,
    history: []
  };

  var ui = {};

  function $(id) {
    return document.getElementById(id);
  }

  function cacheUi() {
    ['stage-now', 'stage-total', 'score', 'attempts', 'progress-fill', 'stage-dots',
     'stage-eyebrow', 'stage-title', 'stage-scenario', 'step-label', 'stage-needs',
     'stage-hint', 'send', 'copy-curl', 'sent-url', 'verdict', 'verdict-text', 'next',
     'status-pill', 'response-body', 'history-list'].forEach(function (id) {
      ui[id] = $(id);
    });
  }

  function current() {
    return STAGES[state.index];
  }

  function isSolved(id) {
    return state.solved.indexOf(id) !== -1;
  }

  // --- rendering ------------------------------------------------------------

  function renderNeeds(stage) {
    var labels = [];
    if (stage.needs.routeParam) labels.push('route param');
    if (stage.needs.query) labels.push('query params');
    if (stage.needs.body) labels.push('JSON body');
    ui['stage-needs'].innerHTML = '';
    labels.forEach(function (label) {
      var chip = document.createElement('span');
      chip.className = 'need-chip';
      chip.textContent = label;
      ui['stage-needs'].appendChild(chip);
    });
  }

  function renderStepLabel(stage) {
    var label = stage.stepLabels && stage.stepLabels[state.step];
    if (stage.stepsTotal > 1 && label) {
      ui['step-label'].textContent = label;
      ui['step-label'].hidden = false;
    } else {
      ui['step-label'].hidden = true;
    }
  }

  function renderProgress() {
    ui['stage-now'].textContent = state.index + 1;
    ui.score.textContent = state.solved.length;
    ui.attempts.textContent = state.attempts;
    ui['progress-fill'].style.width = (state.solved.length / STAGES.length) * 100 + '%';

    ui['stage-dots'].querySelectorAll('.dot').forEach(function (dot) {
      var index = Number(dot.dataset.index);
      var id = Number(dot.dataset.stage);
      dot.classList.toggle('is-done', isSolved(id));
      dot.classList.toggle('is-current', index === state.index);
      // Completed stages stay replayable; locked ones stay locked.
      dot.disabled = !(isSolved(id) || index === state.index || index <= furthestUnlocked());
    });
  }

  function furthestUnlocked() {
    // The first unsolved stage, so the player can always reach where they are.
    for (var i = 0; i < STAGES.length; i++) {
      if (!isSolved(STAGES[i].id)) return i;
    }
    return STAGES.length - 1;
  }

  function renderStage() {
    var stage = current();
    ui['stage-eyebrow'].textContent = 'Stage ' + (state.index + 1) +
      (isSolved(stage.id) ? ' · solved' : '');
    ui['stage-title'].textContent = stage.title;
    ui['stage-scenario'].textContent = stage.scenario;
    ui['stage-hint'].textContent = stage.hint;
    renderNeeds(stage);
    renderStepLabel(stage);
    renderProgress();

    window.Builder.setNeeds(stage.needs);
    ui.verdict.hidden = true;
    ui.next.hidden = true;
  }

  function statusClass(status) {
    if (status >= 500) return 'is-5xx';
    if (status >= 400) return 'is-4xx';
    if (status >= 300) return 'is-3xx';
    return 'is-2xx';
  }

  function renderResponse(result) {
    ui['status-pill'].hidden = false;
    ui['status-pill'].textContent = result.status + ' ' + (result.statusText || '');
    ui['status-pill'].className = 'status-pill ' + statusClass(result.status);
    ui['sent-url'].textContent = result.method + ' ' + result.url;

    if (result.empty) {
      ui['response-body'].innerHTML =
        '<span class="muted">No body — 204 means "done, and there is nothing to send back".</span>';
    } else if (result.json) {
      ui['response-body'].textContent = JSON.stringify(result.json, null, 2);
    } else {
      ui['response-body'].textContent = result.text;
    }
  }

  function renderVerdict(kind, message, showNext) {
    ui.verdict.hidden = false;
    ui.verdict.className = 'verdict is-' + kind;
    ui['verdict-text'].textContent = message;
    ui.next.hidden = !showNext;
    if (showNext) ui.next.focus();
  }

  function pushHistory(result) {
    state.history.unshift({
      method: result.method,
      url: result.url,
      status: result.status,
      correct: Boolean(result.game && result.game.correct)
    });
    state.history = state.history.slice(0, 20);

    ui['history-list'].innerHTML = '';
    if (!state.history.length) {
      var empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = 'Nothing sent yet.';
      ui['history-list'].appendChild(empty);
      return;
    }
    state.history.forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'history-item ' + (entry.correct ? 'is-ok' : 'is-no');
      li.innerHTML =
        '<span class="h-mark">' + (entry.correct ? '✓' : '✗') + '</span>' +
        '<span class="h-method">' + entry.method + '</span>' +
        '<span class="h-url mono"></span>' +
        '<span class="h-status ' + statusClass(entry.status) + '">' + entry.status + '</span>';
      li.querySelector('.h-url').textContent = entry.url;
      ui['history-list'].appendChild(li);
    });
  }

  // --- actions --------------------------------------------------------------

  function goTo(index) {
    state.index = index;
    state.step = 0;
    window.Builder.reset();
    renderStage();
    ui['response-body'].innerHTML =
      '<span class="muted">Send a request and the server\'s answer shows up here.</span>';
    ui['status-pill'].hidden = true;
    ui['sent-url'].textContent = '';
    document.querySelector('.brief').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function handleVerdict(game) {
    var stage = current();

    if (!game) {
      renderVerdict('no', 'The server did not send a verdict for that request. Check the path — it may not be an API route at all.', false);
      return;
    }

    if (!game.correct) {
      state.step = 0; // a wrong request restarts a multi-step stage
      renderStepLabel(stage);
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

    var last = state.index === STAGES.length - 1;
    if (last && state.solved.length === STAGES.length) {
      renderVerdict('ok', game.message + '  That was the last stage — you have finished Reel REST.', false);
    } else {
      renderVerdict('ok', game.message, true);
    }
  }

  function send() {
    var problem = window.Builder.validate();
    if (problem) {
      renderVerdict('no', problem, false);
      return;
    }

    var request = window.Builder.getRequest();
    ui.send.disabled = true;

    window.Api.send({
      method: request.method,
      path: request.path,
      query: request.query,
      body: request.body,
      stageId: current().id,
      step: state.step
    }).then(function (result) {
      state.attempts += 1;
      renderResponse(result);
      pushHistory(result);
      handleVerdict(result.game);
      renderProgress();
    }).catch(function (err) {
      renderVerdict('no', 'The request could not be sent: ' + err.message, false);
    }).then(function () {
      ui.send.disabled = false;
    });
  }

  function copyCurl() {
    var text = window.Builder.toCurl(window.Builder.getRequest());
    var done = function () {
      var label = ui['copy-curl'].textContent;
      ui['copy-curl'].textContent = 'Copied';
      window.setTimeout(function () { ui['copy-curl'].textContent = label; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
    } else {
      window.prompt('Copy this:', text);
    }
  }

  function nextStage() {
    // Jump to the first stage that is still unsolved, wrapping if needed.
    for (var i = state.index + 1; i < STAGES.length; i++) {
      if (!isSolved(STAGES[i].id)) return goTo(i);
    }
    for (var j = 0; j < STAGES.length; j++) {
      if (!isSolved(STAGES[j].id)) return goTo(j);
    }
    goTo(Math.min(state.index + 1, STAGES.length - 1));
  }

  function init() {
    cacheUi();
    window.Builder.mount($('builder'));

    ui.send.addEventListener('click', send);
    ui.next.addEventListener('click', nextStage);
    ui['copy-curl'].addEventListener('click', copyCurl);

    ui['stage-dots'].addEventListener('click', function (event) {
      var dot = event.target.closest('.dot');
      if (dot && !dot.disabled) goTo(Number(dot.dataset.index));
    });

    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        send();
      }
    });

    renderStage();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window, document);
