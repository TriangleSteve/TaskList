# Task Tracker v2.0

A local-first task and event tracker designed for GitHub Pages.

## What's new in v2.0

- Desktop-first layout with a persistent navigation sidebar.
- Active tasks return to a single-column list.
- A right-side Schedule rail shows Past Due, Today, the next six days, and Upcoming events.
- Events are stored separately from tasks and can be Scheduled, Completed, or Cancelled.
- Completed events appear alongside completed tasks on the Summary page.
- Wider desktop task/event editors.
- Lighter task typography and tighter desktop spacing.
- Checked-checkbox favicon.
- Existing v1.x tasks/profiles are migrated in-place; v2 adds an `events` collection.

## Storage

v2.0 still uses browser `localStorage` as the live data store. Export/Import JSON remains available under Data & Profiles. The JSON structure now includes:

```json
{
  "version": 4,
  "profiles": [],
  "tasks": [],
  "events": []
}
```

A later storage refactor can make a user-selected local JSON file the source of truth and autosave to it.

## GitHub Pages

Upload the contents of this folder to the configured Pages branch/folder. No build step is required. `.nojekyll` tells GitHub Pages to serve the files directly.
