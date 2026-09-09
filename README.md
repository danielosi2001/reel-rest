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
No database, no build step, no environment file — the data is loaded from `data/*.json`
into memory at boot, and a restart resets everything.

## Pages

| URL | What it is |
| --- | --- |
| `/` | The game. Server-rendered with EJS, then driven entirely by `fetch` — no page reloads. |
| `/schemas` | Reference table of both resources, their field types and query params. Also server-rendered. |

## The API

| Method | Path | Behaviour | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/movies` | List; `genre`, `minYear`, `minRating`, `q`, `sort`, `order` | 200 | 400 |
| GET | `/api/movies/:id` | One movie | 200 | 404 |
| POST | `/api/movies` | Create from JSON body | 201 | 400 |
| PATCH | `/api/movies/:id` | Partial update | 200 | 404 / 400 |
| DELETE | `/api/movies/:id` | Remove movie **and its reviews** | 204 | 404 |
| GET | `/api/movies/:id/reviews` | Reviews of one movie (the relation) | 200 | 404 |
| POST | `/api/movies/:id/reviews` | Add a review to a movie | 201 | 404 / 400 |
| GET | `/api/reviews` | List; `minScore`, `author`, `sort`, `order` | 200 | 400 |
| PUT | `/api/reviews/:id` | Full replace | 200 | 404 / 400 |
| DELETE | `/api/reviews/:id` | Delete a review | 204 | 404 |

Every response body is a JSON **object** (`{ count, data }` or `{ data }`), never a bare
array, so the game verdict can be merged into it.

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

## Who did what

| | Person A | Person B |
| --- | --- | --- |
| Back | `data/*.json`, `src/store.js`, `src/routes/movies.js`, `src/schemas.js` + `GET /schemas`, stage specs 1–5 | `server.js`, `src/routes/reviews.js`, `src/game/checker.js`, `src/game/publicStages.js`, stage specs 6–10 |
| Front | `public/js/builder.js`, `views/schemas.ejs`, `public/css/components.css` | `public/js/api.js`, `public/js/game.js`, `views/game.ejs` + header partial, `public/css/base.css` |

`src/game/stages/index.js` merges the two spec files and belongs to neither.
