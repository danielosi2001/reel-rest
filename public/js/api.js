((window) => {
  'use strict';

  const SHOWN_HEADERS = ['Location', 'X-Deleted-Reviews'];

  const buildUrl = (path, query) => {
    let clean = (path || '').trim();
    if (clean && clean.charAt(0) !== '/') clean = `/${clean}`;

    const [base, search = ''] = clean.split('?');
    const params = new URLSearchParams(search);

    (query || []).forEach((row) => {
      const key = (row.key || '').trim();
      if (!key) return;
      params.append(key, row.value == null ? '' : String(row.value).trim());
    });

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const readVerdictHeader = (response) => {
    const raw = response.headers.get('X-Game-Result');
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (error) {
      return null;
    }
  };

  const readShownHeaders = (response) =>
    SHOWN_HEADERS
      .map((name) => ({ name, value: response.headers.get(name) }))
      .filter((header) => header.value !== null);

  const methodTakesBody = (method) => ['POST', 'PUT', 'PATCH'].includes(method);

  const parseJson = (text, response) => {
    const isJson = (response.headers.get('Content-Type') || '').includes('application/json');
    if (!text || !isJson) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  };

  const send = async (request) => {
    const method = (request.method || 'GET').toUpperCase();
    const url = buildUrl(request.path, request.query);

    const options = {
      method,
      headers: {
        Accept: 'application/json',
        'X-Stage-Id': String(request.stageId),
        'X-Stage-Step': String(request.step || 0),
      },
    };

    if (methodTakesBody(method) && request.body != null && request.body !== '') {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }

    const response = await fetch(url, options);
    const text = await response.text();
    const json = parseJson(text, response);

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      method,
      json,
      text,
      empty: text === '',
      headers: readShownHeaders(response),
      game: (json && json._game) || readVerdictHeader(response) || null,
    };
  };

  window.Api = { send, buildUrl };
})(window);
