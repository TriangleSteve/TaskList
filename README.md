# Planner v2.1.1

A local-first task and event planner designed for GitHub Pages. The app is static HTML/CSS/JavaScript with no backend and no build step.

## What's new in v2.1.1

- Desktop-first layout with a persistent, slightly wider navigation sidebar.
- Removed duplicate branding/profile information from the sidebar and removed the All Tasks page.
- Planner remains a single-column task workspace with a schedule rail on desktop.
- Denser Summary layout with compact metrics and 3-4 accomplishment columns on larger screens.
- Event drag-and-drop between Past Due, Today, the next six days, and Upcoming.
  - Dropping into Past Due changes the event date to yesterday.
  - Dropping into Upcoming changes the event date to today + 7 days.
  - Event time is preserved when the event date changes.
- Events now store a separate date and time; there is no end date/time.
- Task added/completed values are now date-only.
- Existing v2.0 timestamp data is migrated automatically to date/time fields.
- Optional connected JSON file storage with automatic saving in supported browsers.
- Browser localStorage remains a fallback/cache and manual JSON import/export remains available.

## Connected data file

On Chromium-based desktop browsers that support the File System Access API (for example current Chrome or Edge), open **Data & Profiles → Storage** and choose one of:

- **Open Data File** — choose an existing Task Tracker JSON file. Its contents become the active data set.
- **Create Data File** — create a new JSON file from the current browser data.

Once connected, changes are saved to both the JSON file and browser storage. The app remembers the selected file handle using IndexedDB. Browser security may require you to click **Reconnect File** after reopening the browser.

A useful setup is to place `task-tracker.json` inside a locally synchronized OneDrive folder. The app writes the local file while the OneDrive desktop client handles cloud synchronization; the app itself does not need Microsoft credentials.

Avoid editing the same connected JSON file from two computers at the same time because this version does not attempt multi-device conflict merging.

## Data model

The JSON file uses schema version 5 and contains three top-level collections:

```json
{
  "version": 5,
  "profiles": [],
  "tasks": [],
  "events": []
}
```

Task dates (`dateAdded`, `dateCompleted`) use `YYYY-MM-DD` strings. Events use separate `date` (`YYYY-MM-DD`) and `time` (`HH:MM`) values.

## GitHub Pages deployment

1. Copy the files in this folder to the root of your GitHub repository.
2. Commit and push them.
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**, your normal branch (commonly `main`), and `/ (root)`.
5. Save.

`.nojekyll` tells GitHub Pages to serve the project as a plain static site.

## Files

- `index.html` — application markup and dialogs
- `styles.css` — responsive desktop-first styling
- `app.js` — task/event/profile logic, drag-and-drop, summary, import/export, and connected-file storage
- `favicon.svg` — checked-checkbox tab icon
- `.nojekyll` — disables Jekyll processing on GitHub Pages
