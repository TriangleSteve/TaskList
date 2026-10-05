# Local Task Tracker

A lightweight, local-first task tracker designed for GitHub Pages. There is no backend, no build process, and no account system. Task data stays in the browser's `localStorage` until you export it.

## Version 1.1.0

- Compact header: **Tasks + profile + New Task**
- Slide-out navigation to reclaim screen space
- Profile remains a page-level context across every view
- Empty active-status sections are hidden
- Drag-handle ordering within Priority, Next Up, Waiting On, and Reocurring
- Manual order is persisted in the task JSON
- Category and subcategory fields removed in favor of tags
- Task profile is implicit and no longer shown in the editor
- Date added / date completed moved under an Advanced fields disclosure
- Wider desktop layout with two-column status groups and two-column summary history
- Versioned CSS and JavaScript URLs for cache busting on GitHub Pages

## Views

### Active
Shows only non-empty active groups in this order:
1. Priority
2. Next Up
3. Waiting On
4. Reocurring

Use the drag handle on the left of a task to reorder tasks within a group.

### Summary
Shows completed work for the last day, week, month, quarter, or year and provides a copyable text summary.

### All Tasks
Search and filter the current profile's full task history, including completed and deleted tasks.

### Data & Profiles
Manage profiles, export/import JSON backups, inspect the dataset, or reset local data.

## Task fields

- ID
- Description
- Status
- Profile (stored on the task but implicit from the currently selected page profile)
- Tags
- Notes
- Date added
- Date completed
- Manual order

## Storage

The app uses these browser keys:

- `local-task-tracker-v1`
- `local-task-tracker-profile-v1`

The storage key intentionally remains the same as the first release so existing browser data is migrated automatically. The internal dataset schema is now version 2.

Clearing site data removes local tasks, so export JSON backups periodically if the data matters.

## Cache busting

Local assets use version query strings:

```html
<link rel="stylesheet" href="styles.css?v=1.1.0">
<script src="app.js?v=1.1.0"></script>
```

When publishing a new app version, bump both values (for example, `1.1.1`). This makes browsers request the new CSS and JavaScript rather than continuing to use cached copies.

## Run locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Copy the contents of this folder into the repository root.
2. Commit and push.
3. In **Settings → Pages**, select **Deploy from a branch**.
4. Choose the main branch and `/ (root)`.
5. Save.

The empty `.nojekyll` file tells GitHub Pages to serve the repository as a plain static site without Jekyll processing.
