const DB_NAME = "task-tracker";
const DB_VERSION = 1;
const TASK_STORE = "tasks";
const EVENT_STORE = "events";

const STATUS_ORDER = ["Priority", "Next Up", "Waiting On", "Recurring"];
const STATUS_ALL = [...STATUS_ORDER, "Completed", "Scrapped"];

let db;
let currentView = "current";
let editingTaskId = null;
let settings = {
  githubOwner: "",
  githubRepo: "",
  githubPath: "data/tasks.json",
  githubToken: ""
};

const $ = (id) => document.getElementById(id);
const app = $("app");

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TASK_STORE)) {
        const store = database.createObjectStore(TASK_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("status", "status");
        store.createIndex("dateCompleted", "dateCompleted");
      }
      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        const store = database.createObjectStore(EVENT_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("taskId", "taskId");
        store.createIndex("timestamp", "timestamp");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}
function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getAllTasks() { return requestPromise(tx(TASK_STORE).getAll()); }
async function getTask(id) { return requestPromise(tx(TASK_STORE).get(Number(id))); }
async function putTask(task) { return requestPromise(tx(TASK_STORE, "readwrite").put(task)); }
async function deleteTask(id) { return requestPromise(tx(TASK_STORE, "readwrite").delete(Number(id))); }
async function addEvent(event) { return requestPromise(tx(EVENT_STORE, "readwrite").add(event)); }
async function getAllEvents() { return requestPromise(tx(EVENT_STORE).getAll()); }

function saveSettings() {
  localStorage.setItem("taskTrackerSettings", JSON.stringify(settings));
}
function loadSettings() {
  try {
    settings = { ...settings, ...JSON.parse(localStorage.getItem("taskTrackerSettings") || "{}") };
  } catch {}
}
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function dateOnly(value) {
  return value ? new Date(value + "T00:00:00") : null;
}
function fmtDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric", year:"numeric" }).format(dateOnly(value));
}
function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function statusSort(a, b) {
  return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
}
function taskMeta(task) {
  const bits = [];
  if (task.category) bits.push(`<span class="pill">${esc(task.category)}</span>`);
  if (task.subcategory) bits.push(`<span class="pill">${esc(task.subcategory)}</span>`);
  if (task.dueDate) {
    const overdue = task.status !== "Completed" && task.status !== "Scrapped" && task.dueDate < todayISO();
    bits.push(`<span class="${overdue ? "overdue" : ""}">Due ${fmtDate(task.dueDate)}</span>`);
  }
  if (task.waitingOn) bits.push(`<span>Waiting on ${esc(task.waitingOn)}</span>`);
  return bits.join("");
}
function taskCard(task, showComplete = true) {
  return `<button class="task-card" data-task-id="${task.id}">
    ${showComplete && !["Completed","Scrapped"].includes(task.status)
      ? `<span class="complete-btn" data-complete-id="${task.id}">✓</span>` : ""}
    <div class="task-title">${esc(task.description)}</div>
    <div class="task-meta">${taskMeta(task)}</div>
  </button>`;
}

async function render() {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === currentView));
  if (currentView === "current") await renderCurrent();
  if (currentView === "recent") await renderRecent();
  if (currentView === "history") await renderHistory();
  if (currentView === "settings") renderSettings();
}

async function renderCurrent() {
  const tasks = (await getAllTasks()).filter(t => STATUS_ORDER.includes(t.status)).sort((a,b) => statusSort(a,b));
  let html = `<div class="view-header"><div><h2>Current Work</h2><div class="muted">${tasks.length} outstanding task${tasks.length === 1 ? "" : "s"}</div></div></div>`;
  for (const status of STATUS_ORDER) {
    const group = tasks.filter(t => t.status === status);
    if (!group.length) continue;
    html += `<section class="task-group"><h3>${status} <small>${group.length}</small></h3><div class="task-list">${group.map(t => taskCard(t)).join("")}</div></section>`;
  }
  if (!tasks.length) html += `<div class="empty">No outstanding tasks.</div>`;
  app.innerHTML = html;
}

