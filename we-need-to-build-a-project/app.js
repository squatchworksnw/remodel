const STORAGE_KEY = "remodel-tracker-v1";

const seedData = {
  projectName: "Kitchen and Bath Remodel",
  targetDate: "2026-08-28",
  expectedDuration: "14 weeks",
  rooms: [
    { id: crypto.randomUUID(), name: "Kitchen", budget: 42000, sqft: 240, duration: "8 weeks", status: "Planning" },
    { id: crypto.randomUUID(), name: "Primary Bath", budget: 28000, sqft: 95, duration: "6 weeks", status: "In progress" },
    { id: crypto.randomUUID(), name: "Laundry", budget: 9000, sqft: 55, duration: "2 weeks", status: "Waiting" }
  ],
  tasks: [
    { id: crypto.randomUUID(), title: "Finalize cabinet layout", room: "Kitchen", start: "2026-05-06", due: "2026-05-08", duration: "3 days", status: "Doing" },
    { id: crypto.randomUUID(), title: "Confirm shower tile lead time", room: "Primary Bath", start: "2026-05-13", due: "2026-05-13", duration: "1 day", status: "Todo" },
    { id: crypto.randomUUID(), title: "Schedule rough plumbing walk-through", room: "Laundry", start: "2026-05-20", due: "2026-05-20", duration: "2 hours", status: "Blocked" }
  ],
  materials: [],
  bids: [
    {
      id: crypto.randomUUID(),
      contractor: "Northline Build Co.",
      amount: 76500,
      timeline: "10 weeks",
      included: "Labor, rough materials, cabinets install, tile labor",
      exclusions: "Appliances, decorative lighting, permit fees",
      contact: "alex@northline.example",
      status: "Considering"
    },
    {
      id: crypto.randomUUID(),
      contractor: "Harbor House Renovation",
      amount: 82750,
      timeline: "8 weeks",
      included: "Labor, project management, finish carpentry, tile labor",
      exclusions: "Cabinets, fixtures, unknown subfloor repairs",
      contact: "555-0144",
      status: "Favorite"
    }
  ],
  expenses: [
    { id: crypto.randomUUID(), item: "Cabinet allowance", amount: 18500, type: "Estimate" },
    { id: crypto.randomUUID(), item: "Tile deposit", amount: 2400, type: "Committed" },
    { id: crypto.randomUUID(), item: "Design consult", amount: 950, type: "Paid" }
  ],
  decisions: [
    { id: crypto.randomUUID(), title: "Quartz vs. porcelain countertop", owner: "Beeja", status: "Researching" },
    { id: crypto.randomUUID(), title: "Keep tub or convert to shower", owner: "Beeja", status: "Open" }
  ]
};

let state = normalizeState(loadState());
let activeMaterialTaskId = "";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const formCollections = {
  roomForm: "rooms",
  taskForm: "tasks",
  bidForm: "bids",
  expenseForm: "expenses",
  decisionForm: "decisions"
};

const submitText = {
  roomForm: "Add room",
  taskForm: "Add task",
  bidForm: "Add bid",
  expenseForm: "Add cost",
  decisionForm: "Add decision"
};

const cycles = {
  rooms: ["Planning", "In progress", "Waiting", "Done"],
  tasks: ["Todo", "Doing", "Blocked", "Done"],
  materials: ["Needed", "Quoted", "Ordered", "Received"],
  bids: ["Considering", "Need details", "Favorite", "Declined"],
  expenses: ["Estimate", "Committed", "Paid"],
  decisions: ["Open", "Researching", "Decided"]
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(seedData);
}

