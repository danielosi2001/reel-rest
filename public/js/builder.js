(function (window, document) {
  'use strict';

  const METHODS = [
    { name: 'GET', hasBody: false },
    { name: 'POST', hasBody: true },
    { name: 'PUT', hasBody: true },
    { name: 'PATCH', hasBody: true },
    { name: 'DELETE', hasBody: false },
  ];

  const takesBody = (method) => METHODS.some((entry) => entry.name === method && entry.hasBody);

  const h = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });
    children.filter(Boolean).forEach((child) => {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  };

  let root = null;
  let needs = { routeParam: false, query: false, body: false };
  const el = {};

  const addParamRow = ({ key = '', value = '', focus = false } = {}) => {
    const keyInput = h('input', {
      className: 'input input-key mono',
      placeholder: 'name',
      value: key,
      spellcheck: false,
      autocomplete: 'off',
      autocapitalize: 'none',
      'aria-label': 'Query param name',
    });
    const valueInput = h('input', {
      className: 'input input-value mono',
      placeholder: 'value',
      value,
      spellcheck: false,
      autocomplete: 'off',
      autocapitalize: 'none',
      'aria-label': 'Query param value',
    });
    const remove = h(
      'button',
      { type: 'button', className: 'btn btn-icon', 'aria-label': 'Remove this query param', title: 'Remove' },
      '×'
    );

    const row = h('div', { className: 'param-row' }, keyInput, valueInput, remove);

    remove.addEventListener('click', () => {
      row.remove();
      renderPreview();
    });

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addParamRow({ focus: true });
    });

    el.paramRows.appendChild(row);
    if (focus) keyInput.focus();
    return row;
  };

  const paramRows = () => Array.from(el.paramRows.querySelectorAll('.param-row'));

  const readParams = () =>
    paramRows().map((row) => ({
      key: row.querySelector('.input-key').value,
      value: row.querySelector('.input-value').value,
    }));

  const composePath = (rawPath, param) => {
    const path = rawPath.trim();
    const value = param.trim();
    if (!value) return path;
    if (/:[A-Za-z_]\w*/.test(path)) return path.replace(/:[A-Za-z_]\w*/, encodeURIComponent(value));
    return `${path.replace(/\/+$/, '')}/${encodeURIComponent(value)}`;
  };

  const renderPreview = () => {
    const request = getRequest();
    el.previewMethod.textContent = request.method;
    el.previewMethod.dataset.method = request.method;

    const path = request.path.trim();
    if (!path) {
      el.previewUrl.textContent = 'type a path to see the full URL';
      el.previewUrl.classList.add('is-empty');
      return;
    }
    el.previewUrl.classList.remove('is-empty');
    el.previewUrl.textContent = window.location.origin + window.Api.buildUrl(path, request.query);
  };

  const setBodyError = (message) => {
    el.bodyError.textContent = message || '';
    el.bodyError.hidden = !message;
  };

  const syncBodyVisibility = () => {
    const method = el.method.value;
    const allowed = takesBody(method);

    el.bodyBlock.hidden = !allowed;
    el.bodyNote.hidden = !(needs.body && !allowed);
    el.bodyNote.textContent = `A ${method} request carries no body — this stage has data to send, so it needs a method that can carry it.`;

    if (!allowed) setBodyError('');
    root.dataset.method = method;
    renderPreview();
  };

  const formatBody = () => {
    const raw = el.body.value.trim();
    if (!raw) return;
    try {
      el.body.value = JSON.stringify(JSON.parse(raw), null, 2);
      setBodyError('');
    } catch (error) {
      setBodyError(`Not valid JSON yet: ${error.message}`);
    }
  };

  const mount = (target) => {
    root = target;
    root.className = 'builder';
    root.replaceChildren();

    el.method = h('select', { className: 'select', id: 'method', 'aria-label': 'HTTP method' },
      ...METHODS.map(({ name }) => h('option', { value: name }, name)));

    el.path = h('input', {
      className: 'input input-path mono',
      id: 'path',
      placeholder: '/api/…',
      'aria-label': 'Request path',
      spellcheck: false,
      autocomplete: 'off',
      autocapitalize: 'none',
      autocorrect: 'off',
    });

    el.routeParam = h('input', {
      className: 'input input-param mono',
      id: 'route-param',
      placeholder: '3',
      'aria-label': 'Route parameter value',
      spellcheck: false,
      autocomplete: 'off',
      autocapitalize: 'none',
    });

    el.routeBlock = h(
      'div',
      { className: 'builder-block route-block', id: 'route-block', hidden: true },
      h('p', { className: 'block-label' }, 'Route parameter'),
      h('div', { className: 'route-row' },
        el.routeParam,
        h('span', { className: 'route-hint muted' }, 'goes into the path — as :id, or on the end')),
    );

    el.previewMethod = h('span', { className: 'preview-method', dataset: { method: 'GET' } }, 'GET');
    el.previewUrl = h('span', { className: 'preview-url is-empty' }, 'type a path to see the full URL');

    el.paramRows = h('div', { className: 'param-rows', id: 'param-rows' });
    const addParam = h('button', { type: 'button', className: 'btn btn-ghost btn-sm' }, '+ Add param');
    addParam.addEventListener('click', () => addParamRow({ focus: true }));

    el.body = h('textarea', {
      className: 'textarea mono',
      id: 'body',
      rows: 7,
      placeholder: '{\n  "field": "value"\n}',
      spellcheck: false,
      'aria-label': 'JSON request body',
    });
    el.bodyError = h('p', { className: 'field-error', id: 'body-error', hidden: true });

    const format = h('button', { type: 'button', className: 'btn btn-ghost btn-sm', title: 'Re-indent the JSON' }, 'Format');
    format.addEventListener('click', formatBody);

    el.bodyBlock = h(
      'div',
      { className: 'builder-block', id: 'body-block' },
      h('div', { className: 'block-head' },
        h('p', { className: 'block-label' }, 'JSON body'),
        format),
      el.body,
      el.bodyError
    );

    el.bodyNote = h('p', { className: 'body-note', hidden: true });

    root.append(
      h('div', { className: 'builder-line' }, el.method, el.path),
      el.routeBlock,
      h('p', { className: 'url-preview mono', 'aria-live': 'polite', 'aria-label': 'The URL that will be sent' },
        el.previewMethod, el.previewUrl),
      h('div', { className: 'builder-block' },
        h('p', { className: 'block-label' }, 'Query params'),
        el.paramRows,
        addParam),
      el.bodyBlock,
      el.bodyNote
    );

    root.addEventListener('input', renderPreview);
    el.method.addEventListener('change', syncBodyVisibility);
    el.body.addEventListener('input', () => setBodyError(''));

    el.path.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const send = document.getElementById('send');
      if (send && !send.disabled) send.click();
    });

    syncBodyVisibility();
    renderPreview();
  };

  const setNeeds = (stageNeeds) => {
    needs = { routeParam: false, query: false, body: false, ...stageNeeds };

    el.routeBlock.hidden = !needs.routeParam;
    if (!needs.routeParam) el.routeParam.value = '';

    if (needs.query) {
      if (paramRows().length === 0) addParamRow();
    } else {
      paramRows()
        .filter((row) => !row.querySelector('.input-key').value.trim() && !row.querySelector('.input-value').value.trim())
        .forEach((row) => row.remove());
    }

    syncBodyVisibility();
    renderPreview();
  };

  function getRequest() {
    const path = el.routeBlock.hidden
      ? el.path.value
      : composePath(el.path.value, el.routeParam.value);

    return {
      method: el.method.value,
      path,
      query: readParams(),
      body: el.bodyBlock.hidden ? '' : el.body.value.trim(),
    };
  }

  const validate = () => {
    setBodyError('');
    const request = getRequest();

    if (!request.path.trim()) return 'Type a path before sending — something like /api/…';

    const orphan = request.query.find((row) => !row.key.trim() && row.value.trim());
    if (orphan) return `The query param with the value "${orphan.value.trim()}" has no name.`;

    if (request.body) {
      try {
        JSON.parse(request.body);
      } catch (error) {
        setBodyError(`That body is not valid JSON: ${error.message}`);
        return 'The JSON body has a syntax error — fix it and send again.';
      }
    }

    return null;
  };

  const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

  const toCurl = (request) => {
    const url = window.location.origin + window.Api.buildUrl(request.path, request.query);
    const parts = [`curl -i -X ${request.method} ${shellQuote(url)}`];
    if (request.body) {
      parts.push("-H 'Content-Type: application/json'");
      parts.push(`-d ${shellQuote(request.body)}`);
    }
    return parts.join(' \\\n  ');
  };

  const reset = () => {
    if (!root) return;
    el.method.value = 'GET';
    el.path.value = '';
    el.routeParam.value = '';
    el.paramRows.replaceChildren();
    el.body.value = '';
    setBodyError('');
    syncBodyVisibility();
    if (needs.query) addParamRow();
    renderPreview();
  };

  window.Builder = { mount, setNeeds, getRequest, validate, toCurl, reset };
})(window, document);