async function renderRecent() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const tasks = (await getAllTasks())
    .filter(t => t.status === "Completed" && t.dateCompleted && dateOnly(t.dateCompleted) >= cutoff)
    .sort((a,b) => b.dateCompleted.localeCompare(a.dateCompleted));
  app.innerHTML = `<div class="view-header"><div><h2>Recent Wins</h2><div class="muted">Completed in the last 14 days</div></div></div>
    ${tasks.length ? `<div class="task-list">${tasks.map(t => `<button class="task-card" data-task-id="${t.id}">
      <div class="task-title">✓ ${esc(t.description)}</div>
      <div class="task-meta"><span>${fmtDate(t.dateCompleted)}</span>${taskMeta(t)}</div>
      ${t.notes ? `<div class="history-notes">${esc(t.notes)}</div>` : ""}
    </button>`).join("")}</div>` : `<div class="empty">Nothing completed in the last 14 days.</div>`}`;
}

async function renderHistory() {
  const tasks = (await getAllTasks())
    .filter(t => ["Completed","Scrapped"].includes(t.status) && t.dateCompleted)
    .sort((a,b) => b.dateCompleted.localeCompare(a.dateCompleted));
  const groups = {};
  for (const task of tasks) {
    const key = task.dateCompleted.slice(0,7);
    (groups[key] ||= []).push(task);
  }
  let html = `<div class="view-header"><div><h2>History</h2><div class="muted">${tasks.length} completed/scrapped task${tasks.length === 1 ? "" : "s"}</div></div></div>`;
  for (const [month, items] of Object.entries(groups)) {
    const label = new Intl.DateTimeFormat(undefined, {month:"long", year:"numeric"}).format(dateOnly(month + "-01"));
    html += `<section class="history-month"><h3>${label}</h3>`;
    for (const task of items) {
      html += `<button class="task-card history-row" data-task-id="${task.id}">
        <div class="history-date">${fmtDate(task.dateCompleted)}</div>
        <div class="history-main"><div class="task-title">${task.status === "Completed" ? "✓" : "×"} ${esc(task.description)}</div>
        <div class="task-meta">${taskMeta(task)}</div>
        ${task.notes ? `<div class="history-notes">${esc(task.notes)}</div>` : ""}</div>
      </button>`;
    }
    html += `</section>`;
  }
  if (!tasks.length) html += `<div class="empty">No history yet.</div>`;
  app.innerHTML = html;
}

function renderSettings() {
  app.innerHTML = `<div class="view-header"><div><h2>Settings</h2><div class="muted">Local data and optional GitHub synchronization</div></div></div>
    <section class="settings-card">
      <h3>GitHub sync</h3>
      <p class="muted">The app stores tasks locally in IndexedDB. GitHub sync stores a JSON backup in a repository so another device can pull the same data.</p>
      <div class="notice">For this first version, use a fine-grained GitHub token limited to the single repository. The token is kept only in this browser's local storage and is never included in the repository.</div>
      <br>
      <label>Repository owner
        <input id="gh-owner" value="${esc(settings.githubOwner)}" placeholder="your-username">
      </label><br>
      <label>Repository name
        <input id="gh-repo" value="${esc(settings.githubRepo)}" placeholder="task-tracker">
      </label><br>
      <label>JSON path
        <input id="gh-path" value="${esc(settings.githubPath)}" placeholder="data/tasks.json">
      </label><br>
      <label>GitHub token
        <input id="gh-token" type="password" value="${esc(settings.githubToken)}" autocomplete="off">
      </label>
      <div class="form-actions">
        <button id="save-gh" class="primary">Save settings</button><span></span>
        <button id="pull-gh" class="secondary">Pull from GitHub</button>
        <button id="push-gh" class="primary">Push to GitHub</button>
      </div>
      <p id="gh-message" class="muted"></p>
    </section>
    <section class="settings-card">
      <h3>Backup</h3>
      <div class="inline">
        <button id="export-json" class="secondary">Export JSON</button>
        <label class="secondary" style="display:inline-block;cursor:pointer">Import JSON
          <input id="import-json" type="file" accept=".json" hidden>
        </label>
      </div>
    </section>`;
  $("save-gh").onclick = () => {
    settings.githubOwner = $("gh-owner").value.trim();
    settings.githubRepo = $("gh-repo").value.trim();
    settings.githubPath = $("gh-path").value.trim() || "data/tasks.json";
    settings.githubToken = $("gh-token").value.trim();
    saveSettings();
    $("gh-message").textContent = "Settings saved.";
  };
  $("push-gh").onclick = pushToGitHub;
  $("pull-gh").onclick = pullFromGitHub;
  $("export-json").onclick = exportJSON;
  $("import-json").onchange = importJSON;
}

