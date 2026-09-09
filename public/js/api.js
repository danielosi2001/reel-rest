/* ---------------------------------------------------------------------------
 * OWNER: Person B  —  the fetch wrapper
 *
 * One job: turn what the builder produced into a real HTTP request, attach the
 * stage headers, and hand back a result that game.js can render without having
 * to think about 204s, empty bodies or HTML error pages.
 * ------------------------------------------------------------------------- */
(function (window) {
  'use strict';

  function buildUrl(path, query) {
    var clean = (path || '').trim();
    if (clean && clean.charAt(0) !== '/') clean = '/' + clean;

    // The path field may already contain a query string; keep whichever the
    // player typed and append the param rows on top of it.
    var parts = clean.split('?');
    var base = parts[0];
    var params = new URLSearchParams(parts[1] || '');

    (query || []).forEach(function (row) {
      var key = (row.key || '').trim();
      if (!key) return;
      params.append(key, row.value == null ? '' : String(row.value).trim());
    });

    var qs = params.toString();
    return qs ? base + '?' + qs : base;
  }

  function readVerdictHeader(response) {
    var raw = response.headers.get('X-Game-Result');
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (err) {
      return null;
    }
  }

  function methodTakesBody(method) {
    return ['POST', 'PUT', 'PATCH'].indexOf(method) !== -1;
  }

  function send(request) {
    var method = (request.method || 'GET').toUpperCase();
    var url = buildUrl(request.path, request.query);

    var options = {
      method: method,
      headers: {
        Accept: 'application/json',
        'X-Stage-Id': String(request.stageId),
        'X-Stage-Step': String(request.step || 0)
      }
    };

    if (methodTakesBody(method) && request.body != null && request.body !== '') {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }

    return fetch(url, options).then(function (response) {
      return response.text().then(function (text) {
        var parsed = null;
        var isJson = (response.headers.get('Content-Type') || '').indexOf('application/json') !== -1;

        if (text && isJson) {
          try {
            parsed = JSON.parse(text);
          } catch (err) {
            parsed = null;
          }
        }

        // Prefer the verdict merged into the body; fall back to the header,
        // which is the only channel a 204 has.
        var game = (parsed && parsed._game) || readVerdictHeader(response) || null;

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: url,
          method: method,
          json: parsed,
          text: text,
          empty: text === '',
          game: game
        };
      });
    });
  }

  window.Api = { send: send, buildUrl: buildUrl };
})(window);