function normalizeState(data) {
  return {
    ...structuredClone(seedData),
    ...data,
    expectedDuration: data.expectedDuration || "Time TBD",
    rooms: (data.rooms || []).map((room) => ({ sqft: 0, duration: "Time TBD", ...room })),
    tasks: (data.tasks || []).map((task) => ({ duration: "Time TBD", start: task.start || task.due, ...task })),
    materials: data.materials || [],
    bids: data.bids || [],
    expenses: data.expenses || [],
    decisions: data.decisions || []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  document.querySelector("#projectName").value = state.projectName;
  document.querySelector("#targetDate").value = state.targetDate;
  document.querySelector("#expectedDuration").value = state.expectedDuration || "";
  renderStats();
  renderRooms();
  renderTasks();
  renderCalendar();
  renderBids();
  renderExpenses();
  renderDecisions();
  renderPrintReport();
  syncRoomSelect();
}

function renderStats() {
  const totals = getTotals();

  document.querySelector("#totalBudget").textContent = money.format(totals.totalBudget);
  document.querySelector("#totalEstimate").textContent = money.format(totals.totalEstimate);
  document.querySelector("#taskProgress").textContent = `${totals.progress}%`;
  document.querySelector("#bestBid").textContent = totals.bestBid
    ? `${totals.bestBid.contractor} ${money.format(totals.bestBid.amount)}`
    : "TBD";
  document.querySelector("#totalSqft").textContent = totals.totalSqft.toLocaleString();
  document.querySelector("#budgetPerSqft").textContent = totals.totalSqft
    ? money.format(totals.totalBudget / totals.totalSqft)
    : "TBD";
  document.querySelector("#materialCosts").textContent = money.format(totals.materialCosts);
  document.querySelector("#suppliesToBuy").textContent = getSuppliesToBuy().length.toLocaleString();

  document.querySelector("#roomProgress").innerHTML = state.rooms
    .map((room) => {
      const roomTasks = state.tasks.filter((task) => task.room === room.name);
      const done = roomTasks.filter((task) => task.status === "Done").length;
      const pct = roomTasks.length ? Math.round((done / roomTasks.length) * 100) : 0;
      return `
        <div class="item-card">
          <div class="item-head">
            <strong>${escapeHtml(room.name)}</strong>
            <span class="pill">${escapeHtml(room.status)}</span>
          </div>
          <p class="small">${money.format(room.budget)} budget - ${Number(room.sqft).toLocaleString()} sq ft - ${escapeHtml(room.duration || "Time TBD")}</p>
          <div class="progress" aria-label="${pct}% complete"><span style="width:${pct}%"></span></div>
        </div>
      `;
    })
    .join("");

  document.querySelector("#upcomingTasks").innerHTML = [...state.tasks]
    .filter((task) => task.status !== "Done")
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)))
    .slice(0, 5)
    .map((task) => taskTemplate(task, false))
    .join("");

  document.querySelector("#bidSummary").innerHTML = [...state.bids]
    .sort((a, b) => Number(a.amount) - Number(b.amount))
    .map(
      (bid) => `
        <tr>
          <td><strong>${escapeHtml(bid.contractor)}</strong><br><span class="small">${escapeHtml(bid.contact || "No contact yet")}</span></td>
          <td>${money.format(bid.amount)}</td>
          <td>${escapeHtml(bid.timeline)}</td>
          <td>${escapeHtml(bid.included)}</td>
          <td><span class="pill">${escapeHtml(bid.status)}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderRooms() {
  document.querySelector("#roomList").innerHTML = state.rooms.map(roomTemplate).join("");
}

function roomTemplate(room) {
  return `
    <article class="item-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(room.name)}</strong>
          <p class="meta">${money.format(room.budget)} budget - ${Number(room.sqft).toLocaleString()} sq ft - ${escapeHtml(room.duration || "Time TBD")}</p>
        </div>
        <span class="pill">${escapeHtml(room.status)}</span>
      </div>
      <div class="row-actions">
        <button data-edit="rooms" data-form="roomForm" data-id="${room.id}">Edit</button>
        <button data-cycle="rooms" data-id="${room.id}">Next status</button>
        <button data-delete="rooms" data-id="${room.id}">Remove</button>
      </div>
    </article>
  `;
}

function renderTasks() {
  document.querySelector("#taskList").innerHTML = [...state.tasks]
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)))
    .map((task) => taskTemplate(task, true))
    .join("");
}

function taskTemplate(task, showMaterialControls) {
  const isBlocked = task.status === "Blocked";
  const taskMaterials = state.materials.filter((material) => material.taskId === task.id);
  const materialCost = taskMaterials.reduce((sum, material) => sum + Number(material.cost), 0);
  return `
    <article class="item-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <p class="meta">${escapeHtml(task.room)} - starts ${escapeHtml(taskDate(task))} - due ${escapeHtml(task.due)} - ${escapeHtml(task.duration || "Time TBD")}</p>
          <p class="meta">${taskMaterials.length} material${taskMaterials.length === 1 ? "" : "s"} - ${money.format(materialCost)}</p>
        </div>
        <span class="pill ${isBlocked ? "warn" : ""}">${escapeHtml(task.status)}</span>
      </div>
      <div class="row-actions">
        <button data-edit="tasks" data-form="taskForm" data-id="${task.id}">Edit</button>
        ${showMaterialControls ? `<button data-toggle-materials="${task.id}">Materials</button>` : ""}
        <button data-cycle="tasks" data-id="${task.id}">Next status</button>
        <button data-delete="tasks" data-id="${task.id}">Remove</button>
      </div>
      ${showMaterialControls && activeMaterialTaskId === task.id ? materialPanel(task, taskMaterials) : ""}
    </article>
  `;
}

function renderCalendar() {
  const today = todayDateString();
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index));
  const upcoming = getUpcomingTasks(21);
  const supplies = getSuppliesToBuy();

  document.querySelector("#calendarToday").textContent = `Starting today: ${formatDate(today)}`;
  document.querySelector("#calendarGrid").innerHTML = days
    .map((date) => {
      const tasks = state.tasks.filter((task) => task.status !== "Done" && taskDate(task) === date);
      return `
        <article class="calendar-day ${date === today ? "today" : ""}">
          <strong>${formatShortDate(date)}</strong>
          <div class="calendar-items">
            ${
              tasks.length
                ? tasks.map((task) => `<span>${escapeHtml(task.title)}</span>`).join("")
                : `<em>No starts</em>`
            }
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelector("#calendarTaskList").innerHTML = upcoming.length
    ? upcoming.map(calendarTaskTemplate).join("")
    : `<p class="meta">No upcoming tasks scheduled.</p>`;

  document.querySelector("#supplyList").innerHTML = supplies.length
    ? supplies.map(supplyTemplate).join("")
    : `<p class="meta">No supplies need buying before upcoming task starts.</p>`;
}

