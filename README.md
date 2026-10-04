# Personal Task Tracker

A small mobile-first, local-first task tracker designed for GitHub Pages.

## Architecture

- Static HTML/CSS/JavaScript
- IndexedDB for local task and event storage
- Optional JSON import/export
- Optional GitHub Contents API sync
- PWA service worker for basic offline use

## GitHub Pages

1. Create a GitHub repository.
2. Copy these files into it.
3. Enable GitHub Pages from the repository's Pages settings.
4. Open the published site.

## GitHub sync

The first version uses a personal fine-grained GitHub token entered by the user in Settings.

Recommended repository permissions:
- Repository access: only the task-tracker repository
- Contents: Read and write

The token is stored only in that browser's localStorage and is never written into the JSON file.

For stronger security, a future version should replace the personal token approach with a backend/OAuth flow.

## Data model

Tasks contain the current state. Task events preserve lifecycle history.

A GitHub backup looks roughly like:

{
  "version": 1,
  "exportedAt": "...",
  "tasks": [...],
  "events": [...]
}

## Important limitation

GitHub sync currently treats the GitHub JSON file as the shared source when you explicitly Pull or Push. It does not yet perform automatic conflict detection or merging between devices.