async function openTaskDialog(id = null) {
  editingTaskId = id;
  const task = id ? await getTask(id) : null;
  $("dialog-title").textContent = task ? `Task #${task.id}` : "New Task";
  $("task-id").value = task?.id || "";
  $("description").value = task?.description || "";
  $("status").value = task?.status || "Next Up";
  $("category").value = task?.category || "";
  $("subcategory").value = task?.subcategory || "";
  $("due-date").value = task?.dueDate || "";
  $("waiting-on").value = task?.waitingOn || "";
  $("parent-task").value = task?.parentTaskId || "";
  $("notes").value = task?.notes || "";
  $("delete-task-btn").classList.toggle("hidden", !task);
  $("task-dialog").showModal();
}

async function saveTaskFromForm() {
  const oldTask = editingTaskId ? await getTask(editingTaskId) : null;
  const status = $("status").value;
  const now = new Date().toISOString();
  const task = {
    ...(oldTask || {}),
    id: oldTask?.id,
    description: $("description").value.trim(),
    status,
    category: $("category").value.trim(),
    subcategory: $("subcategory").value.trim(),
    dueDate: $("due-date").value || "",
    waitingOn: $("waiting-on").value.trim(),
    parentTaskId: $("parent-task").value ? Number($("parent-task").value) : null,
    notes: $("notes").value,
    dateAdded: oldTask?.dateAdded || todayISO(),
    dateCompleted: status === "Completed" ? (oldTask?.dateCompleted || todayISO()) : (status === "Scrapped" ? (oldTask?.dateCompleted || todayISO()) : ""),
    updatedAt: now
  };
  if (!task.description) return;
  const wasStatus = oldTask?.status;
  await putTask(task);
  await addEvent({ taskId: task.id, timestamp: now, eventType: oldTask ? (wasStatus === status ? "Updated" : `Status: ${status}`) : "Created", notes: task.notes || "" });
  $("task-dialog").close();
  await render();
}

async function completeTask(id) {
  const task = await getTask(id);
  if (!task) return;
  task.status = "Completed";
  task.dateCompleted = todayISO();
  task.updatedAt = new Date().toISOString();
  await putTask(task);
  await addEvent({ taskId:id, timestamp:new Date().toISOString(), eventType:"Completed", notes:task.notes || "" });
  await render();
}

async function deleteCurrentTask() {
  if (!editingTaskId || !confirm("Delete this task?")) return;
  await deleteTask(editingTaskId);
  await addEvent({ taskId:editingTaskId, timestamp:new Date().toISOString(), eventType:"Deleted", notes:"" });
  $("task-dialog").close();
  await render();
}

function exportJSON() {
  Promise.all([getAllTasks(), getAllEvents()]).then(([tasks, events]) => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), tasks, events };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tasks-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

