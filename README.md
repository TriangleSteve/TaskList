# Planner v2.2.0

A local-first personal planner for GitHub Pages. No build step and no backend are required.

## What is included

- Desktop-first Planner with persistent sidebar and right-side 7-day Schedule rail
- Profile-level separation using four simple line icons: Home, Work, Star, and Idea
- Priority, Next Up, Waiting On, Recurring, Completed, and Deleted task states
- Optional Focus bucket that removes focused tasks from their normal bucket while preserving their underlying status
- Drag/reorder tasks within and between active buckets, including Focus
- Drag events between Past Due, individual dates, and Upcoming while preserving event time
- Functional recurring tasks (daily, weekly, monthly): completing one writes a completed history record and advances the next occurrence
- Summary periods with previous/next navigation, copy-to-clipboard output, and compact three-column desktop cards
- Lightweight archive search inside Summary for completed/deleted tasks and completed/cancelled events
- Keyboard shortcuts: N = new task, E = new event, Esc = close menus/dialogs
- Browser-local automatic persistence plus JSON backup/restore
- Sidebar backup status and Export JSON reminder; Import JSON remains under Data & Profiles
- Backward-compatible normalization from previous v1/v2 data, including the former "Reocurring" spelling

## Storage

Planner automatically saves to browser localStorage. Export JSON periodically for a portable backup. The sidebar records when you last exported and becomes more noticeable as the backup gets older.

## GitHub Pages

Upload the contents of this folder to the branch/folder configured in **Settings → Pages**. `.nojekyll` tells GitHub Pages to serve the files directly.

Assets use `?v=2.2.0` cache-busting query strings so new releases are less likely to be hidden by stale browser caches.
