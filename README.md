# Reel REST

A 10-stage browser game that teaches HTTP by making the player compose **real** requests
against a **real** Express API. The theme is a movie archive with two linked resources —
`movies` and `reviews`. Every answer is judged on the server.

## Run it

```bash
npm install
npm start
```

Then open <http://localhost:3000>. (Set `PORT` to use another port.)

Node 18 or newer. No database, no build step, no bundler, no environment file — the data
is read from `data/*.json` into memory at boot, and a restart resets everything.

```bash
npm test        # 52 tests, no test framework to install — node --test
```

## Pages

| URL | What it is |
| --- | --- |
| `/` | The game. Server-rendered with EJS, then driven entirely by `fetch` — no page reloads. |
| `/schemas` | Reference table of both resources, their field types and query params. Also server-rendered. |

## The API

| Method | Path | Behaviour | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/movies` | List; `genre`, `q`, `minYear`, `maxYear`, `minRating`, `inStock`, `sort`, `order`, `limit`, `offset` | 200 | 400 |
| GET | `/api/movies/:id` | One movie, plus `links` to its reviews | 200 | 400 / 404 |
| POST | `/api/movies` | Create from JSON body; answers with a `Location` header | 201 | 400 |
| PUT | `/api/movies/:id` | Full replace — omitted optional fields go back to their defaults | 200 | 400 / 404 |
| PATCH | `/api/movies/:id` | Partial update — only the fields you send | 200 | 400 / 404 |
| DELETE | `/api/movies/:id` | Remove movie **and its reviews** (`X-Deleted-Reviews` says how many) | 204 | 400 / 404 |
| GET | `/api/movies/:id/reviews` | Reviews of one movie (the relation) | 200 | 400 / 404 |
| POST | `/api/movies/:id/reviews` | Add a review to a movie; answers with a `Location` header | 201 | 400 / 404 |
| GET | `/api/reviews` | List; `minScore`, `author`, `sort`, `order` | 200 | 400 |
| PUT | `/api/reviews/:id` | Full replace; `movieId` may move it to another movie | 200 | 400 / 404 |
| DELETE | `/api/reviews/:id` | Delete a review | 204 | 400 / 404 |

Every response body is a JSON **object** (`{ count, total, data }` or `{ data }`), never a
bare array, so the game verdict can be merged into it. A 4xx body is
`{ error, message, details? }`, where `details` lists every problem with the request at
once. `/schemas` documents all of it, field by field, rendered from `src/schemas.js`.

An id that is not a number (`/api/movies/abc`) is a **400** — the request is malformed.
An id that is simply not there (`/api/movies/999`) is a **404** — the request was fine,
the thing is not.

Nothing is silently ignored: an unknown query param, one sent with no value, or a body
field that is not part of the resource all come back as a 400 with the nearest valid name
suggested (`genrre` → *did you mean genre?*). What a movie is — fields, types, ranges,
query params, page size — is declared once in `src/model/movie.js`; the routes enforce it
and `/schemas` publishes it, so the documentation cannot drift from the API.

## The stages

| # | Scenario | Expected request |
| --- | --- | --- |
| 1 | See the whole catalogue | `GET /api/movies` |
| 2 | Open movie #3 | `GET /api/movies/3` |
| 3 | Sci-Fi only, newest first | `GET /api/movies?genre=Sci-Fi&sort=year&order=desc` |
| 4 | Search "blade" among 4+ rated | `GET /api/movies?q=blade&minRating=4` |
| 5 | Admin adds a movie | `POST /api/movies` + body |
| 6 | Reviews of movie #2 | `GET /api/movies/2/reviews` |
| 7 | Post a 5-star review on #2 | `POST /api/movies/2/reviews` + body |
| 8 | Fix only the rating of movie #1 | `PATCH /api/movies/1` + partial body |
| 9 | Rewrite review #4 completely | `PUT /api/reviews/4` + full body |
| 10 | Delete review #2, then read the 404 | `DELETE /api/reviews/2` → `GET /api/movies/999` |

## How the checking works

The correct answers live **only** on the server, in `src/game/stages/*.js`. Those files are
never rendered, never serialised and never sent. The client receives only
`src/game/publicStages.js` output: id, title, scenario, hint, and which inputs the stage needs.

1. The client sends the request the player built, with `X-Stage-Id` and `X-Stage-Step` headers.
2. `src/game/checker.js` runs first on `/api`, compares method + path + query + body against
   the secret spec, and records a verdict.
3. The request continues to the **real** route — so a wrong path really does return 404.
4. The verdict is merged into the JSON body as `_game`, and also written to the
   `X-Game-Result` header so that `204 No Content` responses still carry one.
5. A request of the right shape that the API still answers with `400` is not a solve — the
   verdict is flipped and carries the API's own `details`, so `{ "score": "5" }` or a rating
   of `9` cannot pass a stage.

## Who did what

| | Person A | Person B |
| --- | --- | --- |
| Back | `data/*.json`, `src/store.js`, `src/model/movie.js`, `src/routes/movies.js`, `src/schemas.js` + `GET /schemas`, stage specs 1–5, `test/` | `server.js`, `src/routes/reviews.js`, `src/game/checker.js`, `src/game/publicStages.js`, stage specs 6–10, `test/reviews.test.js`, `test/checker.test.js` |
| Front | `public/js/builder.js`, `views/schemas.ejs`, `public/css/components.css`, `public/favicon.ico` | `public/js/api.js`, `public/js/game.js`, `views/game.ejs` + header partial, `public/css/base.css` |

`src/game/stages/index.js` merges the two spec files and `src/routes/shared.js` holds the request
helpers both routers use (errors, *did you mean*, query parsing); they belong to neither.
