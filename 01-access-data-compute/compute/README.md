# GA4GH Research Workspace

A minimal browser-based workspace application for managing and resolving [GA4GH DRS](https://ga4gh.github.io/data-repository-service-schemas/) URIs. Built with Vite and React; all state is persisted in browser `localStorage`.

## Features

- **Workspaces** — create and delete multiple independent workspaces
- **DRS URI management** — add and remove `drs://hostname/object_id` URIs within each workspace; input is validated against the DRS URI format
- **Autocomplete** — the URI input fetches the list of available objects from the configured DRS server and offers them as suggestions
- **Resolve** — resolves any URI against the configured DRS server (`GET /ga4gh/drs/v1/objects/{object_id}`) and displays the full JSON response inline
- **Server configuration** — the DRS base URL is configurable from the header and persists across sessions; defaults to the local DRS mock server

## Prerequisites

- Node.js 18+
- The [DRS mock server](../drs-mock/) running locally (or any GA4GH DRS-compatible server)

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev
```

Then start the DRS mock server in a separate terminal:

```bash
cd ../drs-mock
uvicorn main:app --host 0.0.0.0 --port 8080
```

The app defaults to `http://localhost:8080` as the DRS base URL.

## CORS note

Browsers enforce CORS on `fetch()` requests. If the DRS server does not return `Access-Control-Allow-Origin` headers, resolution calls will be blocked. Add CORS middleware to the mock server, or add a Vite dev proxy:

```js
// vite.config.js
server: {
  proxy: {
    '/ga4gh': 'http://localhost:8080',
  },
}
```

## Project structure

```
compute/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx      # React entrypoint
    ├── App.jsx       # All UI components
    ├── store.js      # localStorage state (workspaces + DRS base URL)
    ├── drs.js        # DRS URI parsing, resolution, and object listing
    └── index.css     # Styles
```

## localStorage schema

All state is stored under the key `ga4gh_workspaces`:

```json
{
  "workspaces": [
    {
      "id": "<uuid>",
      "createdAt": 1713600000000,
      "uris": ["drs://localhost/abc123..."]
    }
  ],
  "drsBaseUrl": "http://localhost:8080"
}
```
