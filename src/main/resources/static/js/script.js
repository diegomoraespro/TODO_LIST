// Gerenciador de Tarefas - script.js
// funcionalidades: CRUD, filtros, busca, ordenação, drag-and-drop, persistência, export/import, limpar concluídas

(() => {
  const STORAGE_KEY = 'tasks_v1';

  // DOM
  const taskListEl = document.getElementById('tasks');
  const form = document.getElementById('taskForm');
  const titleInput = document.getElementById('title');
  const descInput = document.getElementById('description');
  const dueDateInput = document.getElementById('dueDate');
  const priorityInput = document.getElementById('priority');
  const tagsInput = document.getElementById('tags');
  const addBtn = document.getElementById('addBtn');
  const updateBtn = document.getElementById('updateBtn');
  const cancelEdit = document.getElementById('cancelEdit');
  const filterEl = document.getElementById('filter');
  const sortEl = document.getElementById('sort');
  const searchEl = document.getElementById('search');
  const clearCompletedBtn = document.getElementById('clearCompleted');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');
  const countActive = document.getElementById('countActive');
  const countCompleted = document.getElementById('countCompleted');

  let tasks = [];
  let editingId = null;
  let dragSrcId = null;

  // util
  const uid = () => Math.random().toString(36).slice(2, 9);
  const nowISO = () => new Date().toISOString();

  // API helpers
  async function apiFetch(path, opts) {
    try {
      const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(res.status + ' ' + res.statusText + (text ? (': ' + text) : ''));
      }
      return res;
    } catch (err) {
      throw err;
    }
  }

  function mapServerToTask(s) {
    return {
      id: s.id != null ? String(s.id) : uid(),
      title: s.title || '',
      description: s.description || '',
      dueDate: s.dueDate || null,
      priority: s.priority ? String(s.priority).toLowerCase() : 'medium',
      tags: Array.isArray(s.tags) ? s.tags : [],
      completed: !!s.completed,
      createdAt: s.createdAt || nowISO(),
      orderIndex: s.orderIndex || 0
    };
  }

  function mapTaskToServer(t) {
    return {
      id: t.id && !isNaN(Number(t.id)) ? Number(t.id) : undefined,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate || null,
      // server expects enum strings like 'LOW', 'MEDIUM', 'HIGH'
      priority: (t.priority || 'medium').toUpperCase(),
      tags: t.tags || [],
      completed: !!t.completed,
      createdAt: t.createdAt,
      orderIndex: t.orderIndex || 0
    };
  }

  // local cache save (still useful as fallback)
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  const loadLocal = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  // render
  function render() {
    // apply search/filter/sort
    const q = (searchEl.value || '').trim().toLowerCase();
    const filter = filterEl.value;
    const sortBy = sortEl.value;

    // take a snapshot so we can preserve original order within same priority
    let list = tasks.slice().map((t, idx) => (Object.assign({}, t, { __origIdx: idx })));

    if (q) list = list.filter(t => (t.title + ' ' + (t.description||'') + ' ' + (t.tags||[]).join(' ')).toLowerCase().includes(q));
    if (filter === 'active') list = list.filter(t => !t.completed);
    if (filter === 'completed') list = list.filter(t => t.completed);

    // Always sort primarily by priority: high -> medium -> low
    const priorityMap = { high: 0, medium: 1, low: 2 };

    list.sort((a, b) => {
      const pa = priorityMap[(a.priority || 'medium').toLowerCase()] ?? 3;
      const pb = priorityMap[(b.priority || 'medium').toLowerCase()] ?? 3;
      if (pa !== pb) return pa - pb; // primary: priority

      // secondary: apply user's sort choice within same priority
      if (sortBy === 'createdAt') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'dueDate') return (a.dueDate || '').localeCompare(b.dueDate || '');
      if (sortBy === 'priority') return 0; // already sorted by priority

      // default / 'order' -> preserve original order or use orderIndex when present
      const aOrder = (typeof a.orderIndex === 'number') ? a.orderIndex : a.__origIdx;
      const bOrder = (typeof b.orderIndex === 'number') ? b.orderIndex : b.__origIdx;
      return aOrder - bOrder;
    });

    // drop internal marker before rendering
    list = list.map(({ __origIdx, ...rest }) => rest);

    taskListEl.innerHTML = '';
    list.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.draggable = true;
      li.dataset.id = task.id;
      if (task.completed) li.classList.add('complete');
      const overdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
      if (overdue) li.classList.add('overdue');

      li.innerHTML = `
        <div class="drag-handle" title="arrastar">☰</div>
        <div class="task-main">
          <h3 class="task-title">${escapeHtml(task.title)}</h3>
          <div class="task-meta small">
            ${task.description ? `<span>${escapeHtml(task.description)}</span>` : ''}
            ${task.dueDate ? `<span>• Vence: ${task.dueDate}</span>` : ''}
            <span class="badge ${task.priority}">${capitalize(task.priority)}</span>
            ${task.tags && task.tags.length ? task.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('') : ''}
          </div>
        </div>
        <div class="task-actions-inline">
          <button class="btn-ghost toggle-complete" title="Marcar concluída">${task.completed? '🔁' : '✔'}</button>
          <button class="btn-ghost edit" title="Editar">✎</button>
          <button class="btn-ghost delete" title="Excluir">🗑</button>
        </div>
      `;

      // events
      li.querySelector('.toggle-complete').addEventListener('click', ()=>{
        toggleComplete(task.id);
      });
      li.querySelector('.edit').addEventListener('click', ()=>{
        startEdit(task.id);
      });
      li.querySelector('.delete').addEventListener('click', ()=>{
        deleteTask(task.id);
      });

      // drag events
      li.addEventListener('dragstart', (e)=>{
        dragSrcId = task.id;
        e.dataTransfer.effectAllowed = 'move';
        li.style.opacity = '0.6';
      });
      li.addEventListener('dragend', ()=>{ li.style.opacity = ''; dragSrcId = null; save(); });
      li.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      li.addEventListener('drop', (e)=>{
        e.preventDefault();
        const dstId = task.id;
        if (!dragSrcId || dragSrcId === dstId) return;
        reorder(dragSrcId, dstId);
      });

      taskListEl.appendChild(li);
    });

    updateCounts();
    save();
  }

  function updateCounts(){
    const active = tasks.filter(t=>!t.completed).length;
    const completed = tasks.filter(t=>t.completed).length;
    countActive.textContent = active;
    countCompleted.textContent = completed;
  }

  // CRUD - synchronized with server with local fallback
  async function createTask(data){
    // Try to save on server
    try {
      const serverObj = mapTaskToServer(data);
      const res = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(serverObj) });
      const saved = await res.json();
      const task = mapServerToTask(saved);
      tasks.push(task);
      render();
      return task;
    } catch (err) {
      // fallback to local
      console.warn('API create failed, falling back to localStorage:', err.message);
      const task = Object.assign({ id: uid(), title: '', description: '', dueDate: null, priority: 'medium', tags: [], completed: false, createdAt: nowISO() }, data);
      tasks.push(task);
      render();
      return task;
    }
  }

  function startEdit(id){
    const t = tasks.find(x=>String(x.id)===String(id)); if(!t) return;
    editingId = String(id);
    titleInput.value = t.title;
    descInput.value = t.description || '';
    dueDateInput.value = t.dueDate || '';
    priorityInput.value = t.priority || 'medium';
    tagsInput.value = (t.tags||[]).join(',');
    addBtn.classList.add('hidden');
    updateBtn.classList.remove('hidden');
    cancelEdit.classList.remove('hidden');
  }

  async function updateTask(id, patch){
    // find by string comparison to be robust
    const i = tasks.findIndex(t=>String(t.id)===String(id)); if(i<0) return;
    const updatedLocal = Object.assign({}, tasks[i], patch);
    // Determine numeric id for server
    const numericId = Number(tasks[i].id);
    const canUseServer = Number.isFinite(numericId);
    // Try server update only when we have a valid numeric id
    if (canUseServer) {
      try {
        const serverObj = mapTaskToServer(updatedLocal);
        await apiFetch('/api/tasks/' + numericId, { method: 'PUT', body: JSON.stringify(serverObj) });
        tasks[i] = updatedLocal;
        render();
        return;
      } catch (err) {
        console.warn('API update failed, updating locally:', err.message);
        tasks[i] = updatedLocal;
        render();
        return;
      }
    } else {
      // No numeric id (local-only task) -> update locally
      tasks[i] = updatedLocal;
      render();
      return;
    }
  }

  async function deleteTask(id){
    if(!confirm('Excluir essa tarefa?')) return;
    const idx = tasks.findIndex(t=>t.id===id); if(idx<0) return;
    const t = tasks[idx];
    // Try server delete
    try {
      const numericId = isNaN(Number(t.id)) ? t.id : Number(t.id);
      await apiFetch('/api/tasks/' + numericId, { method: 'DELETE' });
      tasks.splice(idx,1);
      render();
    } catch (err) {
      console.warn('API delete failed, deleting locally:', err.message);
      tasks.splice(idx,1);
      render();
    }
  }

  async function toggleComplete(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    const newVal = !t.completed;
    await updateTask(id, { completed: newVal });
  }

  async function reorder(srcId, dstId){
    const srcIdx = tasks.findIndex(t=>t.id===srcId);
    const dstIdx = tasks.findIndex(t=>t.id===dstId);
    if(srcIdx<0||dstIdx<0) return;
    const [item] = tasks.splice(srcIdx,1);
    tasks.splice(dstIdx,0,item);
    // update orderIndex and try to persist changed ordering to server
    tasks.forEach((t, idx) => { t.orderIndex = idx; });
    // attempt to persist changed items (best-effort)
    try {
      await Promise.all(tasks.map(t => {
        const obj = mapTaskToServer(t);
        if (obj.id) return apiFetch('/api/tasks/' + obj.id, { method: 'PUT', body: JSON.stringify(obj) });
        return Promise.resolve();
      }));
    } catch (err) {
      console.warn('Failed to persist new order to server:', err.message);
    }
    render();
  }

  // actions
  clearCompletedBtn.addEventListener('click', async ()=>{
    if(!confirm('Remover todas as tarefas concluídas?')) return;
    // Try server-side delete all completed
    try {
      await apiFetch('/api/tasks', { method: 'DELETE' });
      tasks = tasks.filter(t=>!t.completed);
      render();
    } catch (err) {
      console.warn('API clear completed failed, clearing locally:', err.message);
      tasks = tasks.filter(t=>!t.completed);
      render();
    }
  });

  exportBtn.addEventListener('click', ()=>{
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tasks.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  importFile.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!Array.isArray(data)) throw new Error('Formato inválido');
      // merge with current tasks (keep ids or assign new)
      for (const item of data){
        if(!item.id) item.id = uid();
        item.tags = (item.tags && Array.isArray(item.tags)) ? item.tags : (typeof item.tags==='string' ? item.tags.split(',').map(s=>s.trim()).filter(Boolean) : []);
        item.createdAt = item.createdAt || nowISO();
        // try to persist each imported item to server (best-effort)
        try {
          const res = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(mapTaskToServer(item)) });
          const saved = await res.json();
          tasks.push(mapServerToTask(saved));
        } catch (err) {
          // push locally if server fails
          tasks.push(item);
        }
      }
      render();
    }catch(err){
      alert('Erro ao importar: ' + err.message);
    }finally{
      importFile.value = '';
    }
  });

  // form
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = titleInput.value.trim();
    if(!title) { alert('Título obrigatório'); return; }
    const t = {
      title,
      description: descInput.value.trim(),
      dueDate: dueDateInput.value || null,
      priority: priorityInput.value,
      tags: tagsInput.value.split(',').map(s=>s.trim()).filter(Boolean)
    };
    if(editingId){
      await updateTask(editingId, t);
      stopEdit();
    } else {
      await createTask(t);
      form.reset();
    }
  });

  updateBtn.addEventListener('click', ()=>{ if(!editingId) return; form.dispatchEvent(new Event('submit')); });
  cancelEdit.addEventListener('click', stopEdit);
  function stopEdit(){ editingId = null; form.reset(); addBtn.classList.remove('hidden'); updateBtn.classList.add('hidden'); cancelEdit.classList.add('hidden'); }

  // controls
  [filterEl, sortEl, searchEl].forEach(el=>el.addEventListener('input', render));

  // helpers
  function capitalize(s){ if(!s) return ''; return s[0].toUpperCase()+s.slice(1); }
  function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>\"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // init
  async function init(){
    // try to load from server
    try {
      const res = await apiFetch('/api/tasks');
      const data = await res.json();
      tasks = (Array.isArray(data) ? data.map(mapServerToTask) : []);
      render();
    } catch (err) {
      console.warn('Failed to load from server, falling back to localStorage:', err.message);
      tasks = loadLocal();
      // basic migration: ensure ids and createdAt
      tasks.forEach(t=>{ if(!t.id) t.id = uid(); if(!t.createdAt) t.createdAt = nowISO(); if(!t.tags) t.tags = []; });
      render();
    }
  }

  // expose for debug
  window._taskApp = {createTask, updateTask, deleteTask, tasks};

  init();

})();
