(() => {
  'use strict';

  const STORAGE_KEY = 'local-task-tracker-v1';
  const PROFILE_KEY = 'local-task-tracker-profile-v1';
  const STATUSES = ['Priority', 'Next Up', 'Waiting On', 'Reocurring', 'Completed', 'Deleted'];
  const ACTIVE_STATUSES = ['Priority', 'Next Up', 'Waiting On', 'Reocurring'];
  const SUMMARY_WINDOWS = {
    day: { label: 'Day', days: 1 },
    week: { label: 'Week', days: 7 },
    month: { label: 'Month', days: 30 },
    quarter: { label: 'Quarter', days: 91 },
    year: { label: 'Year', days: 365 }
  };

  const state = {
    data: loadData(),
    currentProfile: null,
    currentView: 'active',
    summaryWindow: 'week',
    sortables: []
  };

  const els = {
    profileSelect: document.querySelector('#profileSelect'),
    newTaskBtn: document.querySelector('#newTaskBtn'),
    menuBtn: document.querySelector('#menuBtn'),
    closeNavBtn: document.querySelector('#closeNavBtn'),
    appNav: document.querySelector('#appNav'),
    navBackdrop: document.querySelector('#navBackdrop'),
    tabs: [...document.querySelectorAll('.tab-button')],
    activeView: document.querySelector('#activeView'),
    summaryView: document.querySelector('#summaryView'),
    allView: document.querySelector('#allView'),
    settingsView: document.querySelector('#settingsView'),
    taskDialog: document.querySelector('#taskDialog'),
    closeTaskDialog: document.querySelector('#closeTaskDialog'),
    taskForm: document.querySelector('#taskForm'),
    taskDialogTitle: document.querySelector('#taskDialogTitle'),
    taskMeta: document.querySelector('#taskMeta'),
    taskId: document.querySelector('#taskId'),
    description: document.querySelector('#description'),
    status: document.querySelector('#status'),
    tags: document.querySelector('#tags'),
    dateAdded: document.querySelector('#dateAdded'),
    dateCompleted: document.querySelector('#dateCompleted'),
    notes: document.querySelector('#notes'),
    duplicateTaskBtn: document.querySelector('#duplicateTaskBtn'),
    deleteTaskBtn: document.querySelector('#deleteTaskBtn'),
    profileDialog: document.querySelector('#profileDialog'),
    closeProfileDialog: document.querySelector('#closeProfileDialog'),
    profileList: document.querySelector('#profileList'),
    addProfileForm: document.querySelector('#addProfileForm'),
    newProfileName: document.querySelector('#newProfileName'),
    importFile: document.querySelector('#importFile')
  };

  init();

  function init() {
    normalizeData();
    state.currentProfile = getInitialProfile();
    populateStaticControls();
    bindEvents();
    render();
  }

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 2, profiles: ['Work', 'Personal'], tasks: [] };

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : { version: 2, profiles: ['Work', 'Personal'], tasks: [] };
    } catch {
      return { version: 2, profiles: ['Work', 'Personal'], tasks: [] };
    }
  }

  function normalizeData() {
    if (!Array.isArray(state.data.profiles) || !state.data.profiles.length) state.data.profiles = ['Work', 'Personal'];
    if (!Array.isArray(state.data.tasks)) state.data.tasks = [];

    state.data.version = 2;
    state.data.profiles = [...new Set(state.data.profiles.map(p => String(p).trim()).filter(Boolean))];

    const statusCounters = {};
    state.data.tasks = state.data.tasks.map(task => {
      const profile = task.profile || state.data.profiles[0];
      const status = STATUSES.includes(task.status) ? task.status : 'Next Up';
      const counterKey = `${profile}::${status}`;
      const fallbackOrder = statusCounters[counterKey] || 0;
      statusCounters[counterKey] = fallbackOrder + 1;

      return {
        id: task.id || crypto.randomUUID(),
        description: task.description || '',
        dateAdded: task.dateAdded || new Date().toISOString(),
        dateCompleted: task.dateCompleted || null,
        notes: task.notes || '',
        status,
        profile,
        tags: Array.isArray(task.tags) ? task.tags : [],
        order: Number.isFinite(Number(task.order)) ? Number(task.order) : fallbackOrder,
        createdAt: task.createdAt || task.dateAdded || new Date().toISOString(),
        updatedAt: task.updatedAt || task.dateAdded || new Date().toISOString()
      };
    });

    saveData();
  }

  function getInitialProfile() {
    const saved = localStorage.getItem(PROFILE_KEY);
    return state.data.profiles.includes(saved) ? saved : state.data.profiles[0];
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function saveProfileSelection() {
    localStorage.setItem(PROFILE_KEY, state.currentProfile);
  }

  function populateStaticControls() {
    els.status.innerHTML = STATUSES.map(status => `<option value="${escapeAttr(status)}">${escapeHtml(status)}</option>`).join('');
    populateProfileControls();
  }

  function populateProfileControls() {
    const options = state.data.profiles.map(profile => `<option value="${escapeAttr(profile)}">${escapeHtml(profile)}</option>`).join('');
    els.profileSelect.innerHTML = `${options}<option value="__manage__">Manage profiles…</option>`;
    els.profileSelect.value = state.currentProfile;
  }

  function bindEvents() {
    els.tabs.forEach(tab => tab.addEventListener('click', () => {
      switchView(tab.dataset.view);
      closeNav();
    }));

    els.newTaskBtn.addEventListener('click', () => openTaskDialog());
    els.closeTaskDialog.addEventListener('click', () => els.taskDialog.close());
    els.closeProfileDialog.addEventListener('click', () => els.profileDialog.close());
    els.menuBtn.addEventListener('click', openNav);
    els.closeNavBtn.addEventListener('click', closeNav);
    els.navBackdrop.addEventListener('click', closeNav);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && els.appNav.classList.contains('open')) closeNav();
    });

    els.profileSelect.addEventListener('change', () => {
      if (els.profileSelect.value === '__manage__') {
        els.profileSelect.value = state.currentProfile;
        renderProfileManager();
        els.profileDialog.showModal();
        return;
      }
      state.currentProfile = els.profileSelect.value;
      saveProfileSelection();
      render();
    });

    els.taskForm.addEventListener('submit', saveTaskFromForm);
    els.deleteTaskBtn.addEventListener('click', deleteOrTrashTask);
    els.duplicateTaskBtn.addEventListener('click', duplicateTask);
    els.status.addEventListener('change', syncCompletedDate);

    els.addProfileForm.addEventListener('submit', event => {
      event.preventDefault();
      const name = els.newProfileName.value.trim();
      if (!name) return;
      if (state.data.profiles.some(p => p.toLowerCase() === name.toLowerCase())) {
        alert('That profile already exists.');
        return;
      }
      state.data.profiles.push(name);
      saveData();
      els.newProfileName.value = '';
      populateProfileControls();
      renderProfileManager();
    });

    els.importFile.addEventListener('change', importJsonFile);
  }

  function openNav() {
    els.appNav.classList.add('open');
    els.navBackdrop.classList.remove('hidden');
    els.menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeNav() {
    els.appNav.classList.remove('open');
    els.navBackdrop.classList.add('hidden');
    els.menuBtn.setAttribute('aria-expanded', 'false');
  }

  function switchView(view) {
    state.currentView = view;
    els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    els.activeView.classList.toggle('hidden', view !== 'active');
    els.summaryView.classList.toggle('hidden', view !== 'summary');
    els.allView.classList.toggle('hidden', view !== 'all');
    els.settingsView.classList.toggle('hidden', view !== 'settings');
    renderCurrentView();
  }

  function render() {
    populateProfileControls();
    renderCurrentView();
  }

  function renderCurrentView() {
    destroySortables();
    if (state.currentView === 'active') renderActiveView();
    if (state.currentView === 'summary') renderSummaryView();
    if (state.currentView === 'all') renderAllView();
    if (state.currentView === 'settings') renderSettingsView();
  }

  function profileTasks() {
    return state.data.tasks.filter(task => task.profile === state.currentProfile);
  }

  function sortedStatusTasks(status) {
    return profileTasks()
      .filter(task => task.status === status)
      .sort((a, b) => (a.order - b.order) || (new Date(a.createdAt) - new Date(b.createdAt)));
  }

  function renderActiveView() {
    const groups = ACTIVE_STATUSES
      .map(status => ({ status, tasks: sortedStatusTasks(status) }))
      .filter(group => group.tasks.length);

    if (!groups.length) {
      els.activeView.innerHTML = emptyStateHtml('No active tasks in this profile.');
      return;
    }

    els.activeView.innerHTML = `<div class="active-groups">${groups.map(group => `
      <section class="task-group" data-status="${escapeAttr(group.status)}">
        <div class="task-group-header">
          <h2>${escapeHtml(group.status)}</h2>
          <span class="count-badge">${group.tasks.length}</span>
        </div>
        <div class="task-list" data-sortable-status="${escapeAttr(group.status)}">
          ${group.tasks.map(taskCardHtml).join('')}
        </div>
      </section>`).join('')}</div>`;

    bindTaskOpeners(els.activeView);
    initSortables();
  }

  function taskCardHtml(task) {
    const added = `Added ${formatDate(task.dateAdded)}`;
    return `
      <article class="task-card status-${slugify(task.status)}" data-task-id="${escapeAttr(task.id)}" tabindex="0">
        <button class="drag-handle" type="button" aria-label="Reorder ${escapeAttr(task.description)}" title="Drag to reorder">☰</button>
        <div class="status-strip" aria-hidden="true"></div>
        <div class="task-card-body" data-open-task="true">
          <h3 class="task-title">${escapeHtml(task.description)}</h3>
          <div class="task-meta"><span>${escapeHtml(added)}</span></div>
          ${task.tags.length ? `<div class="tags">${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </div>
        <button class="task-open" type="button" data-open-task="true" aria-label="Open task">›</button>
      </article>`;
  }

  function initSortables() {
    if (typeof Sortable === 'undefined') return;

    els.activeView.querySelectorAll('[data-sortable-status]').forEach(list => {
      const sortable = new Sortable(list, {
        animation: 150,
        handle: '.drag-handle',
        draggable: '.task-card',
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        forceFallback: true,
        fallbackTolerance: 3,
        onEnd: () => persistStatusOrder(list.dataset.sortableStatus, list)
      });
      state.sortables.push(sortable);
    });
  }

  function destroySortables() {
    state.sortables.forEach(sortable => sortable.destroy());
    state.sortables = [];
  }

  function persistStatusOrder(status, list) {
    const ids = [...list.querySelectorAll('.task-card')].map(card => card.dataset.taskId);
    ids.forEach((id, index) => {
      const task = state.data.tasks.find(item => item.id === id);
      if (task && task.profile === state.currentProfile && task.status === status) task.order = index;
    });
    saveData();
  }

  function renderSummaryView() {
    const config = SUMMARY_WINDOWS[state.summaryWindow];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.days);

    const completed = profileTasks()
      .filter(task => task.status === 'Completed' && task.dateCompleted && new Date(task.dateCompleted) >= cutoff)
      .sort((a, b) => new Date(b.dateCompleted) - new Date(a.dateCompleted));

    const noteCount = completed.filter(t => t.notes.trim()).length;
    const tags = new Set(completed.flatMap(t => t.tags));

    els.summaryView.innerHTML = `
      <div class="summary-toolbar">
        <h2>Completed Work</h2>
        <div class="segmented" aria-label="Summary range">
          ${Object.entries(SUMMARY_WINDOWS).map(([key, value]) => `<button data-window="${key}" class="${key === state.summaryWindow ? 'active' : ''}">${value.label}</button>`).join('')}
        </div>
      </div>

      <div class="summary-grid">
        <article class="metric-card"><span class="muted small">Completed</span><strong>${completed.length}</strong></article>
        <article class="metric-card"><span class="muted small">With notes</span><strong>${noteCount}</strong></article>
        <article class="metric-card"><span class="muted small">Tags touched</span><strong>${tags.size}</strong></article>
      </div>

      <div class="toolbar compact-toolbar">
        <div><strong>${config.label} summary</strong><div class="muted small">Since ${formatDate(cutoff.toISOString())}</div></div>
        <button id="copySummaryBtn" class="secondary outline">Copy Summary</button>
      </div>

      <div class="summary-list">
        ${completed.length ? completed.map(summaryItemHtml).join('') : emptyStateHtml('No completed tasks in this time range.')}
      </div>`;

    els.summaryView.querySelectorAll('[data-window]').forEach(button => {
      button.addEventListener('click', () => {
        state.summaryWindow = button.dataset.window;
        renderSummaryView();
      });
    });

    els.summaryView.querySelector('#copySummaryBtn').addEventListener('click', async event => {
      const button = event.currentTarget;
      const text = buildPlainTextSummary(completed, config.label);
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy Summary'; }, 1200);
    });

    bindTaskOpeners(els.summaryView);
  }

  function summaryItemHtml(task) {
    return `
      <article class="summary-item" data-task-id="${escapeAttr(task.id)}" tabindex="0">
        <h3>${escapeHtml(task.description)}</h3>
        <div class="task-meta"><span>Completed ${formatDateTime(task.dateCompleted)}</span></div>
        ${task.tags.length ? `<div class="tags">${task.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        ${task.notes ? `<div class="summary-notes">${escapeHtml(task.notes)}</div>` : ''}
      </article>`;
  }

  function buildPlainTextSummary(tasks, label) {
    const heading = `${state.currentProfile} - ${label} Summary`;
    if (!tasks.length) return `${heading}\n\nNo completed tasks in this time range.`;

    return [heading, '', ...tasks.map(task => {
      const meta = [formatDate(task.dateCompleted), task.tags.length ? task.tags.join(', ') : ''].filter(Boolean).join(' | ');
      return `- ${task.description}${meta ? ` (${meta})` : ''}${task.notes ? `\n  Notes: ${task.notes.replace(/\n/g, '\n  ')}` : ''}`;
    })].join('\n');
  }

  function renderAllView() {
    const tasks = profileTasks().slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    els.allView.innerHTML = `
      <div class="toolbar">
        <h2>All Tasks</h2>
        <div class="toolbar-group">
          <input id="taskSearch" type="search" placeholder="Search tasks" aria-label="Search tasks" />
          <select id="statusFilter" aria-label="Filter by status">
            <option value="">All statuses</option>
            ${STATUSES.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table class="task-table">
          <thead><tr><th>Status</th><th>Description</th><th>Tags</th><th>Added</th><th>Completed</th></tr></thead>
          <tbody id="allTasksBody"></tbody>
        </table>
      </div>`;

    const search = els.allView.querySelector('#taskSearch');
    const statusFilter = els.allView.querySelector('#statusFilter');
    const tbody = els.allView.querySelector('#allTasksBody');

    const renderRows = () => {
      const q = search.value.trim().toLowerCase();
      const status = statusFilter.value;
      const filtered = tasks.filter(task => {
        const haystack = [task.description, task.notes, ...task.tags].join(' ').toLowerCase();
        return (!q || haystack.includes(q)) && (!status || task.status === status);
      });

      tbody.innerHTML = filtered.length ? filtered.map(task => `
        <tr data-task-id="${escapeAttr(task.id)}" tabindex="0">
          <td><span class="status-pill ${slugify(task.status)}">${escapeHtml(task.status)}</span></td>
          <td>${escapeHtml(task.description)}</td>
          <td>${escapeHtml(task.tags.join(', '))}</td>
          <td>${formatDate(task.dateAdded)}</td>
          <td>${task.dateCompleted ? formatDate(task.dateCompleted) : ''}</td>
        </tr>`).join('') : `<tr><td colspan="5" class="muted">No matching tasks.</td></tr>`;
      bindTaskOpeners(tbody);
    };

    search.addEventListener('input', renderRows);
    statusFilter.addEventListener('change', renderRows);
    renderRows();
  }

  function renderSettingsView() {
    const currentCount = profileTasks().length;
    els.settingsView.innerHTML = `
      <div class="toolbar"><h2>Data & Profiles</h2></div>
      <div class="data-grid">
        <article class="data-card">
          <h3>Backup & Transfer</h3>
          <p class="muted small">Export all profiles and tasks to JSON, then import that file on another device or browser.</p>
          <button id="exportBtn">Export JSON</button>
          <button id="importBtn" class="secondary">Import JSON</button>
        </article>
        <article class="data-card">
          <h3>Profiles</h3>
          <p class="muted small"><strong>${escapeHtml(state.currentProfile)}</strong> currently has ${currentCount} task${currentCount === 1 ? '' : 's'}.</p>
          <button id="manageProfilesBtn" class="secondary">Manage Profiles</button>
        </article>
        <article class="data-card">
          <h3>Storage</h3>
          <p class="muted small">Data is stored with <code>localStorage</code>. Clearing this site's browser storage removes it unless you have a JSON backup.</p>
          <button id="clearDataBtn" class="outline secondary">Reset Local Data</button>
        </article>
        <article class="data-card">
          <h3>Dataset</h3>
          <p class="muted small">${state.data.tasks.length} total tasks across ${state.data.profiles.length} profile${state.data.profiles.length === 1 ? '' : 's'}.</p>
          <p class="muted small">Schema version ${state.data.version || 2}.</p>
        </article>
      </div>`;

    els.settingsView.querySelector('#exportBtn').addEventListener('click', exportJson);
    els.settingsView.querySelector('#importBtn').addEventListener('click', () => els.importFile.click());
    els.settingsView.querySelector('#manageProfilesBtn').addEventListener('click', () => {
      renderProfileManager();
      els.profileDialog.showModal();
    });
    els.settingsView.querySelector('#clearDataBtn').addEventListener('click', () => {
      if (!confirm('Reset all local task data? Export a backup first if you may want it later.')) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROFILE_KEY);
      state.data = { version: 2, profiles: ['Work', 'Personal'], tasks: [] };
      state.currentProfile = 'Work';
      saveData();
      populateProfileControls();
      render();
    });
  }

  function openTaskDialog(task = null) {
    const isNew = !task;
    const now = new Date().toISOString();
    const data = task || {
      id: '', description: '', status: 'Next Up', profile: state.currentProfile,
      tags: [], dateAdded: now, dateCompleted: null, notes: ''
    };

    els.taskDialogTitle.textContent = isNew ? 'New Task' : 'Task Details';
    els.taskMeta.textContent = isNew ? state.currentProfile : `ID ${data.id}`;
    els.taskId.value = data.id;
    els.description.value = data.description;
    els.status.value = data.status;
    els.tags.value = data.tags.join(', ');
    els.dateAdded.value = toLocalInputValue(data.dateAdded);
    els.dateCompleted.value = data.dateCompleted ? toLocalInputValue(data.dateCompleted) : '';
    els.notes.value = data.notes;
    els.duplicateTaskBtn.hidden = isNew;
    els.deleteTaskBtn.hidden = isNew;
    els.taskDialog.showModal();
    setTimeout(() => els.description.focus(), 20);
  }

  function saveTaskFromForm(event) {
    event.preventDefault();
    const id = els.taskId.value || crypto.randomUUID();
    const existing = state.data.tasks.find(t => t.id === id);
    const now = new Date().toISOString();
    const newStatus = els.status.value;
    const statusChanged = existing && existing.status !== newStatus;

    const task = {
      id,
      description: els.description.value.trim(),
      status: newStatus,
      profile: state.currentProfile,
      tags: parseTags(els.tags.value),
      dateAdded: fromLocalInputValue(els.dateAdded.value) || now,
      dateCompleted: fromLocalInputValue(els.dateCompleted.value),
      notes: els.notes.value.trim(),
      order: (!existing || statusChanged) ? nextOrderFor(newStatus, state.currentProfile) : existing.order,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    if (task.status === 'Completed' && !task.dateCompleted) task.dateCompleted = now;
    if (task.status !== 'Completed') task.dateCompleted = task.dateCompleted || null;

    if (existing) Object.assign(existing, task);
    else state.data.tasks.push(task);

    saveData();
    els.taskDialog.close();
    render();
  }

  function nextOrderFor(status, profile) {
    const values = state.data.tasks
      .filter(task => task.profile === profile && task.status === status)
      .map(task => Number(task.order) || 0);
    return values.length ? Math.max(...values) + 1 : 0;
  }

  function syncCompletedDate() {
    if (els.status.value === 'Completed' && !els.dateCompleted.value) {
      els.dateCompleted.value = toLocalInputValue(new Date().toISOString());
    }
  }

  function deleteOrTrashTask() {
    const task = state.data.tasks.find(t => t.id === els.taskId.value);
    if (!task) return;

    if (task.status !== 'Deleted') {
      if (!confirm('Move this task to Deleted?')) return;
      task.status = 'Deleted';
      task.order = nextOrderFor('Deleted', task.profile);
      task.updatedAt = new Date().toISOString();
    } else {
      if (!confirm('Permanently delete this task? This cannot be undone unless you restore from an exported JSON backup.')) return;
      state.data.tasks = state.data.tasks.filter(t => t.id !== task.id);
    }

    saveData();
    els.taskDialog.close();
    render();
  }

  function duplicateTask() {
    const task = state.data.tasks.find(t => t.id === els.taskId.value);
    if (!task) return;
    const now = new Date().toISOString();
    const status = task.status === 'Completed' || task.status === 'Deleted' ? 'Next Up' : task.status;
    const copy = {
      ...task,
      id: crypto.randomUUID(),
      description: `${task.description} (copy)`,
      status,
      profile: state.currentProfile,
      order: nextOrderFor(status, state.currentProfile),
      dateAdded: now,
      dateCompleted: null,
      createdAt: now,
      updatedAt: now
    };
    state.data.tasks.push(copy);
    saveData();
    openTaskDialog(copy);
    render();
  }

  function bindTaskOpeners(root) {
    root.querySelectorAll('[data-task-id]').forEach(el => {
      const open = event => {
        if (event?.target?.closest('.drag-handle')) return;
        const task = state.data.tasks.find(t => t.id === el.dataset.taskId);
        if (task) openTaskDialog(task);
      };

      el.querySelectorAll('[data-open-task="true"]').forEach(target => target.addEventListener('click', open));
      if (!el.querySelector('[data-open-task="true"]')) el.addEventListener('click', open);

      el.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.drag-handle')) {
          event.preventDefault();
          open(event);
        }
      });
    });
  }

  function renderProfileManager() {
    els.profileList.innerHTML = state.data.profiles.map(profile => {
      const count = state.data.tasks.filter(t => t.profile === profile).length;
      const canDelete = state.data.profiles.length > 1 && count === 0;
      return `
        <div class="profile-row">
          <div><strong>${escapeHtml(profile)}</strong><div class="muted small">${count} task${count === 1 ? '' : 's'}</div></div>
          <button class="secondary outline" data-delete-profile="${escapeAttr(profile)}" ${canDelete ? '' : 'disabled'}>Remove</button>
        </div>`;
    }).join('');

    els.profileList.querySelectorAll('[data-delete-profile]').forEach(button => {
      button.addEventListener('click', () => {
        const profile = button.dataset.deleteProfile;
        state.data.profiles = state.data.profiles.filter(p => p !== profile);
        if (state.currentProfile === profile) state.currentProfile = state.data.profiles[0];
        saveProfileSelection();
        saveData();
        populateProfileControls();
        renderProfileManager();
        render();
      });
    });
  }

  function exportJson() {
    const payload = { ...state.data, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importJsonFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.profiles)) throw new Error('Invalid backup structure');
      if (!confirm(`Import ${parsed.tasks.length} tasks across ${parsed.profiles.length} profiles? This will replace the data currently stored in this browser.`)) return;

      state.data = { version: parsed.version || 1, profiles: parsed.profiles, tasks: parsed.tasks };
      normalizeData();
      state.currentProfile = state.data.profiles.includes(state.currentProfile) ? state.currentProfile : state.data.profiles[0];
      saveProfileSelection();
      populateProfileControls();
      render();
    } catch (error) {
      alert(`Could not import that JSON file: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  function emptyStateHtml(message) {
    return `<div class="empty-state"><h2>Nothing here yet</h2><p class="muted">${escapeHtml(message)}</p></div>`;
  }

  function parseTags(value) {
    return [...new Set(value.split(',').map(tag => tag.trim()).filter(Boolean))];
  }

  function slugify(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
  }

  function formatDateTime(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  function toLocalInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function fromLocalInputValue(value) {
    if (!value) return null;
    return new Date(value).toISOString();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