function calendarTaskTemplate(task) {
  return `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <p class="meta">${escapeHtml(task.room)} - starts ${formatDate(taskDate(task))}</p>
        </div>
        <span class="pill">${escapeHtml(task.status)}</span>
      </div>
    </article>
  `;
}

function supplyTemplate(entry) {
  return `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(entry.material.item)}</strong>
          <p class="meta">${escapeHtml(entry.material.company)} - for ${escapeHtml(entry.task.title)}</p>
          <p class="meta">Buy before ${formatDate(taskDate(entry.task))}</p>
        </div>
        <span class="pill">${money.format(entry.material.cost)}</span>
      </div>
    </article>
  `;
}

function materialPanel(task, materials) {
  return `
    <div class="material-panel">
      <form class="entry-form material-entry" data-material-form data-task-id="${task.id}">
        <input name="item" placeholder="Material needed" required />
        <input name="company" placeholder="Company / supplier" required />
        <input name="cost" type="number" min="0" step="1" placeholder="Cost" required />
        <select name="status">
          <option>Needed</option>
          <option>Quoted</option>
          <option>Ordered</option>
          <option>Received</option>
        </select>
        <button type="submit">Add material</button>
        <button type="button" class="cancel-edit" data-cancel-material hidden>Cancel edit</button>
      </form>
      <div class="stack">
        ${
          materials.length
            ? materials.map(materialTemplate).join("")
            : `<p class="meta">No materials added for this task yet.</p>`
        }
      </div>
    </div>
  `;
}

function materialTemplate(material) {
  return `
    <div class="material-row">
      <div>
        <strong>${escapeHtml(material.item)}</strong>
        <p class="meta">${escapeHtml(material.company)} - ${escapeHtml(material.status)}</p>
      </div>
      <div class="material-actions">
        <span class="pill">${money.format(material.cost)}</span>
        <button data-edit-material="${material.id}">Edit</button>
        <button data-cycle="materials" data-id="${material.id}">Next status</button>
        <button data-delete="materials" data-id="${material.id}">Remove</button>
      </div>
    </div>
  `;
}

