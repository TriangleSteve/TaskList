# Local Task Tracker

A lightweight, local-first task tracker designed for GitHub Pages. There is no backend, no build process, and no account system. Your data stays in the browser's `localStorage` until you export it.

## Features

- Profile-first workflow: view one profile at a time (Work, Personal, etc.)
- Active task board grouped in this order:
  1. Priority
  2. Next Up
  3. Waiting On
  4. Reocurring
- Completion summaries for the last day, week, month, quarter, or year
- One-click copyable accomplishment summary
- Full task detail editor
- Task fields:
  - ID
  - Description
  - Date added
  - Date completed
  - Notes
  - Status
  - Profile
  - Category
  - Subcategory
  - Tags
- Searchable "All Tasks" table
- Soft-delete workflow plus optional permanent delete
- JSON export/import for backups and moving between devices
- Dark mode
- Desktop and mobile layouts
- Pico CSS via CDN
- No build step

## Run locally

You can simply open `index.html`, but browser security rules are friendlier if you serve the folder locally.

With Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Copy these files into the repository root.
3. Commit and push.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Choose your main branch and `/ (root)`.
7. Save.

GitHub will publish the site at the Pages URL shown in that settings screen.

## Storage behavior

The app stores data in the browser using these localStorage keys:

- `local-task-tracker-v1`
- `local-task-tracker-profile-v1`

This means:

- different browsers/devices have separate task data;
- clearing site data will erase tasks from that browser;
- GitHub itself never receives your task content;
- you should export JSON backups periodically if the data matters.

## Backup format

Exports are human-readable JSON and include all profiles and tasks. Importing a backup replaces the current browser dataset after confirmation.

## Suggested next iteration

Good follow-on additions would be:

- manual drag/drop ordering within each active status;
- recurring-task rules that create the next instance automatically;
- richer summary export (Markdown / CSV);
- optional due date and "waiting on" person fields;
- installable PWA/offline mode;
- configurable custom statuses or categories;
- profile-specific default categories and tags.
