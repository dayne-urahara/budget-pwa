// app.js — utilise IndexedDB via db.js, contrôle budgets, mini-graphes

// Helpers
const fmt = (n) => new Intl.NumberFormat("fr-DZ").format(Math.round(Number(n) || 0)) + " DZD";
const $ = (id) => document.getElementById(id);

// DOM
const salaryInput = $("salary"), currentSalary = $("currentSalary"), saveSalary = $("saveSalary");
const catName = $("catName"), catBudget = $("catBudget"), addCat = $("addCat"), catsBody = $("catsBody"), catsTotal = $("catsTotal");
const txCat = $("txCat"), txAmount = $("txAmount"), txNote = $("txNote"), txDate = $("txDate"), addTx = $("addTx"), clearTx = $("clearTx"), txBody = $("txBody");
const dashSalary = $("dashSalary"), dashCats = $("dashCats"), dashSpent = $("dashSpent"), dashSave = $("dashSave"), barSpent = $("barSpent");
const exportBtn = $("exportBtn"), importFile = $("importFile"), seedDz = $("seedDz"), catBars = $("catBars");

// State en mémoire
let salary = 0;
let cats = [];
let tx = [];

// UI utils
function warn(msg) { alert(msg); }
function today() { return new Date().toISOString().slice(0,10); }
txDate.value = today();

// Render
function renderSalary() {
  currentSalary.textContent = salary ? fmt(salary) : "—";
  salaryInput.value = salary || "";
  dashSalary.textContent = salary ? fmt(salary) : "—";
}

function sumBudgets() {
  return cats.reduce((s,c)=> s + Number(c.budget||0), 0);
}

function computeSpentByCat() {
  const m = {};
  for (const t of tx) m[t.catId] = (m[t.catId] || 0) + Number(t.amount||0);
  return m;
}

function renderCats() {
  const spentBy = computeSpentByCat();
  let totalBud = 0;

  catsBody.innerHTML = cats.map(c => {
    const spent = spentBy[c.id] || 0;
    const rest  = Math.max(0, Number(c.budget||0) - spent);
    totalBud += Number(c.budget||0);
    return `<tr>
      <td>${c.name}</td>
      <td class="right">${fmt(c.budget||0)}</td>
      <td class="right">${fmt(spent)}</td>
      <td class="right">${fmt(rest)}</td>
      <td class="right"><button data-del="${c.id}" class="danger" style="padding:6px 8px">Suppr.</button></td>
    </tr>`;
  }).join("");

  catsTotal.textContent = new Intl.NumberFormat("fr-DZ").format(Math.round(totalBud)); // seulement le nombre
  dashCats.textContent = fmt(totalBud);

  txCat.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  // mini-graphes barres par catégorie
  catBars.innerHTML = cats.map(c => {
    const spent = spentBy[c.id] || 0;
    const pct = Math.min(100, c.budget ? Math.round((spent / c.budget) * 100) : 0);
    return `
      <div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span>${c.name}</span>
          <span>${fmt(spent)} / ${fmt(c.budget||0)}</span>
        </div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
    `;
  }).join("");
}

function renderTx() {
  txBody.innerHTML = tx.slice().reverse().map(t => {
    const cat = cats.find(c => c.id === t.catId);
    return `<tr>
      <td>${t.date || "—"}</td>
      <td>${cat ? cat.name : "—"}</td>
      <td>${t.note || ""}</td>
      <td class="right">${fmt(t.amount)}</td>
    </tr>`;
  }).join("");

  const totalSpent = tx.reduce((s,t)=> s + Number(t.amount||0), 0);
  dashSpent.textContent = fmt(totalSpent);
  const theoreticalSave = Math.max(0, (Number(salary)||0) - totalSpent);
  dashSave.textContent = fmt(theoreticalSave);

  const ratio = salary ? Math.min(100, Math.round((totalSpent / salary) * 100)) : 0;
  barSpent.style.width = ratio + "%";
}

// Data I/O
async function loadAll() {
  await migrateIfNeeded();
  salary = Number(await getMeta("salary")) || 0;
  cats = await getAll("cats");
  tx = await getAll("tx");
  renderSalary(); renderCats(); renderTx();
}