function renderBids() {
  document.querySelector("#bidList").innerHTML = [...state.bids]
    .sort((a, b) => Number(a.amount) - Number(b.amount))
    .map(
      (bid) => `
        <article class="item-card">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(bid.contractor)}</strong>
              <p class="meta">${money.format(bid.amount)} - ${escapeHtml(bid.timeline)}</p>
            </div>
            <span class="pill">${escapeHtml(bid.status)}</span>
          </div>
          <p><strong>Included:</strong> ${escapeHtml(bid.included)}</p>
          <p class="meta"><strong>Exclusions:</strong> ${escapeHtml(bid.exclusions || "None listed")}</p>
          <p class="meta"><strong>Contact:</strong> ${escapeHtml(bid.contact || "Not added")}</p>
          <div class="row-actions">
            <button data-edit="bids" data-form="bidForm" data-id="${bid.id}">Edit</button>
            <button data-cycle="bids" data-id="${bid.id}">Next status</button>
            <button data-delete="bids" data-id="${bid.id}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderExpenses() {
  document.querySelector("#expenseList").innerHTML = state.expenses
    .map(
      (expense) => `
        <article class="item-card">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(expense.item)}</strong>
              <p class="meta">${escapeHtml(expense.type)}</p>
            </div>
            <span class="pill">${money.format(expense.amount)}</span>
          </div>
          <div class="row-actions">
            <button data-edit="expenses" data-form="expenseForm" data-id="${expense.id}">Edit</button>
            <button data-cycle="expenses" data-id="${expense.id}">Next type</button>
            <button data-delete="expenses" data-id="${expense.id}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderDecisions() {
  document.querySelector("#decisionList").innerHTML = state.decisions
    .map(
      (decision) => `
        <article class="item-card">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(decision.title)}</strong>
              <p class="meta">Owner: ${escapeHtml(decision.owner)}</p>
            </div>
            <span class="pill">${escapeHtml(decision.status)}</span>
          </div>
          <div class="row-actions">
            <button data-edit="decisions" data-form="decisionForm" data-id="${decision.id}">Edit</button>
            <button data-cycle="decisions" data-id="${decision.id}">Next status</button>
            <button data-delete="decisions" data-id="${decision.id}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
}

function syncRoomSelect() {
  const select = document.querySelector("#taskRoom");
  const currentValue = select.value;
  select.innerHTML = state.rooms.map((room) => `<option>${escapeHtml(room.name)}</option>`).join("");
  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .view").forEach((el) => el.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.view}`).classList.add("active");
    document.querySelector("#viewTitle").textContent = tab.textContent;
  });
});

document.querySelector("#projectName").addEventListener("input", (event) => {
  state.projectName = event.target.value;
  saveAndRender(false);
});

document.querySelector("#targetDate").addEventListener("input", (event) => {
  state.targetDate = event.target.value;
  saveAndRender(false);
});

document.querySelector("#expectedDuration").addEventListener("input", (event) => {
  state.expectedDuration = event.target.value;
  saveAndRender(false);
});

document.querySelector("#roomForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  upsert("roomForm", {
    name: data.name,
    budget: Number(data.budget),
    sqft: Number(data.sqft),
    duration: data.duration,
    status: data.status
  });
  saveAndRender();
});

document.querySelector("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  upsert("taskForm", {
    title: data.title,
    room: data.room,
    start: data.start,
    due: data.due,
    duration: data.duration,
    status: data.status
  });
  saveAndRender();
});

document.querySelector("#bidForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  upsert("bidForm", {
    contractor: data.contractor,
    amount: Number(data.amount),
    timeline: data.timeline,
    included: data.included,
    exclusions: data.exclusions,
    contact: data.contact,
    status: data.status
  });
  saveAndRender();
});

document.querySelector("#expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  upsert("expenseForm", { item: data.item, amount: Number(data.amount), type: data.type });
  saveAndRender();
});

document.querySelector("#decisionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  upsert("decisionForm", { title: data.title, owner: data.owner, status: data.status });
  saveAndRender();
});

document.body.addEventListener("click", (event) => {
  const cycleTarget = event.target.closest("[data-cycle]");
  const deleteTarget = event.target.closest("[data-delete]");
  const editTarget = event.target.closest("[data-edit]");
  const cancelTarget = event.target.closest("[data-cancel]");
  const materialToggle = event.target.closest("[data-toggle-materials]");
  const materialEdit = event.target.closest("[data-edit-material]");
  const materialCancel = event.target.closest("[data-cancel-material]");

  if (materialToggle) {
    activeMaterialTaskId =
      activeMaterialTaskId === materialToggle.dataset.toggleMaterials ? "" : materialToggle.dataset.toggleMaterials;
    renderTasks();
  }

  if (materialEdit) {
    startMaterialEdit(materialEdit.dataset.editMaterial);
  }

  if (materialCancel) {
    resetMaterialForm(materialCancel.closest("[data-material-form]"));
  }

  if (cycleTarget) {
    const collection = cycleTarget.dataset.cycle;
    const item = state[collection].find((entry) => entry.id === cycleTarget.dataset.id);
    const field = collection === "expenses" ? "type" : "status";
    const values = cycles[collection];
    item[field] = values[(values.indexOf(item[field]) + 1) % values.length];
    saveAndRender();
  }

  if (deleteTarget) {
    const collection = deleteTarget.dataset.delete;
    state[collection] = state[collection].filter((entry) => entry.id !== deleteTarget.dataset.id);
    if (collection === "tasks") {
      state.materials = state.materials.filter((material) => material.taskId !== deleteTarget.dataset.id);
      if (activeMaterialTaskId === deleteTarget.dataset.id) activeMaterialTaskId = "";
    }
    clearEditState();
    saveAndRender();
  }

  if (editTarget) {
    startEdit(editTarget.dataset.form, editTarget.dataset.edit, editTarget.dataset.id);
  }

  if (cancelTarget) {
    resetForm(document.querySelector(`#${cancelTarget.dataset.cancel}`));
  }
});