async function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const payload = JSON.parse(await file.text());
  if (!Array.isArray(payload.tasks)) throw new Error("Invalid task backup.");
  if (!confirm(`Replace local tasks with ${payload.tasks.length} imported tasks?`)) return;
  const taskStore = tx(TASK_STORE, "readwrite");
  await requestPromise(taskStore.clear());
  for (const task of payload.tasks) await requestPromise(taskStore.put(task));
  if (Array.isArray(payload.events)) {
    const eventStore = tx(EVENT_STORE, "readwrite");
    await requestPromise(eventStore.clear());
    for (const item of payload.events) await requestPromise(eventStore.put(item));
  }
  await render();
}

function githubHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${settings.githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}
function requireGitHubSettings() {
  if (!settings.githubOwner || !settings.githubRepo || !settings.githubToken) {
    throw new Error("Save the GitHub owner, repository, and token in Settings first.");
  }
}
async function getGitHubFile() {
  requireGitHubSettings();
  const url = `https://api.github.com/repos/${encodeURIComponent(settings.githubOwner)}/${encodeURIComponent(settings.githubRepo)}/contents/${settings.githubPath.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 404) return { content: null, sha: null, url };
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  return { ...(await response.json()), url };
}
async function pushToGitHub() {
  const msg = $("gh-message");
  try {
    requireGitHubSettings();
    msg.textContent = "Preparing upload…";
    const tasks = await getAllTasks();
    const events = await getAllEvents();
    const payload = { version:1, exportedAt:new Date().toISOString(), tasks, events };
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
    const existing = await getGitHubFile();
    const body = {
      message: `Update task data ${todayISO()}`,
      content,
      ...(existing.sha ? { sha: existing.sha } : {})
    };
    const response = await fetch(existing.url, {
      method:"PUT", headers:{...githubHeaders(), "Content-Type":"application/json"}, body:JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`GitHub upload failed: ${response.status} ${await response.text()}`);
    msg.innerHTML = `<span class="success">Pushed ${tasks.length} tasks to GitHub.</span>`;
    updateSyncStatus("GitHub synced");
  } catch (e) { msg.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
}
async function pullFromGitHub() {
  const msg = $("gh-message");
  try {
    requireGitHubSettings();
    msg.textContent = "Downloading…";
    const file = await getGitHubFile();
    if (!file.content) throw new Error("The JSON file does not exist in that repository yet.");
    const payload = JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g, "")))));
    if (!Array.isArray(payload.tasks)) throw new Error("GitHub file does not contain a valid task backup.");
    if (!confirm(`Replace local data with ${payload.tasks.length} GitHub tasks?`)) return;
    const taskStore = tx(TASK_STORE, "readwrite");
    await requestPromise(taskStore.clear());
    for (const task of payload.tasks) await requestPromise(taskStore.put(task));
    const eventStore = tx(EVENT_STORE, "readwrite");
    await requestPromise(eventStore.clear());
    for (const item of (payload.events || [])) await requestPromise(eventStore.put(item));
    msg.innerHTML = `<span class="success">Pulled ${payload.tasks.length} tasks from GitHub.</span>`;
    updateSyncStatus("GitHub synced");
    await render();
  } catch (e) { msg.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
}
function updateSyncStatus(text) { $("sync-status").textContent = text; }

$("new-task-btn").onclick = () => openTaskDialog();
$("close-dialog").onclick = () => $("task-dialog").close();
$("cancel-btn").onclick = () => $("task-dialog").close();
$("delete-task-btn").onclick = deleteCurrentTask;
$("task-form").onsubmit = (e) => { e.preventDefault(); saveTaskFromForm(); };

document.addEventListener("click", async (e) => {
  const tab = e.target.closest(".tab");
  if (tab) { currentView = tab.dataset.view; await render(); return; }
  const complete = e.target.closest("[data-complete-id]");
  if (complete) { e.stopPropagation(); await completeTask(Number(complete.dataset.completeId)); return; }
  const card = e.target.closest("[data-task-id]");
  if (card) await openTaskDialog(Number(card.dataset.taskId));
});

window.addEventListener("load", async () => {
  loadSettings();
  db = await openDB();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(console.error);
  await render();
});
