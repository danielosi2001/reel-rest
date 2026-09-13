const express = require('express');

const listen = (app) => {
  const server = app.listen(0);
  const { port } = server.address();

  const request = async (path, options = {}) => {
    const { body, ...rest } = options;
    const response = await fetch(`http://localhost:${port}${path}`, {
      ...rest,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      json: text ? JSON.parse(text) : null,
      text,
    };
  };

  return { server, request, close: () => new Promise((resolve) => server.close(resolve)) };
};

const startServer = (mount) => {
  const app = express();
  app.use(express.json());
  mount(app);
  return listen(app);
};

module.exports = { startServer, listen };