async function saveSalaryVal(v) {
  await setMeta("salary", Number(v));
  salary = Number(v);
  renderSalary(); renderTx();
}

async function addCategory(name, budget) {
  const id = crypto.randomUUID();
  const newTotal = sumBudgets() + Number(budget||0);
  if (salary && newTotal > salary) {
    return warn("La somme des budgets dépasse le salaire. Ajuste tes enveloppes.");
  }
  await put("cats", { id, name, budget: Number(budget||0), spent: 0 });
  cats = await getAll("cats");
  renderCats(); renderTx();
}

async function deleteCategory(id) {
  // supprime dépenses liées
  const linked = tx.filter(t => t.catId === id);
  for (const t of linked) { await del("tx", t.id); }
  await del("cats", id);
  cats = await getAll("cats");
  tx = await getAll("tx");
  renderCats(); renderTx();
}

async function addExpense(catId, amount, note, date) {
  if (!cats.length) return warn("Crée d'abord une catégorie.");
  if (!amount || amount <= 0) return warn("Montant invalide.");
  await put("tx", { catId, amount: Number(amount), note: (note||"").trim(), date: date || today() });
  tx = await getAll("tx");
  renderCats(); renderTx();
}

// Events
saveSalary.addEventListener("click", async () => {
  const v = Number(salaryInput.value || 0);
  if (!v) return warn("Entre un salaire valide.");
  // contrôle : si budgets existants > nouveau salaire → avertir
  if (sumBudgets() > v) {
    if (!confirm("Tes budgets actuels dépassent ce salaire. Continuer quand même ?")) return;
  }
  await saveSalaryVal(v);
});

addCat.addEventListener("click", async () => {
  const name = (catName.value || "").trim();
  const bud  = Number(catBudget.value || 0);
  if (!name || !bud) return warn("Nom et budget obligatoires.");
  await addCategory(name, bud);
  catName.value = ""; catBudget.value = "";
});

catsBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-del]");
  if (!btn) return;
  const id = btn.getAttribute("data-del");
  if (!confirm("Supprimer cette catégorie (et ses dépenses) ?")) return;
  await deleteCategory(id);
});

addTx.addEventListener("click", async () => {
  await addExpense(txCat.value, Number(txAmount.value||0), txNote.value, txDate.value);
  txAmount.value = ""; txNote.value = "";
});

clearTx.addEventListener("click", async () => {
  if (!confirm("Supprimer tout l'historique des dépenses ?")) return;
  // Supprime toutes les entrées tx
  const all = await getAll("tx");
  for (const t of all) await del("tx", t.id);
  tx = [];
  renderCats(); renderTx();
});

// Export / Import
exportBtn.addEventListener("click", async () => {
  const data = {
    salary: salary,
    cats: await getAll("cats"),
    tx: await getAll("tx")
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "budget-data.json"; a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    // reset stores: (simple: on supprime cat/tx un par un)
    const existingCats = await getAll("cats"); for (const c of existingCats) await del("cats", c.id);
    const existingTx = await getAll("tx"); for (const t of existingTx) await del("tx", t.id);

    if (data.salary) await setMeta("salary", Number(data.salary));
    if (Array.isArray(data.cats)) for (const c of data.cats) await put("cats", c);
    if (Array.isArray(data.tx))   for (const t of data.tx)   await put("tx", t);

    await loadAll();
    alert("Import OK.");
  } catch {
    warn("Fichier invalide.");
  }
});

// Précharger enveloppes DZ (exemple)
seedDz.addEventListener("click", async () => {
  if (!confirm("Ajouter un exemple d'enveloppes ?")) return;
  const base = [
    { name:"Courses alimentaires", budget:50000 },
    { name:"Voyages", budget:50000 },
    { name:"Épargne", budget:40000 },
    { name:"Frais scolaires", budget:25000 },
    { name:"Enfants & Épouse", budget:30000 },
    { name:"Véhicule", budget:20000 },
    { name:"Maison (aménagement)", budget:60000 },
    { name:"Maman", budget:5000 },
    { name:"Perso (Dayne)", budget:30000 }
  ];
  for (const it of base) await addCategory(it.name, it.budget);
});

// GO
loadAll();
