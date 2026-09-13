module.exports = [
  {
    id: 1,
    title: 'The whole catalogue',
    scenario:
      'The archive just went online and the home page needs something to show. Ask the server for every movie it has.',
    hint: 'The plainest request there is: the method that reads, the path of the collection itself, and nothing else attached to it.',
    needs: { routeParam: false, query: false, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies',
        success:
          'That is the collection endpoint. GET reads, /api/movies is the whole set, and 200 came back with JSON — count plus the rows.',
        feedback: {
          method: 'Reading never changes anything on the server. Which method is the one that only reads?',
          path: 'The whole collection has one address, and it is the plural resource name under /api.',
          query: 'Nothing needs narrowing down here — you want all of them, so the query string stays empty.',
        },
      },
    ],
  },
  {
    id: 2,
    title: 'One movie, by id',
    scenario:
      'A visitor clicks the third card in the list and expects a page about that one film. Ask the server for movie #3 on its own.',
    hint: 'A single item lives *under* its collection and is addressed by its id — the id belongs in the path, not in the query string.',
    needs: { routeParam: true, query: false, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies/3',
        success:
          'That is a route parameter: /api/movies/:id. The id is part of the address of the thing, so the response is one object, not a list.',
        feedback: {
          method: 'Still just reading — the method from stage 1 is the right one here too.',
          path: 'Take the collection path and hang the id off the end of it: collection, then a slash, then the id.',
          query: 'An id is not a filter. It identifies one resource, so it goes in the path — drop the query string.',
        },
      },
    ],
  },
  {
    id: 3,
    title: 'Sci-Fi, newest first',
    scenario:
      'The Sci-Fi shelf wants its own page, with the newest releases at the top. Same catalogue as stage 1 — only the server should do the filtering and the ordering, not the browser.',
    hint: 'One collection, three query params: which genre to keep, which field to sort by, and which direction to sort in.',
    needs: { routeParam: false, query: true, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies',
        query: { genre: 'Sci-Fi', sort: 'year', order: 'desc' },
        success:
          'Filtering and sorting are query params on the collection you already know — no second endpoint, no /api/sci-fi-movies. Change the params, change the answer.',
        feedback: {
          method: 'Filtering is still reading. Nothing is being created or changed.',
          path: 'A filtered list is the same collection seen through a filter, so the path does not change — the query string does.',
          query:
            'Three query params on /api/movies — no more, no less: which genre to keep, which field to sort by (the release year), and which direction. "Newest first" is descending.',
        },
      },
    ],
  },
  {
    id: 4,
    title: 'Search and filter together',
    scenario:
      'A user types "blade" into the search box and ticks "rated 4 and up". Both conditions have to hold at once — the archive has a low-rated Blade or two that must not come back.',
    hint: 'Two query params on the movie collection: one searches the text, one sets a numeric floor. The server ANDs them together.',
    needs: { routeParam: false, query: true, body: false },
    steps: [
      {
        method: 'GET',
        path: '/api/movies',
        query: { q: 'blade', minRating: '4' },
        success:
          'Query params combine — every one of them narrows the set further. Two conditions, one request, one round trip.',
        feedback: {
          method: 'Searching reads the catalogue, it does not change it.',
          path: 'Search runs over the collection. Keep the path, put the search term in the query string.',
          query:
            'Exactly two params and nothing else: the free-text search term, and the lowest rating you will accept. The /schemas page lists every param the movie collection understands.',
        },
      },
    ],
  },
  {
    id: 5,
    title: 'A new arrival',
    scenario:
      'The archivist has a film to add: "Sicario", directed by Denis Villeneuve, a Thriller from 2015. Send it to the server so it really joins the catalogue — stage 1 should be able to see it afterwards.',
    hint: 'Creating goes to the collection, not to an item id — the item has no id yet, the server hands one out. The film itself travels in the request body as JSON.',
    needs: { routeParam: false, query: false, body: true },
    steps: [
      {
        method: 'POST',
        path: '/api/movies',
        body: { required: ['title', 'director', 'genre', 'year'], forbidden: ['id'] },
        success:
          '201 Created, and a Location header pointing at the new movie. POST goes to the collection because the collection is what grows; the body carries the data, and the server assigns the id.',
        feedback: {
          method:
            'A GET cannot carry data and must not change anything. Which method means "add this to the collection"?',
          path: 'POST to the collection itself. Posting to an id would mean "add something inside that one movie", which is not a thing.',
          body:
            'The body is a JSON object with the four fields a movie needs: title, director, genre and year. Do not invent an id — the server hands that out, and it comes back in the response.',
        },
      },
    ],
  },
];