document.body.addEventListener("submit", (event) => {
  const materialForm = event.target.closest("[data-material-form]");
  if (!materialForm) return;

  event.preventDefault();
  const data = formData(materialForm);
  const values = {
    taskId: materialForm.dataset.taskId,
    item: data.item,
    company: data.company,
    cost: Number(data.cost),
    status: data.status
  };

  if (materialForm.dataset.editingId) {
    Object.assign(state.materials.find((material) => material.id === materialForm.dataset.editingId), values);
  } else {
    state.materials.push({ id: crypto.randomUUID(), ...values });
  }

  saveAndRender();
});

document.querySelector("#printBtn").addEventListener("click", () => {
  renderPrintReport();
  window.print();
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.projectName || "remodel-tracker"}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#resetBtn").addEventListener("click", () => {
  state = normalizeState(structuredClone(seedData));
  saveAndRender();
});

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function upsert(formId, values) {
  const form = document.querySelector(`#${formId}`);
  const collection = formCollections[formId];
  const id = form.dataset.editingId;

  if (id) {
    const item = state[collection].find((entry) => entry.id === id);
    const previousRoomName = collection === "rooms" ? item.name : "";
    Object.assign(item, values);
    if (collection === "rooms" && previousRoomName !== values.name) {
      state.tasks.forEach((task) => {
        if (task.room === previousRoomName) task.room = values.name;
      });
    }
  } else {
    state[collection].push({ id: crypto.randomUUID(), ...values });
  }

  resetForm(form);
}

function startEdit(formId, collection, id) {
  const form = document.querySelector(`#${formId}`);
  const item = state[collection].find((entry) => entry.id === id);
  if (!item) return;

  Object.entries(item).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });

  form.dataset.editingId = id;
  form.querySelector("button[type='submit']").textContent = "Save changes";
  form.querySelector(".cancel-edit").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm(form) {
  form.reset();
  delete form.dataset.editingId;
  form.querySelector("button[type='submit']").textContent = submitText[form.id];
  form.querySelector(".cancel-edit").hidden = true;
}

function clearEditState() {
  Object.keys(formCollections).forEach((formId) => resetForm(document.querySelector(`#${formId}`)));
}

function startMaterialEdit(id) {
  const material = state.materials.find((entry) => entry.id === id);
  if (!material) return;

  activeMaterialTaskId = material.taskId;
  renderTasks();

  const form = document.querySelector(`[data-material-form][data-task-id="${material.taskId}"]`);
  form.elements.namedItem("item").value = material.item;
  form.elements.namedItem("company").value = material.company;
  form.elements.namedItem("cost").value = material.cost;
  form.elements.namedItem("status").value = material.status;
  form.dataset.editingId = material.id;
  form.querySelector("button[type='submit']").textContent = "Save material";
  form.querySelector(".cancel-edit").hidden = false;
}

function resetMaterialForm(form) {
  form.reset();
  delete form.dataset.editingId;
  form.querySelector("button[type='submit']").textContent = "Add material";
  form.querySelector(".cancel-edit").hidden = true;
}

function saveAndRender(renderEverything = true) {
  saveState();
  if (renderEverything) {
    render();
  } else {
    renderPrintReport();
  }
}

function getTotals() {
  const totalBudget = state.rooms.reduce((sum, room) => sum + Number(room.budget), 0);
  const totalSqft = state.rooms.reduce((sum, room) => sum + Number(room.sqft || 0), 0);
  const totalEstimate = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const materialCosts = state.materials.reduce((sum, material) => sum + Number(material.cost), 0);
  const doneTasks = state.tasks.filter((task) => task.status === "Done").length;
  const progress = state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) : 0;
  const bestBid = [...state.bids].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
  return { totalBudget, totalSqft, totalEstimate, materialCosts, progress, bestBid };
}

