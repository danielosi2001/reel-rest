// ---------------------------------------------------------------------------
// OWNER: Person B  —  stage specs 6-10
//
// SECRET: nothing in this file may ever reach the client. Only
// src/game/publicStages.js is rendered.
//
// Spec shape (frozen at M0, read by src/game/checker.js):
//   { id, title, scenario, hint, needs:{routeParam,query,body}, steps:[ step ] }
//   step = { label?, method, path, query?, allowExtraQuery?, body?, success?, feedback? }
//   body = { required?:[], equals?:{}, forbidden?:[], exact?:bool }
// ---------------------------------------------------------------------------
module.exports = [
  {
    id: 6,
    title: 'Reviews of one movie',
    scenario: 'Movie #2 has a review section. Show every review written about that movie — and only that movie.',
    hint: 'Reviews belong to a movie. Reach them through the movie, the way a folder holds its files.',
    needs: { routeParam: true, query: false, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies/2/reviews',
        success: 'That is a nested resource: the reviews of movie 2 live under movie 2.',
        feedback: {
          path: 'You are close, but the reviews of one movie hang off that movie. Try building the path as collection → id → sub-collection.',
          query: 'This one needs no query string — the movie id already narrows it down, in the path.',
        },
      },
    ],
  },
  {
    id: 7,
    title: 'Five stars',
    scenario: 'You loved movie #2. Post a 5-star review of it, signed with your name.',
    hint: 'Same nested address as stage 6, but this time you are adding something — and the review itself travels in the body.',
    needs: { routeParam: true, query: false, body: true },
    steps: [
      {
        method: 'POST',
        path: '/api/movies/2/reviews',
        body: { required: ['author', 'text'], equals: { score: 5 } },
        success: 'Route param and body together: the path says which movie, the body says what the review is.',
        feedback: {
          method: 'Reading the reviews was a GET. Adding one is not.',
          path: 'The new review has to land under the movie it belongs to.',
          body: 'The body needs "author", "text", and a "score" of 5 — the movieId comes from the path, not the body.',
        },
      },
    ],
  },
  {
    id: 8,
    title: 'One field, nothing else',
    scenario: "Movie #1's rating was typed in wrong. Fix the rating — and change nothing else about it.",
    hint: 'There is a method for "here is a partial update" and one for "here is the whole thing, replace it". This is the first.',
    needs: { routeParam: true, query: false, body: true },
    steps: [
      {
        method: 'PATCH',
        path: '/api/movies/1',
        body: { required: ['rating'], exact: true },
        success: 'PATCH sends only what changes. PUT would have replaced the whole movie and dropped everything you left out.',
        feedback: {
          method: 'PUT replaces the entire item, so every field you leave out is lost. Which method sends only the change?',
          path: 'A partial update goes to the one item being changed, by id.',
          body: 'Send only { "rating": … }. Anything else in the body is a field you were told not to touch.',
        },
      },
    ],
  },
  {
    id: 9,
    title: 'Rewritten from scratch',
    scenario: 'A moderator rewrites review #4 completely — new author, new score, new text. The old version should not survive in any part.',
    hint: 'This is the opposite of stage 8: the whole item is being handed over, so the method is the one that replaces rather than patches.',
    needs: { routeParam: true, query: false, body: true },
    steps: [
      {
        method: 'PUT',
        path: '/api/reviews/4',
        body: { required: ['author', 'score', 'text'] },
        success: 'PUT is a full replace — the server rebuilt the review out of exactly what you sent.',
        feedback: {
          method: 'PATCH would merge your fields into the old review. This one has to replace it outright.',
          path: 'Review #4 is addressable on its own collection, not through a movie.',
          body: 'A full replace means every field: author, score and text.',
        },
      },
    ],
  },
  {
    id: 10,
    title: 'Delete, then read the error',
    scenario:
      'Two requests. First, take review #2 down. Then ask the server for movie #999, which was never in the archive, and read what it tells you.',
    hint: 'Deleting gives you a status code with no body at all. The second request is a normal read of an id that does not exist — the interesting part is the code that comes back.',
    needs: { routeParam: true, query: false, body: false },
    steps: [
      {
        label: 'Step 1 of 2 — remove review #2.',
        method: 'DELETE',
        path: '/api/reviews/2',
        success: '204 No Content: it worked, and there is deliberately nothing to show for it. Now go and ask for movie 999.',
        feedback: {
          method: 'Taking a resource down has its own method.',
          path: 'Point at the one review being removed, by id.',
        },
      },
      {
        label: 'Step 2 of 2 — now ask for movie #999.',
        method: 'GET',
        path: '/api/movies/999',
        success: '404 Not Found — the server answered honestly instead of pretending. That is an error you can read, not a crash.',
        feedback: {
          method: 'This half is just a read.',
          path: 'Ask for movie 999 specifically — the one that was never there.',
        },
      },
    ],
  },
];
