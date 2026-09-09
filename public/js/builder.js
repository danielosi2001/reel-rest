/* ---------------------------------------------------------------------------
 * OWNER: Person A  —  PLACEHOLDER
 * Written by Person B only so the game runs. Person A replaces this file
 * wholesale; keep the exported shape, it is what game.js calls:
 *
 *   Builder.mount(el)          render the controls
 *   Builder.setNeeds(needs)    show/hide the body box for the current stage
 *   Builder.getRequest()       -> { method, path, query:[{key,value}], body }
 *   Builder.validate()         -> null | 'error message'  (UX only, never correctness)
 *   Builder.toCurl(request)    -> string
 *   Builder.reset()
 * ------------------------------------------------------------------------- */
(function (window, document) {
  'use strict';

  var METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  var root = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function paramRow() {
    var row = el('div', 'param-row');
    var key = el('input', 'input input-key');
    key.placeholder = 'key';
    key.setAttribute('aria-label', 'Query param name');
    var value = el('input', 'input input-value');
    value.placeholder = 'value';
    value.setAttribute('aria-label', 'Query param value');
    var remove = el('button', 'btn btn-icon', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove this query param');
    remove.addEventListener('click', function () {
      row.remove();
    });
    row.appendChild(key);
    row.appendChild(value);
    row.appendChild(remove);
    return row;
  }

  function mount(target) {
    root = target;
    root.innerHTML = '';
    root.className = 'builder';

    var line = el('div', 'builder-line');

    var method = el('select', 'select');
    method.id = 'method';
    method.setAttribute('aria-label', 'HTTP method');
    METHODS.forEach(function (name) {
      var option = el('option', null, name);
      option.value = name;
      method.appendChild(option);
    });

    var path = el('input', 'input input-path');
    path.id = 'path';
    path.placeholder = '/api/…';
    path.setAttribute('aria-label', 'Request path');
    path.autocomplete = 'off';
    path.spellcheck = false;

    line.appendChild(method);
    line.appendChild(path);
    root.appendChild(line);

    var params = el('div', 'builder-block');
    params.appendChild(el('p', 'block-label', 'Query params'));
    var rows = el('div', 'param-rows');
    rows.id = 'param-rows';
    params.appendChild(rows);
    var add = el('button', 'btn btn-ghost btn-sm', '+ Add param');
    add.type = 'button';
    add.addEventListener('click', function () {
      rows.appendChild(paramRow());
    });
    params.appendChild(add);
    root.appendChild(params);

    var bodyBlock = el('div', 'builder-block');
    bodyBlock.id = 'body-block';
    bodyBlock.appendChild(el('p', 'block-label', 'JSON body'));
    var body = el('textarea', 'textarea mono');
    body.id = 'body';
    body.rows = 6;
    body.placeholder = '{\n  "field": "value"\n}';
    body.spellcheck = false;
    body.setAttribute('aria-label', 'JSON request body');
    bodyBlock.appendChild(body);
    var bodyError = el('p', 'field-error');
    bodyError.id = 'body-error';
    bodyError.hidden = true;
    bodyBlock.appendChild(bodyError);
    root.appendChild(bodyBlock);
  }

  function setNeeds(needs) {
    if (!root) return;
    var bodyBlock = root.querySelector('#body-block');
    bodyBlock.hidden = !(needs && needs.body);
  }

  function getRequest() {
    var rows = [];
    root.querySelectorAll('.param-row').forEach(function (row) {
      rows.push({
        key: row.querySelector('.input-key').value,
        value: row.querySelector('.input-value').value
      });
    });

    var bodyBlock = root.querySelector('#body-block');
    var raw = bodyBlock.hidden ? '' : root.querySelector('#body').value.trim();

    return {
      method: root.querySelector('#method').value,
      path: root.querySelector('#path').value,
      query: rows,
      body: raw
    };
  }

  // Syntax help only. Correctness is decided by the server, never here.
  function validate() {
    var error = root.querySelector('#body-error');
    error.hidden = true;
    var request = getRequest();
    if (!request.path.trim()) return 'Type a path first.';
    if (!request.body) return null;
    try {
      JSON.parse(request.body);
    } catch (err) {
      error.textContent = 'That body is not valid JSON: ' + err.message;
      error.hidden = false;
      return 'The JSON body has a syntax error.';
    }
    return null;
  }

  function toCurl(request) {
    var url = window.location.origin + window.Api.buildUrl(request.path, request.query);
    var parts = ["curl -i -X " + request.method + " '" + url + "'"];
    if (request.body) {
      parts.push("-H 'Content-Type: application/json'");
      parts.push("-d '" + request.body.replace(/'/g, "'\\''") + "'");
    }
    return parts.join(' \\\n  ');
  }

  function reset() {
    if (!root) return;
    root.querySelector('#method').value = 'GET';
    root.querySelector('#path').value = '';
    root.querySelector('#param-rows').innerHTML = '';
    root.querySelector('#body').value = '';
    root.querySelector('#body-error').hidden = true;
  }

  window.Builder = {
    mount: mount,
    setNeeds: setNeeds,
    getRequest: getRequest,
    validate: validate,
    toCurl: toCurl,
    reset: reset
  };
})(window, document);
