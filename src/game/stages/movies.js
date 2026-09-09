// ---------------------------------------------------------------------------
// OWNER: Person A  —  PLACEHOLDER (stage specs 1-5)
// Written by Person B only so stages 6-10 are reachable when playing. Person A
// rewrites the scenario/hint wording; the object shape below is the contract
// that src/game/checker.js reads, so keep it.
//
// SECRET: nothing in this file may ever reach the client. Only
// src/game/publicStages.js is rendered.
// ---------------------------------------------------------------------------
module.exports = [
  {
    id: 1,
    title: 'The whole catalogue',
    scenario: 'The archive just went online. Ask the server for every movie it has.',
    hint: 'The plainest request there is: one method, one collection path, nothing else.',
    needs: { routeParam: false, query: false, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies',
        success: 'That is the collection endpoint — you asked for all of them and got all of them.',
      },
    ],
  },
  {
    id: 2,
    title: 'One movie',
    scenario: "A visitor clicks the third card in the list. Open movie #3's page.",
    hint: 'A single item lives *under* its collection, addressed by its id.',
    needs: { routeParam: true, query: false, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies/3',
        success: 'A route parameter — the id is part of the path, not the query string.',
      },
    ],
  },
  {
    id: 3,
    title: 'Sci-Fi, newest first',
    scenario: 'The Sci-Fi shelf wants its own page, with the newest releases at the top.',
    hint: 'Same collection as stage 1. Three query params: what to keep, what to sort by, which direction.',
    needs: { routeParam: false, query: true, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies',
        query: { genre: 'Sci-Fi', sort: 'year', order: 'desc' },
        success: 'Filtering and sorting are query params on the same collection — no new endpoint needed.',
      },
    ],
  },
  {
    id: 4,
    title: 'Search plus filter',
    scenario: 'A user types "blade" into the search box and ticks "rated 4 and up".',
    hint: 'Two query params on the movie collection: one searches, one filters.',
    needs: { routeParam: false, query: true, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies',
        query: { q: 'blade', minRating: '4' },
        success: 'Query params combine — the server ands them together.',
      },
    ],
  },
  {
    id: 5,
    title: 'A new arrival',
    scenario: 'The admin adds a movie to the archive: title, director, genre, year.',
    hint: 'Creating goes to the collection, not to an item, and the data travels in the body.',
    needs: { routeParam: false, query: false, body: true },
    steps: [
      {
        method: 'POST',
        path: '/api/movies',
        body: { required: ['title', 'director', 'genre', 'year'] },
        success: 'POST to the collection, data in the body, 201 Created back.',
        feedback: {
          method: 'Creating a new item is not a GET. Which method means "add this to the collection"?',
          path: 'POST goes to the collection itself, not to an item id.',
        },
      },
    ],
  },
];
