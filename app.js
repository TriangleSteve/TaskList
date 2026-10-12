(() => {
  'use strict';

  const STORAGE_KEY = 'local-task-tracker-v1';
  const PROFILE_KEY = 'local-task-tracker-profile-v1';
  const PROFILE_ICONS = ['💼','🏠','👤','⭐','❤️','📚','🎓','💪','🛒','💰','🛠️','💡','📅','🎯','🚗','✈️'];
  const STATUSES = ['Priority','Next Up','Waiting On','Reocurring','Completed','Deleted'];
  const ACTIVE_STATUSES = ['Priority','Next Up','Waiting On','Reocurring'];
  const SUMMARY_WINDOWS = { day:{label:'Day',days:1}, week:{label:'Week',days:7}, month:{label:'Month',days:30}, quarter:{label:'Quarter',days:91}, year:{label:'Year',days:365} };

  const state = { data: loadData(), currentProfile: null, currentView:'active', summaryWindow:'week', sortables:[] };
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const els = {
    profileSelect: $('#profileSelect'), sidebarProfileLabel: $('#sidebarProfileLabel'), newTaskBtn: $('#newTaskBtn'),
    menuBtn: $('#menuBtn'), closeNavBtn: $('#closeNavBtn'), appNav: $('#appNav'), navBackdrop: $('#navBackdrop'), tabs: $$('.tab-button'),
    activeView: $('#activeView'), summaryView: $('#summaryView'), allView: $('#allView'), settingsView: $('#settingsView'),
    taskDialog: $('#taskDialog'), taskForm: $('#taskForm'), taskDialogTitle: $('#taskDialogTitle'), taskId: $('#taskId'), description: $('#description'), notes: $('#notes'), status: $('#status'), tags: $('#tags'), dateAdded: $('#dateAdded'), dateCompleted: $('#dateCompleted'), advancedFields: $('.advanced-fields'), duplicateTaskBtn: $('#duplicateTaskBtn'), completeTaskBtn: $('#completeTaskBtn'), closeTaskDialog: $('#closeTaskDialog'),
    eventDialog: $('#eventDialog'), eventForm: $('#eventForm'), eventDialogTitle: $('#eventDialogTitle'), eventId: $('#eventId'), eventTitle: $('#eventTitle'), eventStart: $('#eventStart'), eventEnd: $('#eventEnd'), eventNotes: $('#eventNotes'), eventStatus: $('#eventStatus'), eventTags: $('#eventTags'), eventAdvanced: $('.event-advanced-fields'), completeEventBtn: $('#completeEventBtn'), closeEventDialog: $('#closeEventDialog'),
    profileDialog: $('#profileDialog'), closeProfileDialog: $('#closeProfileDialog'), profileList: $('#profileList'), addProfileForm: $('#addProfileForm'), newProfileName: $('#newProfileName'), newProfileIcon: $('#newProfileIcon'), importFile: $('#importFile')
  };

  init();

  function defaultData(){ return { version:4, profiles:[{name:'Work',icon:'💼'},{name:'Personal',icon:'🏠'}], tasks:[], events:[] }; }
  function loadData(){ const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return defaultData(); try { const p=JSON.parse(raw); return p&&typeof p==='object'?p:defaultData(); } catch { return defaultData(); } }
  function normalizeData(){
    if(!Array.isArray(state.data.profiles)||!state.data.profiles.length) state.data.profiles=defaultData().profiles;
    if(!Array.isArray(state.data.tasks)) state.data.tasks=[];
    if(!Array.isArray(state.data.events)) state.data.events=[];
    const seen=new Set();
    state.data.profiles=state.data.profiles.map((p,i)=>typeof p==='string'?{name:p.trim(),icon:i===0?'💼':i===1?'🏠':'👤'}:{name:String(p?.name||'').trim(),icon:PROFILE_ICONS.includes(p?.icon)?p.icon:'👤'}).filter(p=>p.name&&!seen.has(p.name.toLowerCase())&&seen.add(p.name.toLowerCase()));
    if(!state.data.profiles.length) state.data.profiles=defaultData().profiles;
    const counters={};
    state.data.tasks=state.data.tasks.map(t=>{
      const profile=t.profile||state.data.profiles[0].name; const status=STATUSES.includes(t.status)?t.status:'Next Up'; const key=`${profile}::${status}`; const order=Number.isFinite(t.order)?t.order:(counters[key]||0); counters[key]=order+1;
      return { id:t.id||uid('task'), description:String(t.description||''), notes:String(t.notes||''), status, profile, tags:Array.isArray(t.tags)?t.tags:splitTags(t.tags||''), dateAdded:t.dateAdded||new Date().toISOString(), dateCompleted:t.dateCompleted||'', order };
    });
    state.data.events=state.data.events.map(e=>({ id:e.id||uid('event'), profile:e.profile||state.data.profiles[0].name, title:String(e.title||e.description||''), start:e.start||e.date||new Date().toISOString(), end:e.end||'', notes:String(e.notes||''), tags:Array.isArray(e.tags)?e.tags:splitTags(e.tags||''), status:['Scheduled','Completed','Cancelled'].includes(e.status)?e.status:'Scheduled', completedAt:e.completedAt||'' }));
    state.data.version=4; saveData();
  }
  function saveData(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state.data)); }
  function getInitialProfile(){ const saved=localStorage.getItem(PROFILE_KEY); return state.data.profiles.some(p=>p.name===saved)?saved:state.data.profiles[0].name; }
  function init(){ normalizeData(); state.currentProfile=getInitialProfile(); populateStaticControls(); bindEvents(); render(); }
  function populateStaticControls(){
    els.status.innerHTML=STATUSES.map(s=>`<option>${s}</option>`).join('');
    els.newProfileIcon.innerHTML=PROFILE_ICONS.map(i=>`<option value="${i}">${i}</option>`).join('');
  }
  function bindEvents(){
    els.profileSelect.addEventListener('change',()=>{ state.currentProfile=els.profileSelect.value; localStorage.setItem(PROFILE_KEY,state.currentProfile); render(); });
    els.newTaskBtn.addEventListener('click',()=>openTaskDialog());
    els.menuBtn.addEventListener('click',openNav); els.closeNavBtn.addEventListener('click',closeNav); els.navBackdrop.addEventListener('click',closeNav);
    els.tabs.forEach(b=>b.addEventListener('click',()=>{ state.currentView=b.dataset.view; closeNav(); render(); }));
    els.closeTaskDialog.addEventListener('click',()=>els.taskDialog.close()); els.taskForm.addEventListener('submit',saveTaskFromForm); els.duplicateTaskBtn.addEventListener('click',duplicateTask); els.completeTaskBtn.addEventListener('click',completeTaskFromForm);
    els.closeEventDialog.addEventListener('click',()=>els.eventDialog.close()); els.eventForm.addEventListener('submit',saveEventFromForm); els.completeEventBtn.addEventListener('click',completeEventFromForm);
    els.closeProfileDialog.addEventListener('click',()=>els.profileDialog.close()); els.addProfileForm.addEventListener('submit',addProfile);
    window.addEventListener('resize',()=>{ if(innerWidth>=980) closeNav(); });
  }
  function openNav(){ if(innerWidth>=980) return; els.appNav.classList.add('open'); els.navBackdrop.classList.remove('hidden'); els.menuBtn.setAttribute('aria-expanded','true'); }
  function closeNav(){ els.appNav.classList.remove('open'); els.navBackdrop.classList.add('hidden'); els.menuBtn.setAttribute('aria-expanded','false'); }
  function render(){ renderProfileControls(); els.tabs.forEach(b=>b.classList.toggle('active',b.dataset.view===state.currentView)); ['active','summary','all','settings'].forEach(v=>els[`${v}View`].classList.toggle('hidden',v!==state.currentView)); if(state.currentView==='active') renderActive(); if(state.currentView==='summary') renderSummary(); if(state.currentView==='all') renderAll(); if(state.currentView==='settings') renderSettings(); }
  function renderProfileControls(){ els.profileSelect.innerHTML=state.data.profiles.map(p=>`<option value="${escAttr(p.name)}" ${p.name===state.currentProfile?'selected':''}>${p.icon}</option>`).join(''); const p=state.data.profiles.find(p=>p.name===state.currentProfile); els.sidebarProfileLabel.textContent=p?`${p.icon} ${p.name}`:state.currentProfile; }

  function renderActive(){
    destroySortables();
    const groups=ACTIVE_STATUSES.map(status=>{ const tasks=currentTasks().filter(t=>t.status===status).sort((a,b)=>a.order-b.order); return {status,tasks}; });
    const schedule=renderScheduleRail();
    els.activeView.innerHTML=`<div class="workspace-grid"><div class="task-workspace"><div class="section-heading"><h2>Tasks</h2></div><div class="active-groups">${groups.map(g=>renderTaskGroup(g.status,g.tasks)).join('')}</div></div>${schedule}</div>`;
    els.activeView.querySelectorAll('[data-task-id]').forEach(card=>card.addEventListener('click',e=>{ if(e.target.closest('.drag-handle')) return; openTaskDialog(card.dataset.taskId); }));
    els.activeView.querySelector('#newEventBtn')?.addEventListener('click',()=>openEventDialog());
    els.activeView.querySelectorAll('[data-event-id]').forEach(card=>card.addEventListener('click',()=>openEventDialog(card.dataset.eventId)));
    initSortables();
  }
  function renderTaskGroup(status,tasks){
    const hidden=tasks.length===0?' empty-group':'';
    return `<section class="task-group${hidden}" data-status-section="${escAttr(status)}"><div class="task-group-header"><h3>${status}</h3><span class="count-badge">${tasks.length}</span></div><div class="task-list" data-sortable-status="${escAttr(status)}">${tasks.map(renderTaskCard).join('')}<div class="empty-drop-hint">Drop here</div></div></section>`;
  }
  function renderTaskCard(task){
    const extras=(task.tags?.length||task.notes);
    return `<article class="task-card ${statusClass(task.status)} ${extras?'has-extras':'description-only'}" data-task-id="${task.id}"><button class="drag-handle" type="button" aria-label="Drag to reorder">⋮⋮</button><span class="status-strip"></span><div class="task-card-body"><h4 class="task-title">${escapeHtml(task.description)}</h4>${task.tags?.length?`<div class="tags">${task.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`:''}${task.notes?`<div class="task-notes">${escapeHtml(task.notes)}</div>`:''}</div><span class="task-open">›</span></article>`;
  }
  function renderScheduleRail(){
    const events=currentEvents().filter(e=>e.status==='Scheduled').sort((a,b)=>new Date(a.start)-new Date(b.start)); const now=new Date(); const today=startOfDay(now); const buckets=[];
    buckets.push({label:'Past Due', cls:'past-due', events:events.filter(e=>new Date(e.start)<now)});
    for(let i=0;i<7;i++){ const d=addDays(today,i); const next=addDays(d,1); const label=i===0?'Today':i===1?'Tomorrow':d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); buckets.push({label,events:events.filter(e=>{const x=new Date(e.start); return x>=d&&x<next&&x>=now;})}); }
    const horizon=addDays(today,7); buckets.push({label:'Upcoming',events:events.filter(e=>new Date(e.start)>=horizon)});
    return `<aside class="schedule-rail"><div class="section-heading schedule-heading"><h2>Schedule</h2><button id="newEventBtn" class="mini-add" aria-label="New event" title="New event">+</button></div><div class="schedule-buckets">${buckets.map(b=>`<section class="schedule-bucket ${b.cls||''}"><h3>${b.label}</h3>${b.events.length?b.events.map(renderEventCard).join(''):'<div class="schedule-empty">—</div>'}</section>`).join('')}</div></aside>`;
  }
  function renderEventCard(e){ const d=new Date(e.start); return `<article class="event-card" data-event-id="${e.id}"><div class="event-time">${d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</div><div><strong>${escapeHtml(e.title)}</strong>${e.notes?`<div class="event-note-preview">${escapeHtml(e.notes)}</div>`:''}</div></article>`; }

  function renderSummary(){
    const windowDef=SUMMARY_WINDOWS[state.summaryWindow]; const since=new Date(Date.now()-windowDef.days*86400000);
    const tasks=currentTasks().filter(t=>t.status==='Completed'&&t.dateCompleted&&new Date(t.dateCompleted)>=since).sort((a,b)=>new Date(b.dateCompleted)-new Date(a.dateCompleted));
    const events=currentEvents().filter(e=>e.status==='Completed'&&e.completedAt&&new Date(e.completedAt)>=since).sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
    const combined=[...tasks.map(t=>({type:'task',date:t.dateCompleted,item:t})),...events.map(e=>({type:'event',date:e.completedAt,item:e}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
    els.summaryView.innerHTML=`<div class="summary-toolbar"><h2>Summary</h2><div class="segmented">${Object.entries(SUMMARY_WINDOWS).map(([k,v])=>`<button data-summary-window="${k}" class="${k===state.summaryWindow?'active':''}">${v.label}</button>`).join('')}</div></div><div class="summary-grid"><article class="metric-card"><span class="muted small">Completed tasks</span><strong>${tasks.length}</strong></article><article class="metric-card"><span class="muted small">Completed events</span><strong>${events.length}</strong></article><article class="metric-card"><span class="muted small">Total accomplishments</span><strong>${combined.length}</strong></article></div><div class="summary-list">${combined.length?combined.map(renderSummaryItem).join(''):'<div class="empty-state">Nothing completed in this period yet.</div>'}</div>`;
    els.summaryView.querySelectorAll('[data-summary-window]').forEach(b=>b.addEventListener('click',()=>{state.summaryWindow=b.dataset.summaryWindow; renderSummary();}));
    els.summaryView.querySelectorAll('[data-summary-task]').forEach(x=>x.addEventListener('click',()=>openTaskDialog(x.dataset.summaryTask)));
    els.summaryView.querySelectorAll('[data-summary-event]').forEach(x=>x.addEventListener('click',()=>openEventDialog(x.dataset.summaryEvent)));
  }
  function renderSummaryItem(x){
    if(x.type==='task'){ const t=x.item; return `<article class="summary-item" data-summary-task="${t.id}"><div class="summary-item-head"><span class="type-pill">Task</span><time>${formatDateTime(t.dateCompleted)}</time></div><h3>${escapeHtml(t.description)}</h3>${t.notes?`<div class="summary-notes">${escapeHtml(t.notes)}</div>`:''}</article>`; }
    const e=x.item; return `<article class="summary-item" data-summary-event="${e.id}"><div class="summary-item-head"><span class="type-pill event">Event</span><time>${formatDateTime(e.completedAt)}</time></div><h3>${escapeHtml(e.title)}</h3><div class="muted small">Scheduled ${formatDateTime(e.start)}</div>${e.notes?`<div class="summary-notes">${escapeHtml(e.notes)}</div>`:''}</article>`;
  }

  function renderAll(){
    const tasks=currentTasks().sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded));
    els.allView.innerHTML=`<div class="toolbar"><h2>All Tasks</h2><div class="toolbar-group"><input id="taskSearch" type="search" placeholder="Search tasks"/><select id="taskStatusFilter"><option value="">All statuses</option>${STATUSES.map(s=>`<option>${s}</option>`).join('')}</select></div></div><div id="allTasksTable"></div>`;
    const paint=()=>{ const q=$('#taskSearch').value.toLowerCase(); const status=$('#taskStatusFilter').value; const filtered=tasks.filter(t=>(!status||t.status===status)&&(`${t.description} ${t.notes} ${(t.tags||[]).join(' ')}`).toLowerCase().includes(q)); $('#allTasksTable').innerHTML=`<div class="table-wrap"><table class="task-table"><thead><tr><th>Description</th><th>Status</th><th>Added</th><th>Completed</th></tr></thead><tbody>${filtered.map(t=>`<tr data-all-task="${t.id}"><td>${escapeHtml(t.description)}</td><td><span class="status-pill ${slug(t.status)}">${t.status}</span></td><td>${formatDate(t.dateAdded)}</td><td>${t.dateCompleted?formatDate(t.dateCompleted):''}</td></tr>`).join('')}</tbody></table></div>`; $('#allTasksTable').querySelectorAll('[data-all-task]').forEach(r=>r.addEventListener('click',()=>openTaskDialog(r.dataset.allTask))); };
    $('#taskSearch').addEventListener('input',paint); $('#taskStatusFilter').addEventListener('change',paint); paint();
  }

  function renderSettings(){
    els.settingsView.innerHTML=`<div class="toolbar"><h2>Data & Profiles</h2></div><div class="data-grid"><article class="data-card"><h3>Profiles</h3><p class="muted">Profiles keep work and personal data separated throughout the app.</p><button id="manageProfilesBtn">Manage Profiles</button></article><article class="data-card"><h3>Backup</h3><p class="muted">Export or restore the complete data file, including tasks, profiles, and events.</p><div class="button-row"><button id="exportBtn">Export JSON</button><button id="importBtn" class="secondary">Import JSON</button></div></article><article class="data-card"><h3>Storage</h3><p class="muted">Version 2.0 continues to store data in this browser. Connected local-file autosave is planned for the next storage refactor.</p></article><article class="data-card"><h3>Data</h3><p><strong>${state.data.tasks.length}</strong> tasks · <strong>${state.data.events.length}</strong> events · <strong>${state.data.profiles.length}</strong> profiles</p></article></div>`;
    $('#manageProfilesBtn').addEventListener('click',openProfiles); $('#exportBtn').addEventListener('click',exportJson); $('#importBtn').addEventListener('click',()=>els.importFile.click()); els.importFile.onchange=importJson;
  }

  function openTaskDialog(id=''){
    const task=id?state.data.tasks.find(t=>t.id===id):null; els.taskForm.reset(); els.advancedFields.open=false; els.taskId.value=task?.id||''; els.taskDialogTitle.textContent=task?'Details':'New'; els.description.value=task?.description||''; els.notes.value=task?.notes||''; els.status.value=task?.status||'Next Up'; els.tags.value=(task?.tags||[]).join(', '); els.dateAdded.value=toLocalInput(task?.dateAdded||new Date().toISOString()); els.dateCompleted.value=toLocalInput(task?.dateCompleted||''); els.duplicateTaskBtn.hidden=!task; els.completeTaskBtn.hidden=!task||task.status==='Completed'; els.taskDialog.showModal(); if(!task) requestAnimationFrame(()=>els.description.focus()); else requestAnimationFrame(()=>els.taskDialogTitle.focus());
  }
  function saveTaskFromForm(e){ e.preventDefault(); const id=els.taskId.value; const existing=state.data.tasks.find(t=>t.id===id); const status=els.status.value; const payload={ description:els.description.value.trim(), notes:els.notes.value.trim(), status, profile:existing?.profile||state.currentProfile, tags:splitTags(els.tags.value), dateAdded:fromLocalInput(els.dateAdded.value)||existing?.dateAdded||new Date().toISOString(), dateCompleted:fromLocalInput(els.dateCompleted.value)||existing?.dateCompleted||'', order:existing?.order??nextOrder(state.currentProfile,status) }; if(status==='Completed'&&!payload.dateCompleted) payload.dateCompleted=new Date().toISOString(); if(status!=='Completed') payload.dateCompleted=''; if(existing) Object.assign(existing,payload); else state.data.tasks.push({id:uid('task'),...payload}); normalizeOrders(payload.profile,payload.status); saveData(); els.taskDialog.close(); render(); }
  function completeTaskFromForm(){ els.status.value='Completed'; els.dateCompleted.value=toLocalInput(new Date().toISOString()); els.taskForm.requestSubmit(); }
  function duplicateTask(){ const t=state.data.tasks.find(t=>t.id===els.taskId.value); if(!t) return; state.data.tasks.push({...t,id:uid('task'),description:`${t.description} (copy)`,status:'Next Up',dateAdded:new Date().toISOString(),dateCompleted:'',order:nextOrder(t.profile,'Next Up')}); saveData(); els.taskDialog.close(); render(); }

  function openEventDialog(id=''){
    const ev=id?state.data.events.find(e=>e.id===id):null; els.eventForm.reset(); els.eventAdvanced.open=false; els.eventId.value=ev?.id||''; els.eventDialogTitle.textContent=ev?'Event':'New Event'; els.eventTitle.value=ev?.title||''; const start=ev?.start||roundToNextHalfHour(new Date()).toISOString(); els.eventStart.value=toLocalInput(start); els.eventEnd.value=toLocalInput(ev?.end||''); els.eventNotes.value=ev?.notes||''; els.eventStatus.value=ev?.status||'Scheduled'; els.eventTags.value=(ev?.tags||[]).join(', '); els.completeEventBtn.hidden=!ev||ev.status==='Completed'||ev.status==='Cancelled'; els.eventDialog.showModal(); if(!ev) requestAnimationFrame(()=>els.eventTitle.focus()); else requestAnimationFrame(()=>els.eventDialogTitle.focus());
  }
  function saveEventFromForm(e){ e.preventDefault(); const id=els.eventId.value; const existing=state.data.events.find(x=>x.id===id); const status=els.eventStatus.value; const item={ title:els.eventTitle.value.trim(), profile:existing?.profile||state.currentProfile, start:fromLocalInput(els.eventStart.value), end:fromLocalInput(els.eventEnd.value)||'', notes:els.eventNotes.value.trim(), tags:splitTags(els.eventTags.value), status, completedAt:existing?.completedAt||'' }; if(status==='Completed'&&!item.completedAt) item.completedAt=new Date().toISOString(); if(status!=='Completed') item.completedAt=''; if(existing) Object.assign(existing,item); else state.data.events.push({id:uid('event'),...item}); saveData(); els.eventDialog.close(); render(); }
  function completeEventFromForm(){ els.eventStatus.value='Completed'; els.eventForm.requestSubmit(); }

  function initSortables(){ if(typeof Sortable==='undefined') return; const activeGroups=els.activeView.querySelector('.active-groups'); els.activeView.querySelectorAll('[data-sortable-status]').forEach(list=>{ const sortable=new Sortable(list,{group:'active-task-statuses',animation:160,handle:'.drag-handle',draggable:'.task-card',ghostClass:'drag-ghost',chosenClass:'drag-chosen',forceFallback:true,fallbackOnBody:true,fallbackTolerance:2,swapThreshold:.65,invertSwap:true,invertedSwapThreshold:.75,emptyInsertThreshold:28,onStart:()=>activeGroups?.classList.add('is-dragging'),onEnd:ev=>{activeGroups?.classList.remove('is-dragging'); const task=state.data.tasks.find(t=>t.id===ev.item.dataset.taskId); if(!task)return; task.status=ev.to.dataset.sortableStatus; if(task.status!=='Completed') task.dateCompleted=''; syncOrdersFromDom(); saveData(); renderActive();}}); state.sortables.push(sortable); }); }
  function syncOrdersFromDom(){ els.activeView.querySelectorAll('[data-sortable-status]').forEach(list=>[...list.querySelectorAll('.task-card')].forEach((card,i)=>{ const t=state.data.tasks.find(x=>x.id===card.dataset.taskId); if(t){t.status=list.dataset.sortableStatus;t.order=i;}})); }
  function destroySortables(){ state.sortables.forEach(s=>s.destroy()); state.sortables=[]; }

  function openProfiles(){ renderProfileList(); els.profileDialog.showModal(); }
  function renderProfileList(){ els.profileList.innerHTML=state.data.profiles.map(p=>`<div class="profile-row"><div class="profile-name"><span>${p.icon}</span><strong>${escapeHtml(p.name)}</strong></div><select data-profile-icon="${escAttr(p.name)}">${PROFILE_ICONS.map(i=>`<option value="${i}" ${i===p.icon?'selected':''}>${i}</option>`).join('')}</select><button class="secondary outline" data-delete-profile="${escAttr(p.name)}" ${state.data.profiles.length===1?'disabled':''}>Remove</button></div>`).join(''); els.profileList.querySelectorAll('[data-profile-icon]').forEach(s=>s.addEventListener('change',()=>{ const p=state.data.profiles.find(p=>p.name===s.dataset.profileIcon); p.icon=s.value; saveData(); renderProfileControls(); })); els.profileList.querySelectorAll('[data-delete-profile]').forEach(b=>b.addEventListener('click',()=>deleteProfile(b.dataset.deleteProfile))); }
  function addProfile(e){ e.preventDefault(); const name=els.newProfileName.value.trim(); if(!name||state.data.profiles.some(p=>p.name.toLowerCase()===name.toLowerCase())) return; state.data.profiles.push({name,icon:els.newProfileIcon.value}); saveData(); els.newProfileName.value=''; renderProfileList(); renderProfileControls(); }
  function deleteProfile(name){ if(state.data.profiles.length<=1) return; const replacement=state.data.profiles.find(p=>p.name!==name)?.name; state.data.tasks.forEach(t=>{if(t.profile===name)t.profile=replacement;}); state.data.events.forEach(e=>{if(e.profile===name)e.profile=replacement;}); state.data.profiles=state.data.profiles.filter(p=>p.name!==name); if(state.currentProfile===name) state.currentProfile=replacement; localStorage.setItem(PROFILE_KEY,state.currentProfile); saveData(); renderProfileList(); render(); }

  function exportJson(){ const blob=new Blob([JSON.stringify(state.data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`task-tracker-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  function importJson(e){ const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try{ const p=JSON.parse(reader.result); if(!p||typeof p!=='object')throw new Error(); state.data=p; normalizeData(); state.currentProfile=getInitialProfile(); render(); }catch{alert('That file does not look like a valid Task Tracker JSON backup.');} finally {els.importFile.value='';} }; reader.readAsText(file); }

  function currentTasks(){ return state.data.tasks.filter(t=>t.profile===state.currentProfile); }
  function currentEvents(){ return state.data.events.filter(e=>e.profile===state.currentProfile); }
  function nextOrder(profile,status){ return Math.max(-1,...state.data.tasks.filter(t=>t.profile===profile&&t.status===status).map(t=>Number(t.order)||0))+1; }
  function normalizeOrders(profile,status){ state.data.tasks.filter(t=>t.profile===profile&&t.status===status).sort((a,b)=>a.order-b.order).forEach((t,i)=>t.order=i); }
  function splitTags(v){ return String(v||'').split(',').map(x=>x.trim()).filter(Boolean); }
  function uid(prefix){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function statusClass(s){ return `status-${slug(s)}`; }
  function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function escapeHtml(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escAttr(v){ return escapeHtml(v); }
  function toLocalInput(iso){ if(!iso)return''; const d=new Date(iso); if(isNaN(d))return''; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
  function fromLocalInput(v){ return v?new Date(v).toISOString():''; }
  function formatDate(v){ return v?new Date(v).toLocaleDateString():''; }
  function formatDateTime(v){ return v?new Date(v).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):''; }
  function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function roundToNextHalfHour(d){ const x=new Date(d); x.setSeconds(0,0); const mins=x.getMinutes(); x.setMinutes(mins<30?30:60); return x; }
})();