function getUpcomingTasks(dayCount) {
  const today = todayDateString();
  const end = addDays(today, dayCount);
  return [...state.tasks]
    .filter((task) => task.status !== "Done" && taskDate(task) >= today && taskDate(task) <= end)
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)));
}

function getSuppliesToBuy() {
  const today = todayDateString();
  return state.materials
    .map((material) => ({
      material,
      task: state.tasks.find((task) => task.id === material.taskId)
    }))
    .filter(({ material, task }) => {
      if (!task || task.status === "Done") return false;
      const stillNeedsPurchase = ["Needed", "Quoted"].includes(material.status);
      return stillNeedsPurchase && taskDate(task) >= today;
    })
    .sort((a, b) => taskDate(a.task).localeCompare(taskDate(b.task)));
}

function taskDate(task) {
  return task.start || task.due || todayDateString();
}

function todayDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatShortDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function renderPrintReport() {
  const totals = getTotals();
  const supplies = getSuppliesToBuy();

  document.querySelector("#printReport").innerHTML = `
    <h1>${escapeHtml(state.projectName || "Remodel Project")}</h1>
    <p><strong>Target finish:</strong> ${escapeHtml(state.targetDate || "TBD")}</p>
    <p><strong>Expected time to finish:</strong> ${escapeHtml(state.expectedDuration || "TBD")}</p>
    <div class="print-grid">
      <div class="print-stat"><span>Total budget</span><strong>${money.format(totals.totalBudget)}</strong></div>
      <div class="print-stat"><span>Estimated spend</span><strong>${money.format(totals.totalEstimate)}</strong></div>
      <div class="print-stat"><span>Tasks complete</span><strong>${totals.progress}%</strong></div>
      <div class="print-stat"><span>Best bid</span><strong>${totals.bestBid ? `${escapeHtml(totals.bestBid.contractor)} ${money.format(totals.bestBid.amount)}` : "TBD"}</strong></div>
      <div class="print-stat"><span>Total sq ft</span><strong>${totals.totalSqft.toLocaleString()}</strong></div>
      <div class="print-stat"><span>Budget / sq ft</span><strong>${totals.totalSqft ? money.format(totals.totalBudget / totals.totalSqft) : "TBD"}</strong></div>
      <div class="print-stat"><span>Material costs</span><strong>${money.format(totals.materialCosts)}</strong></div>
    </div>
    ${printTable("Rooms", ["Room", "Budget", "Sq ft", "Cost / sq ft", "Expected time", "Status"], state.rooms.map((room) => [room.name, money.format(room.budget), Number(room.sqft || 0).toLocaleString(), room.sqft ? money.format(Number(room.budget) / Number(room.sqft)) : "TBD", room.duration || "TBD", room.status]))}
    ${printTable("Tasks", ["Task", "Room", "Start", "Due", "Expected time", "Status"], state.tasks.map((task) => [task.title, task.room, taskDate(task), task.due, task.duration || "TBD", task.status]))}
    ${printTable("Buy Before Start", ["Task", "Start", "Supply", "Company", "Cost", "Status"], supplies.map(({ task, material }) => [task.title, taskDate(task), material.item, material.company, money.format(material.cost), material.status]))}
    ${printTable("Materials", ["Task", "Material", "Company", "Cost", "Status"], state.materials.map((material) => [getTaskTitle(material.taskId), material.item, material.company, money.format(material.cost), material.status]))}
    ${printTable("Contractor Bids", ["Contractor", "Bid", "Timeline", "Included", "Exclusions", "Contact", "Status"], state.bids.map((bid) => [bid.contractor, money.format(bid.amount), bid.timeline, bid.included, bid.exclusions || "None listed", bid.contact || "Not added", bid.status]))}
    ${printTable("Budget", ["Item", "Amount", "Type"], state.expenses.map((expense) => [expense.item, money.format(expense.amount), expense.type]))}
    ${printTable("Decisions", ["Decision", "Owner", "Status"], state.decisions.map((decision) => [decision.title, decision.owner, decision.status]))}
  `;
}

function getTaskTitle(taskId) {
  return state.tasks.find((task) => task.id === taskId)?.title || "Unassigned task";
}

function printTable(title, headers, rows) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${
          rows.length
            ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${headers.length}">No entries yet</td></tr>`
        }
      </tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();

setInterval(() => {
  renderStats();
  renderCalendar();
  renderPrintReport();
}, 60 * 60 * 1000);

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // The tracker still works without offline caching when opened as a local file.
  });
}
