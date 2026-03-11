# Feature Spec -> Backend Initialization for Github oAuth webhook

## General Idea
---
- Users will first sign in to github and give read access to all of their repositories (this is required)
- The extension will then create a webhook that receives the following whenever there is a new push to any repo on any branch for that user (also PRs):
    - Diff size
    - Date // time
- Using this information, tamagotchi logic will then be assigned downstream

## Requirements for this spec
---
- Initialize a lightweight backend structure that will be hosted on Railway and Supabase

Suggested tools and frameworks:

```
    Chrome Extension
        ↕ REST/Realtime
    Railway (Express/FastAPI server)
        → validates GitHub webhook signatures (HMAC)
        → computes owed time from diff size
        → writes enforcement state to Supabase
        ↕
    Supabase (Postgres)
        → users, commits, watch_sessions, avatar_state tables
        → GitHub OAuth session handling
        ↕ Realtime channel
    Chrome Extension (live avatar updates)

```
Suggested project structure (may require renaming and reorganizing project tools, dependencies, configuration files, test logic which is fine)
```
    rotagotchi/
    ├── apps/
    │   ├── web/                  # Frontend (React, Next.js, etc.)
    │   │   ├── src/
    │   │   ├── public/
    │   │   └── package.json
    │   └── api/                  # Backend (Express, FastAPI, etc.)
    │       ├── src/
    │       └── package.json
    ├── packages/
    │   └── shared/               # Shared types, utils, constants
    │       ├── types/
    │       ├── utils/
    │       └── package.json
    ├── package.json              # Root — workspaces config
    ├── .gitignore
    └── README.md

```
