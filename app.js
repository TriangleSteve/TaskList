(() => {
  'use strict';

  const STORAGE_KEY = 'local-task-tracker-v1';
  const PROFILE_KEY = 'local-task-tracker-profile-v1';
  const HANDLE_DB = 'task-tracker-file-db';
  const HANDLE_STORE = 'handles';
  const HANDLE_KEY = 'data-file';
  const PROFILE_ICONS = ['💼','🏠','👤','⭐','❤️','📚','🎓','💪','🛒','💰','🛠️','💡','📅','🎯','🚗','✈️'];
  const STATUSES = ['Priority','Next Up','Waiting On','Reocurring','Completed','Deleted'];
  const ACTIVE_STATUSES = ['Priority','Next Up','Waiting On','Reocurring'];
  const SUMMARY_WINDOWS = { day:{label:'Day',days:1}, week:{label:'Week',days:7}, month:{label:'Month',days:30}, quarter:{label:'Quarter',days:91}, year:{label:'Year',days:365} };

  const state = {
    data: loadLocalData(), currentProfile: null, currentView:'active', summaryWindow:'week',
    sortables:[], fileHandle:null, fileStatus:'browser', fileName:'', fileWriteChain:Promise.resolve()
  };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const els = {
    profileSelect: $('#profileSelect'), newTaskBtn: $('#newTaskBtn'),
    menuBtn: $('#menuBtn'), closeNavBtn: $('#closeNavBtn'), appNav: $('#appNav'), navBackdrop: $('#navBackdrop'), tabs: $$('.tab-button'),
    activeView: $('#activeView'), summaryView: $('#summaryView'), settingsView: $('#settingsView'),
    taskDialog: $('#taskDialog'), taskForm: $('#taskForm'), taskDialogTitle: $('#taskDialogTitle'), taskId: $('#taskId'), description: $('#description'), notes: $('#notes'), status: $('#status'), tags: $('#tags'), dateAdded: $('#dateAdded'), dateCompleted: $('#dateCompleted'), advancedFields: $('.advanced-fields'), duplicateTaskBtn: $('#duplicateTaskBtn'), completeTaskBtn: $('#completeTaskBtn'), closeTaskDialog: $('#closeTaskDialog'),
    eventDialog: $('#eventDialog'), eventForm: $('#eventForm'), eventDialogTitle: $('#eventDialogTitle'), eventId: $('#eventId'), eventTitle: $('#eventTitle'), eventDate: $('#eventDate'), eventTime: $('#eventTime'), eventNotes: $('#eventNotes'), eventStatus: $('#eventStatus'), eventTags: $('#eventTags'), eventAdvanced: $('.event-advanced-fields'), completeEventBtn: $('#completeEventBtn'), closeEventDialog: $('#closeEventDialog'),
    profileDialog: $('#profileDialog'), closeProfileDialog: $('#closeProfileDialog'), profileList: $('#profileList'), addProfileForm: $('#addProfileForm'), newProfileName: $('#newProfileName'), newProfileIcon: $('#newProfileIcon'), importFile: $('#importFile')
  };

  init();

  async function init(){
    await restoreConnectedFile();
    normalizeData();
    state.currentProfile = getInitialProfile();
    populateStaticControls();
    bindEvents();
    render();
  }

  function defaultData(){ return { version:5, profiles:[{name:'Work',icon:'💼'},{name:'Personal',icon:'🏠'}], tasks:[], events:[] }; }
  function loadLocalData(){
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    try { const p=JSON.parse(raw); return p&&typeof p==='object'?p:defaultData(); } catch { return defaultData(); }
  }

  function normalizeData(){
    if(!Array.isArray(state.data.profiles)||!state.data.profiles.length) state.data.profiles=defaultData().profiles;
    if(!Array.isArray(state.data.tasks)) state.data.tasks=[];
    if(!Array.isArray(state.data.events)) state.data.events=[];

    const seen=new Set();
    state.data.profiles=state.data.profiles.map((p,i)=>typeof p==='string'
      ? {name:p.trim(),icon:i===0?'💼':i===1?'🏠':'👤'}
      : {name:String(p?.name||'').trim(),icon:PROFILE_ICONS.includes(p?.icon)?p.icon:'👤'})
      .filter(p=>p.name&&!seen.has(p.name.toLowerCase())&&seen.add(p.name.toLowerCase()));
    if(!state.data.profiles.length) state.data.profiles=defaultData().profiles;

    const counters={};
    state.data.tasks=state.data.tasks.map(t=>{
      const profile=t.profile||state.data.profiles[0].name;
      const status=STATUSES.includes(t.status)?t.status:'Next Up';
      const key=`${profile}::${status}`;
      const order=Number.isFinite(t.order)?t.order:(counters[key]||0);
      counters[key]=order+1;
      return {
        id:t.id||uid('task'), description:String(t.description||''), notes:String(t.notes||''), status, profile,
        tags:Array.isArray(t.tags)?t.tags:splitTags(t.tags||''),
        dateAdded:toDateOnly(t.dateAdded)||todayString(),
        dateCompleted:toDateOnly(t.dateCompleted)||'', order
      };
    });

    state.data.events=state.data.events.map(e=>{
      let date=toDateOnly(e.date);
      let time=normalizeTime(e.time);
      if(!date && e.start){ date=toDateOnly(e.start); if(!time) time=toTimeOnly(e.start); }
      return {
        id:e.id||uid('event'), profile:e.profile||state.data.profiles[0].name,
        title:String(e.title||e.description||''), date:date||todayString(), time:time||'',
        notes:String(e.notes||''), tags:Array.isArray(e.tags)?e.tags:splitTags(e.tags||''),
        status:['Scheduled','Completed','Cancelled'].includes(e.status)?e.status:'Scheduled',
        completedDate:toDateOnly(e.completedDate||e.completedAt)||''
      };
    });

    state.data.version=5;
    saveData();
  }

  function saveData(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state.data));
    queueFileWrite();
  }

  function getInitialProfile(){
    const saved=localStorage.getItem(PROFILE_KEY);
    return state.data.profiles.some(p=>p.name===saved)?saved:state.data.profiles[0].name;
  }

  function populateStaticControls(){
    els.status.innerHTML=STATUSES.map(s=>`<option>${s}</option>`).join('');
    els.newProfileIcon.innerHTML=PROFILE_ICONS.map(i=>`<option value="${i}">${i}</option>`).join('');
  }

  function bindEvents(){
    els.profileSelect.addEventListener('change',()=>{ state.currentProfile=els.profileSelect.value; localStorage.setItem(PROFILE_KEY,state.currentProfile); render(); });
    els.newTaskBtn.addEventListener('click',()=>openTaskDialog());
    els.menuBtn.addEventListener('click',openNav);
    els.closeNavBtn.addEventListener('click',closeNav);
    els.navBackdrop.addEventListener('click',closeNav);
    els.tabs.forEach(b=>b.addEventListener('click',()=>{ state.currentView=b.dataset.view; closeNav(); render(); }));
    els.closeTaskDialog.addEventListener('click',()=>els.taskDialog.close());
    els.taskForm.addEventListener('submit',saveTaskFromForm);
    els.duplicateTaskBtn.addEventListener('click',duplicateTask);
    els.completeTaskBtn.addEventListener('click',completeTaskFromForm);
    els.closeEventDialog.addEventListener('click',()=>els.eventDialog.close());
    els.eventForm.addEventListener('submit',saveEventFromForm);
    els.completeEventBtn.addEventListener('click',completeEventFromForm);
    els.closeProfileDialog.addEventListener('click',()=>els.profileDialog.close());
    els.addProfileForm.addEventListener('submit',addProfile);
    window.addEventListener('resize',()=>{ if(innerWidth>=980) closeNav(); });
  }

  function openNav(){ if(innerWidth>=980) return; els.appNav.classList.add('open'); els.navBackdrop.classList.remove('hidden'); els.menuBtn.setAttribute('aria-expanded','true'); }
  function closeNav(){ els.appNav.classList.remove('open'); els.navBackdrop.classList.add('hidden'); els.menuBtn.setAttribute('aria-expanded','false'); }

  function render(){
    renderProfileControls();
    els.tabs.forEach(b=>b.classList.toggle('active',b.dataset.view===state.currentView));
    ['active','summary','settings'].forEach(v=>els[`${v}View`].classList.toggle('hidden',v!==state.currentView));
    if(state.currentView==='active') renderActive();
    if(state.currentView==='summary') renderSummary();
    if(state.currentView==='settings') renderSettings();
  }

  function renderProfileControls(){
    els.profileSelect.innerHTML=state.data.profiles.map(p=>`<option value="${escAttr(p.name)}" ${p.name===state.currentProfile?'selected':''}>${p.icon}</option>`).join('');
  }

  function renderActive(){
    destroySortables();
    const groups=ACTIVE_STATUSES.map(status=>({status,tasks:currentTasks().filter(t=>t.status===status).sort((a,b)=>a.order-b.order)}));
    els.activeView.innerHTML=`<div class="workspace-grid"><div class="task-workspace"><div class="section-heading"><h2>Tasks</h2></div><div class="active-groups">${groups.map(g=>renderTaskGroup(g.status,g.tasks)).join('')}</div></div>${renderScheduleRail()}</div>`;
    els.activeView.querySelectorAll('[data-task-id]').forEach(card=>card.addEventListener('click',e=>{ if(e.target.closest('.drag-handle')) return; openTaskDialog(card.dataset.taskId); }));
    els.activeView.querySelector('#newEventBtn')?.addEventListener('click',()=>openEventDialog());
    els.activeView.querySelectorAll('[data-event-id]').forEach(card=>card.addEventListener('click',e=>{ if(e.target.closest('.event-drag-handle')) return; openEventDialog(card.dataset.eventId); }));
    initTaskSortables();
    initEventSortables();
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
    const events=currentEvents().filter(e=>e.status==='Scheduled').sort(compareEvents);
    const today=todayString();
    const buckets=[];
    buckets.push({label:'Past Due', cls:'past-due', date:addDaysString(today,-1), events:events.filter(e=>e.date<today)});
    for(let i=0;i<7;i++){
      const date=addDaysString(today,i);
      const label=i===0?'Today':i===1?'Tomorrow':parseDateOnly(date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
      buckets.push({label,date,events:events.filter(e=>e.date===date)});
    }
    const upcoming=addDaysString(today,7);
    buckets.push({label:'Upcoming',date:upcoming,events:events.filter(e=>e.date>=upcoming)});
    return `<aside class="schedule-rail"><div class="section-heading schedule-heading"><h2>Schedule</h2><button id="newEventBtn" class="mini-add" aria-label="New event" title="New event">+</button></div><div class="schedule-buckets">${buckets.map(b=>`<section class="schedule-bucket ${b.cls||''}"><h3>${b.label}</h3><div class="event-list" data-event-drop-date="${b.date}">${b.events.map(renderEventCard).join('')}${b.events.length?'':'<div class="schedule-empty">—</div>'}</div></section>`).join('')}</div></aside>`;
  }

  function renderEventCard(e){
    return `<article class="event-card" data-event-id="${e.id}"><button class="event-drag-handle" type="button" aria-label="Drag event">⋮⋮</button><div class="event-time">${formatTime(e.time)}</div><div><strong>${escapeHtml(e.title)}</strong>${e.notes?`<div class="event-note-preview">${escapeHtml(e.notes)}</div>`:''}</div></article>`;
  }

  function renderSummary(){
    const since=addDaysString(todayString(),-(SUMMARY_WINDOWS[state.summaryWindow].days-1));
    const tasks=currentTasks().filter(t=>t.status==='Completed'&&t.dateCompleted&&t.dateCompleted>=since).sort((a,b)=>b.dateCompleted.localeCompare(a.dateCompleted));
    const events=currentEvents().filter(e=>e.status==='Completed'&&e.date&&e.date>=since).sort((a,b)=>b.date.localeCompare(a.date)||compareEvents(a,b));
    const combined=[...tasks.map(t=>({type:'task',date:t.dateCompleted,item:t})),...events.map(e=>({type:'event',date:e.date,item:e}))].sort((a,b)=>b.date.localeCompare(a.date));
    els.summaryView.innerHTML=`<div class="summary-toolbar"><h2>Summary</h2><div class="segmented">${Object.entries(SUMMARY_WINDOWS).map(([k,v])=>`<button data-summary-window="${k}" class="${k===state.summaryWindow?'active':''}">${v.label}</button>`).join('')}</div></div><div class="summary-metrics"><div class="metric-chip"><strong>${tasks.length}</strong> tasks</div><div class="metric-chip"><strong>${events.length}</strong> events</div><div class="metric-chip"><strong>${combined.length}</strong> total</div></div><div class="summary-list">${combined.length?combined.map(renderSummaryItem).join(''):'<div class="empty-state">Nothing completed in this period yet.</div>'}</div>`;
    els.summaryView.querySelectorAll('[data-summary-window]').forEach(b=>b.addEventListener('click',()=>{state.summaryWindow=b.dataset.summaryWindow;renderSummary();}));
    els.summaryView.querySelectorAll('[data-summary-task]').forEach(x=>x.addEventListener('click',()=>openTaskDialog(x.dataset.summaryTask)));
    els.summaryView.querySelectorAll('[data-summary-event]').forEach(x=>x.addEventListener('click',()=>openEventDialog(x.dataset.summaryEvent)));
  }

  function renderSummaryItem(x){
    if(x.type==='task'){
      const t=x.item;
      return `<article class="summary-item" data-summary-task="${t.id}"><div class="summary-item-head"><span class="type-pill">Task</span><time>${formatDate(t.dateCompleted)}</time></div><h3>${escapeHtml(t.description)}</h3>${t.notes?`<div class="summary-notes">${escapeHtml(t.notes)}</div>`:''}</article>`;
    }
    const e=x.item;
    return `<article class="summary-item" data-summary-event="${e.id}"><div class="summary-item-head"><span class="type-pill event">Event</span><time>${formatDate(e.date)}</time></div><h3>${escapeHtml(e.title)}</h3>${e.time?`<div class="muted small">${formatTime(e.time)}</div>`:''}${e.notes?`<div class="summary-notes">${escapeHtml(e.notes)}</div>`:''}</article>`;
  }

  function renderSettings(){
    const supported='showOpenFilePicker' in window && 'showSaveFilePicker' in window;
    const connected=state.fileStatus==='connected';
    const needsPermission=state.fileStatus==='permission';
    const statusText=connected?`Connected to ${state.fileName}`:needsPermission?`Reconnect ${state.fileName||'data file'} to resume autosave`:state.fileStatus==='error'?'File connection error':'Using browser storage';
    const statusClass=connected?'connected':state.fileStatus==='error'?'error':'';
    els.settingsView.innerHTML=`<div class="toolbar"><h2>Data & Profiles</h2></div><div class="data-grid">
      <article class="data-card"><h3>Profiles</h3><p class="muted">Profiles keep work and personal data separated throughout the app.</p><button id="manageProfilesBtn">Manage Profiles</button></article>
      <article class="data-card"><h3>Storage</h3><p class="muted">Connect a JSON file to make it the primary saved copy. Browser storage remains as a local fallback cache.</p><div class="storage-status"><span class="storage-dot ${statusClass}"></span><span>${escapeHtml(statusText)}</span></div><div class="button-row">${supported?`${connected?'<button id="disconnectFileBtn" class="secondary">Disconnect File</button>':needsPermission?'<button id="reconnectFileBtn">Reconnect File</button>':'<button id="openDataFileBtn">Open Data File</button><button id="createDataFileBtn" class="secondary">Create Data File</button>'}`:'<span class="muted small">Persistent file access is not supported in this browser.</span>'}</div></article>
      <article class="data-card"><h3>Backup</h3><p class="muted">Manual export/import remains available regardless of storage mode.</p><div class="button-row"><button id="exportBtn">Export JSON</button><button id="importBtn" class="secondary">Import JSON</button></div></article>
      <article class="data-card"><h3>Data</h3><p><strong>${state.data.tasks.length}</strong> tasks · <strong>${state.data.events.length}</strong> events · <strong>${state.data.profiles.length}</strong> profiles</p><p class="muted small">Data schema v${state.data.version}</p></article>
    </div>`;
    $('#manageProfilesBtn').addEventListener('click',openProfiles);
    $('#exportBtn').addEventListener('click',exportJson);
    $('#importBtn').addEventListener('click',()=>els.importFile.click());
    els.importFile.onchange=importJson;
    $('#openDataFileBtn')?.addEventListener('click',openDataFile);
    $('#createDataFileBtn')?.addEventListener('click',createDataFile);
    $('#reconnectFileBtn')?.addEventListener('click',reconnectDataFile);
    $('#disconnectFileBtn')?.addEventListener('click',disconnectDataFile);
  }

  function openTaskDialog(id=''){
    const task=id?state.data.tasks.find(t=>t.id===id):null;
    els.taskForm.reset(); els.advancedFields.open=false; els.taskId.value=task?.id||'';
    els.taskDialogTitle.textContent=task?'Details':'New'; els.description.value=task?.description||''; els.notes.value=task?.notes||'';
    els.status.value=task?.status||'Next Up'; els.tags.value=(task?.tags||[]).join(', ');
    els.dateAdded.value=task?.dateAdded||todayString(); els.dateCompleted.value=task?.dateCompleted||'';
    els.duplicateTaskBtn.hidden=!task; els.completeTaskBtn.hidden=!task||task.status==='Completed';
    els.taskDialog.showModal();
    if(!task) requestAnimationFrame(()=>els.description.focus()); else requestAnimationFrame(()=>els.taskDialogTitle.focus());
  }

  function saveTaskFromForm(e){
    e.preventDefault();
    const id=els.taskId.value; const existing=state.data.tasks.find(t=>t.id===id); const status=els.status.value;
    const payload={ description:els.description.value.trim(), notes:els.notes.value.trim(), status, profile:existing?.profile||state.currentProfile, tags:splitTags(els.tags.value), dateAdded:els.dateAdded.value||existing?.dateAdded||todayString(), dateCompleted:els.dateCompleted.value||existing?.dateCompleted||'', order:existing?.order??nextOrder(state.currentProfile,status) };
    if(status==='Completed'&&!payload.dateCompleted) payload.dateCompleted=todayString();
    if(status!=='Completed') payload.dateCompleted='';
    if(existing) Object.assign(existing,payload); else state.data.tasks.push({id:uid('task'),...payload});
    normalizeOrders(payload.profile,payload.status); saveData(); els.taskDialog.close(); render();
  }

  function completeTaskFromForm(){ els.status.value='Completed'; els.dateCompleted.value=todayString(); els.taskForm.requestSubmit(); }
  function duplicateTask(){
    const t=state.data.tasks.find(t=>t.id===els.taskId.value); if(!t) return;
    state.data.tasks.push({...t,id:uid('task'),description:`${t.description} (copy)`,status:'Next Up',dateAdded:todayString(),dateCompleted:'',order:nextOrder(t.profile,'Next Up')});
    saveData(); els.taskDialog.close(); render();
  }

  function openEventDialog(id=''){
    const ev=id?state.data.events.find(e=>e.id===id):null;
    els.eventForm.reset(); els.eventAdvanced.open=false; els.eventId.value=ev?.id||'';
    els.eventDialogTitle.textContent=ev?'Event':'New Event'; els.eventTitle.value=ev?.title||'';
    els.eventDate.value=ev?.date||todayString(); els.eventTime.value=ev?.time||roundTimeToHalfHour();
    els.eventNotes.value=ev?.notes||''; els.eventStatus.value=ev?.status||'Scheduled'; els.eventTags.value=(ev?.tags||[]).join(', ');
    els.completeEventBtn.hidden=!ev||ev.status==='Completed'||ev.status==='Cancelled';
    els.eventDialog.showModal();
    if(!ev) requestAnimationFrame(()=>els.eventTitle.focus()); else requestAnimationFrame(()=>els.eventDialogTitle.focus());
  }

  function saveEventFromForm(e){
    e.preventDefault();
    const id=els.eventId.value; const existing=state.data.events.find(x=>x.id===id); const status=els.eventStatus.value;
    const item={ title:els.eventTitle.value.trim(), profile:existing?.profile||state.currentProfile, date:els.eventDate.value||todayString(), time:els.eventTime.value||'', notes:els.eventNotes.value.trim(), tags:splitTags(els.eventTags.value), status, completedDate:existing?.completedDate||'' };
    if(status==='Completed'&&!item.completedDate) item.completedDate=todayString();
    if(status!=='Completed') item.completedDate='';
    if(existing) Object.assign(existing,item); else state.data.events.push({id:uid('event'),...item});
    saveData(); els.eventDialog.close(); render();
  }

  function completeEventFromForm(){ els.eventStatus.value='Completed'; els.eventForm.requestSubmit(); }

  function initTaskSortables(){
    if(typeof Sortable==='undefined') return;
    const activeGroups=els.activeView.querySelector('.active-groups');
    els.activeView.querySelectorAll('[data-sortable-status]').forEach(list=>{
      const sortable=new Sortable(list,{group:'active-task-statuses',animation:160,handle:'.drag-handle',draggable:'.task-card',ghostClass:'drag-ghost',chosenClass:'drag-chosen',forceFallback:true,fallbackOnBody:true,fallbackTolerance:2,swapThreshold:.65,invertSwap:true,invertedSwapThreshold:.75,emptyInsertThreshold:28,onStart:()=>activeGroups?.classList.add('is-dragging'),onEnd:ev=>{
        activeGroups?.classList.remove('is-dragging');
        const task=state.data.tasks.find(t=>t.id===ev.item.dataset.taskId); if(!task)return;
        task.status=ev.to.dataset.sortableStatus; if(task.status!=='Completed') task.dateCompleted='';
        syncTaskOrdersFromDom(); saveData(); renderActive();
      }});
      state.sortables.push(sortable);
    });
  }

  function initEventSortables(){
    if(typeof Sortable==='undefined') return;
    els.activeView.querySelectorAll('[data-event-drop-date]').forEach(list=>{
      const sortable=new Sortable(list,{group:'schedule-events',animation:150,handle:'.event-drag-handle',draggable:'.event-card',ghostClass:'event-drag-ghost',chosenClass:'event-drag-chosen',forceFallback:true,fallbackOnBody:true,fallbackTolerance:2,emptyInsertThreshold:24,onEnd:ev=>{
        const event=state.data.events.find(x=>x.id===ev.item.dataset.eventId); if(!event)return;
        event.date=ev.to.dataset.eventDropDate; saveData(); renderActive();
      }});
      state.sortables.push(sortable);
    });
  }

  function syncTaskOrdersFromDom(){
    els.activeView.querySelectorAll('[data-sortable-status]').forEach(list=>[...list.querySelectorAll('.task-card')].forEach((card,i)=>{
      const t=state.data.tasks.find(x=>x.id===card.dataset.taskId); if(t){t.status=list.dataset.sortableStatus;t.order=i;}
    }));
  }
  function destroySortables(){ state.sortables.forEach(s=>s.destroy()); state.sortables=[]; }

  function openProfiles(){ renderProfileList(); els.profileDialog.showModal(); }
  function renderProfileList(){
    els.profileList.innerHTML=state.data.profiles.map(p=>`<div class="profile-row"><div class="profile-name"><span>${p.icon}</span><strong>${escapeHtml(p.name)}</strong></div><select data-profile-icon="${escAttr(p.name)}">${PROFILE_ICONS.map(i=>`<option value="${i}" ${i===p.icon?'selected':''}>${i}</option>`).join('')}</select><button class="secondary outline" data-delete-profile="${escAttr(p.name)}" ${state.data.profiles.length===1?'disabled':''}>Remove</button></div>`).join('');
    els.profileList.querySelectorAll('[data-profile-icon]').forEach(s=>s.addEventListener('change',()=>{ const p=state.data.profiles.find(p=>p.name===s.dataset.profileIcon); p.icon=s.value; saveData(); renderProfileControls(); }));
    els.profileList.querySelectorAll('[data-delete-profile]').forEach(b=>b.addEventListener('click',()=>deleteProfile(b.dataset.deleteProfile)));
  }
  function addProfile(e){ e.preventDefault(); const name=els.newProfileName.value.trim(); if(!name||state.data.profiles.some(p=>p.name.toLowerCase()===name.toLowerCase())) return; state.data.profiles.push({name,icon:els.newProfileIcon.value}); saveData(); els.newProfileName.value=''; renderProfileList(); renderProfileControls(); }
  function deleteProfile(name){
    if(state.data.profiles.length<=1) return;
    const replacement=state.data.profiles.find(p=>p.name!==name)?.name;
    state.data.tasks.forEach(t=>{if(t.profile===name)t.profile=replacement;}); state.data.events.forEach(e=>{if(e.profile===name)e.profile=replacement;});
    state.data.profiles=state.data.profiles.filter(p=>p.name!==name); if(state.currentProfile===name) state.currentProfile=replacement;
    localStorage.setItem(PROFILE_KEY,state.currentProfile); saveData(); renderProfileList(); render();
  }

  function exportJson(){
    const blob=new Blob([JSON.stringify(state.data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`task-tracker-${todayString()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  function importJson(e){
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader(); reader.onload=()=>{ try{ const p=JSON.parse(reader.result); if(!p||typeof p!=='object')throw new Error(); state.data=p; normalizeData(); state.currentProfile=getInitialProfile(); render(); }catch{alert('That file does not look like a valid Task Tracker JSON backup.');} finally {els.importFile.value='';} }; reader.readAsText(file);
  }

  async function openDataFile(){
    try{
      const [handle]=await window.showOpenFilePicker({types:[{description:'Task Tracker JSON',accept:{'application/json':['.json']}}],multiple:false});
      const data=await readDataFile(handle);
      state.fileHandle=handle; state.fileName=handle.name; state.fileStatus='connected'; await idbSetHandle(handle);
      state.data=data; normalizeData(); state.currentProfile=getInitialProfile(); render();
    }catch(err){ if(err?.name!=='AbortError'){state.fileStatus='error';renderSettings();} }
  }

  async function createDataFile(){
    try{
      const handle=await window.showSaveFilePicker({suggestedName:'task-tracker.json',types:[{description:'Task Tracker JSON',accept:{'application/json':['.json']}}]});
      state.fileHandle=handle; state.fileName=handle.name; state.fileStatus='connected'; await idbSetHandle(handle); await writeDataFile(handle,state.data); renderSettings();
    }catch(err){ if(err?.name!=='AbortError'){state.fileStatus='error';renderSettings();} }
  }

  async function reconnectDataFile(){
    if(!state.fileHandle) return;
    try{
      const permission=await state.fileHandle.requestPermission({mode:'readwrite'});
      if(permission!=='granted') return;
      const data=await readDataFile(state.fileHandle); state.data=data; state.fileStatus='connected'; normalizeData(); state.currentProfile=getInitialProfile(); render();
    }catch{ state.fileStatus='error'; renderSettings(); }
  }

  async function disconnectDataFile(){
    state.fileHandle=null; state.fileName=''; state.fileStatus='browser'; await idbDeleteHandle(); renderSettings();
  }

  async function restoreConnectedFile(){
    if(!('indexedDB' in window)) return;
    try{
      const handle=await idbGetHandle(); if(!handle) return;
      state.fileHandle=handle; state.fileName=handle.name||'task-tracker.json';
      const permission=await handle.queryPermission({mode:'readwrite'});
      if(permission==='granted'){
        state.data=await readDataFile(handle); state.fileStatus='connected'; localStorage.setItem(STORAGE_KEY,JSON.stringify(state.data));
      }else state.fileStatus='permission';
    }catch{ state.fileStatus='error'; }
  }

  function queueFileWrite(){
    if(!state.fileHandle||state.fileStatus!=='connected') return;
    const snapshot=JSON.parse(JSON.stringify(state.data));
    state.fileWriteChain=state.fileWriteChain.then(()=>writeDataFile(state.fileHandle,snapshot)).catch(()=>{ state.fileStatus='error'; if(state.currentView==='settings') renderSettings(); });
  }

  async function readDataFile(handle){
    const file=await handle.getFile(); const text=await file.text(); const data=JSON.parse(text); if(!data||typeof data!=='object') throw new Error('Invalid data file'); return data;
  }
  async function writeDataFile(handle,data){ const writable=await handle.createWritable(); await writable.write(JSON.stringify(data,null,2)); await writable.close(); }

  function openHandleDb(){
    return new Promise((resolve,reject)=>{ const req=indexedDB.open(HANDLE_DB,1); req.onupgradeneeded=()=>req.result.createObjectStore(HANDLE_STORE); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  }
  async function idbGetHandle(){ const db=await openHandleDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(HANDLE_STORE,'readonly'); const req=tx.objectStore(HANDLE_STORE).get(HANDLE_KEY); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error); tx.oncomplete=()=>db.close(); }); }
  async function idbSetHandle(handle){ const db=await openHandleDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(HANDLE_STORE,'readwrite'); tx.objectStore(HANDLE_STORE).put(handle,HANDLE_KEY); tx.oncomplete=()=>{db.close();resolve();}; tx.onerror=()=>reject(tx.error); }); }
  async function idbDeleteHandle(){ const db=await openHandleDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(HANDLE_STORE,'readwrite'); tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY); tx.oncomplete=()=>{db.close();resolve();}; tx.onerror=()=>reject(tx.error); }); }

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
  function todayString(){ return localDateString(new Date()); }
  function localDateString(d){ const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
  function toDateOnly(v){ if(!v)return''; if(/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v); const d=new Date(v); return isNaN(d)?'':localDateString(d); }
  function toTimeOnly(v){ if(!v)return''; const d=new Date(v); if(isNaN(d))return''; const p=n=>String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
  function normalizeTime(v){ const m=String(v||'').match(/^(\d{1,2}):(\d{2})/); return m?`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`:''; }
  function parseDateOnly(v){ const [y,m,d]=String(v).split('-').map(Number); return new Date(y,m-1,d); }
  function addDaysString(v,n){ const d=parseDateOnly(v); d.setDate(d.getDate()+n); return localDateString(d); }
  function formatDate(v){ return v?parseDateOnly(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''; }
  function formatTime(v){ if(!v)return'Any time'; const [h,m]=v.split(':').map(Number); const d=new Date(); d.setHours(h,m,0,0); return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); }
  function roundTimeToHalfHour(){ const d=new Date(); d.setSeconds(0,0); const m=d.getMinutes(); d.setMinutes(m<30?30:60); const p=n=>String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
  function compareEvents(a,b){ return a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99')||a.title.localeCompare(b.title); }
})();
