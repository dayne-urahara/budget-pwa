// app.js — Dépenses, Épargne budgétisée, Projection annuelle & Boussole (IndexedDB via db.js)

// Helpers
const fmt  = (n) => new Intl.NumberFormat("fr-DZ").format(Math.round(Number(n) || 0)) + " DZD";
const just = (n) => new Intl.NumberFormat("fr-DZ").format(Math.round(Number(n) || 0));
const $    = (id) => document.getElementById(id);
const warn = (m) => alert(m);
const today= () => new Date().toISOString().slice(0,10);

// DOM refs
const salaryInput = $("salary"), currentSalary = $("currentSalary"), saveSalary = $("saveSalary");
const catName = $("catName"), catBudget = $("catBudget"), addCat = $("addCat"), catsBody = $("catsBody"), catsTotal = $("catsTotal");
const txCat = $("txCat"), txAmount = $("txAmount"), txNote = $("txNote"), txDate = $("txDate"), addTx = $("addTx"), clearTx = $("clearTx"), txBody = $("txBody");
const dashSalary = $("dashSalary"), dashCats = $("dashCats"), dashSpent = $("dashSpent"), dashSave = $("dashSave"), dashSavings = $("dashSavings"), dashLeft = $("dashLeft"), barSpent = $("barSpent");
const exportBtn = $("exportBtn"), importFile = $("importFile"), seedDz = $("seedDz"), catBars = $("catBars");
const nowMonthTag = $("nowMonthTag"), compassBox = $("compassBox");

// Savings DOM
const savName = $("savName"), savTarget = $("savTarget"), savAmount = $("savAmount"), addSav = $("addSav"), savBody = $("savBody"), savTotal = $("savTotal");

// Projection DOM
const yearSelect = $("yearSelect"), refreshYear = $("refreshYear"), yearTableWrap = $("yearTableWrap");

// State
let salary = 0;
let cats = [];      // {id,name,budget}
let tx   = [];      // {id, date, catId, amount, note}
let savings = [];   // {id,name,amount,target}

// Init
txDate.value = today();
nowMonthTag.textContent = new Date().toLocaleString("fr-DZ", { month: "long", year: "numeric" });

// ---------- Calculs ----------
function sumBudgets() { return cats.reduce((s,c)=> s + Number(c.budget||0), 0); }
function totalSpentMonth(ym) {
  return tx.filter(t => (t.date||"").slice(0,7) === ym).reduce((s,t)=> s + Number(t.amount||0), 0);
}
function spentByCatMonth(ym) {
  const m = {};
  for (const t of tx) {
    if ((t.date||"").slice(0,7) !== ym) continue;
    m[t.catId] = (m[t.catId] || 0) + Number(t.amount||0);
  }
  return m;
}
function totalSavings() { return savings.reduce((s,g)=> s + Number(g.amount||0), 0); }
function theoreticalSave(ym) {
  const spent = totalSpentMonth(ym);
  return Math.max(0, (Number(salary)||0) - spent);
}
function leftToAllocate(ym) {
  // l'épargne allouée est globale (mensuelle “de fait”), on la compare au théorique du mois courant
  return Math.max(0, theoreticalSave(ym) - totalSavings());
}

// ---------- Rendu UI ----------
function renderSalary(ymNow) {
  currentSalary.textContent = salary ? fmt(salary) : "—";
  salaryInput.value = salary || "";
  dashSalary.textContent = salary ? fmt(salary) : "—";
  // Update compass later
}

function renderCats(ymNow) {
  const spentBy = spentByCatMonth(ymNow);
  let totalBud = 0;

  catsBody.innerHTML = cats.map(c => {
    const spent = spentBy[c.id] || 0;
    const rest  = Math.max(0, Number(c.budget||0) - spent);
    totalBud += Number(c.budget||0);
    const pct = c.budget ? Math.min(100, Math.round((spent / c.budget) * 100)) : 0;
    return `<tr>
      <td>${c.name}<br><span class="muted">${pct}% consommé</span></td>
      <td class="right">${fmt(c.budget||0)}</td>
      <td class="right">${fmt(spent)}</td>
      <td class="right">${fmt(rest)}</td>
      <td class="right"><button data-del="${c.id}" class="danger" style="padding:6px 8px">Suppr.</button></td>
    </tr>`;
  }).join("");

  catsTotal.textContent = just(totalBud);
  dashCats.textContent  = fmt(totalBud);
  txCat.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  // mini barres catégorie
  catBars.innerHTML = cats.map(c => {
    const spent = spentBy[c.id] || 0;
    const pct = c.budget ? Math.min(100, Math.round((spent / c.budget) * 100)) : 0;
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

function renderTx(ymNow) {
  txBody.innerHTML = tx.slice().reverse().map(t => {
    const cat = cats.find(c => c.id === t.catId);
    return `<tr>
      <td>${t.date || "—"}</td>
      <td>${cat ? cat.name : "—"}</td>
      <td>${t.note || ""}</td>
      <td class="right">${fmt(t.amount)}</td>
    </tr>`;
  }).join("");

  const spent = totalSpentMonth(ymNow);
  dashSpent.textContent = fmt(spent);
  const theo = theoreticalSave(ymNow);
  dashSave.textContent = fmt(theo);
  dashSavings.textContent = fmt(totalSavings());
  dashLeft.textContent = fmt(leftToAllocate(ymNow));

  const ratio = salary ? Math.min(100, Math.round((spent / salary) * 100)) : 0;
  barSpent.style.width = ratio + "%";

  renderCompass(ymNow, spent, theo);
}

function renderSavings() {
  savBody.innerHTML = savings.map(g => {
    const pct = g.target ? Math.min(100, Math.round((Number(g.amount||0) / Number(g.target)) * 100)) : 0;
    return `<tr>
      <td>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input data-edit-name="${g.id}" value="${g.name}" />
        </div>
      </td>
      <td class="right">
        <input data-edit-amount="${g.id}" type="number" value="${Number(g.amount||0)}" style="width:120px" />
      </td>
      <td class="right">
        <input data-edit-target="${g.id}" type="number" value="${Number(g.target||0)}" style="width:120px" />
      </td>
      <td>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="muted">${pct}%</div>
      </td>
      <td class="right">
        <button data-save-s="${g.id}" class="ghost" style="padding:6px 10px">Sauver</button>
        <button data-del-s="${g.id}" class="danger" style="padding:6px 10px">Suppr.</button>
      </td>
    </tr>`;
  }).join("");

  savTotal.textContent = just(totalSavings());
}

function renderYearSelect() {
  const years = new Set();
  for (const t of tx) {
    if (!t.date) continue;
    years.add(t.date.slice(0,4));
  }
  const thisYear = String(new Date().getFullYear());
  years.add(thisYear);
  const arr = Array.from(years).sort();
  yearSelect.innerHTML = arr.map(y => `<option value="${y}" ${y===thisYear?"selected":""}>${y}</option>`).join("");
}

function renderYearTable(yearStr) {
  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  let rows = "", sumSpent=0, sumTheo=0, sumSav=0;
  for (const m of months) {
    const ym = `${yearStr}-${m}`;
    const spent = totalSpentMonth(ym);
    const theo  = theoreticalSave(ym);
    const savA  = totalSavings(); // modèle simple : enveloppes d’épargne “mensuelles” (global), tu peux les ajuster mois par mois si tu veux
    sumSpent += spent; sumTheo += theo; sumSav += savA;
    rows += `<tr>
      <td>${yearStr}-${m}</td>
      <td class="right">${fmt(spent)}</td>
      <td class="right">${fmt(theo)}</td>
      <td class="right">${fmt(savA)}</td>
    </tr>`;
  }
  const table = `
    <table class="table">
      <thead><tr><th>Mois</th><th class="right">Dépensé</th><th class="right">Épargne théorique</th><th class="right">Épargne allouée</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th>Total ${yearStr}</th><th class="right">${fmt(sumSpent)}</th><th class="right">${fmt(sumTheo)}</th><th class="right">${fmt(sumSav)}</th></tr>
      </tfoot>
    </table>
    <p class="muted">Projection simple : si tu gardes le même salaire/rythme, “Épargne théorique” × 12 ≈ épargne annuelle potentielle. Ajuste tes enveloppes d’épargne pour coller à tes objectifs.</p>
  `;
  yearTableWrap.innerHTML = table;
}

// ---------- Boussole (conseils dynamiques) ----------
function renderCompass(ymNow, spent, theo) {
  const d = new Date();
  const day = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  const progressTime = Math.round((day / daysInMonth) * 100); // % du mois écoulé
  const spentVsSalary = salary ? Math.round((spent / salary) * 100) : 0;
  const left = leftToAllocate(ymNow);

  let tips = [];
  // rythme dépenses vs temps
  if (spentVsSalary > progressTime + 10) {
    tips.push(`<div class="bad">Tu dépenses plus vite que l’avancement du mois (${spentVsSalary}% vs ${progressTime}%). Ralentis sur les postes variables (resto, loisirs) pendant 3–5 jours.</div>`);
  } else if (spentVsSalary < progressTime - 10) {
    tips.push(`<div class="good">Tu es en avance sur ton budget (dépenses ${spentVsSalary}% &lt; progression du temps ${progressTime}%). Tu peux allouer une part du reste vers l’épargne.</div>`);
  } else {
    tips.push(`<div class="warn">Rythme correct. Surveille les grosses dépenses prévues (carburant, scolarité) pour éviter un pic en fin de mois.</div>`);
  }

  // reste à allouer
  if (left > 0) {
    tips.push(`<div>Reste à allouer : <strong>${fmt(left)}</strong>. Décide : <em>sécurité</em> (épargne), <em>loisirs</em> (petite part), ou <em>projets</em> (aménagement, voyage).</div>`);
  } else {
    tips.push(`<div class="warn">Plus de reste à allouer ce mois-ci. Toute dépense supplémentaire réduit l’épargne théorique.</div>`);
  }

  // enveloppes d’épargne vs cibles
  const nearTargets = savings.filter(s => s.target && s.amount >= 0.8 * s.target);
  if (nearTargets.length) {
    const names = nearTargets.map(s => s.name).join(", ");
    tips.push(`<div class="good">Proches de la cible : ${names}. Un petit effort pour les atteindre ce mois-ci.</div>`);
  }

  // garde-fous
  if (sumBudgets() > salary && salary) {
    tips.push(`<div class="bad">Tes budgets de catégories dépassent ton salaire. Réduis au moins <strong>${fmt(sumBudgets()-salary)}</strong> pour rester sain.</div>`);
  }

  compassBox.innerHTML = tips.map(t => `<p>${t}</p>`).join("");
}

// ---------- Data I/O ----------
async function loadAll() {
  await migrateIfNeeded();
  salary = Number(await getMeta("salary")) || 0;
  cats = await getAll("cats");
  tx   = await getAll("tx");
  savings = await getAll("savings");

  const ymNow = new Date().toISOString().slice(0,7);
  renderSalary(ymNow);
  renderCats(ymNow);
  renderTx(ymNow);
  renderSavings();
  renderYearSelect();
  renderYearTable((new Date()).getFullYear().toString());
}

async function saveSalaryVal(v) {
  await setMeta("salary", Number(v));
  salary = Number(v);
  const ymNow = new Date().toISOString().slice(0,7);
  renderSalary(ymNow); renderTx(ymNow);
}

async function addCategory(name, budget) {
  const newTotal = sumBudgets() + Number(budget||0);
  if (salary && newTotal > salary) return warn("La somme des budgets dépasse le salaire. Ajuste tes enveloppes.");
  const id = crypto.randomUUID();
  await put("cats", { id, name, budget: Number(budget||0) });
  cats = await getAll("cats");
  const ymNow = new Date().toISOString().slice(0,7);
  renderCats(ymNow); renderTx(ymNow);
}

async function deleteCategory(id) {
  const linked = tx.filter(t => t.catId === id);
  for (const t of linked) { await del("tx", t.id); }
  await del("cats", id);
  cats = await getAll("cats");
  tx   = await getAll("tx");
  const ymNow = new Date().toISOString().slice(0,7);
  renderCats(ymNow); renderTx(ymNow);
}

async function addExpense(catId, amount, note, date) {
  if (!cats.length) return warn("Crée d'abord une catégorie.");
  if (!amount || amount <= 0) return warn("Montant invalide.");
  await put("tx", { id: undefined, catId, amount: Number(amount), note: (note||"").trim(), date: date || today() });
  tx = await getAll("tx");
  const ymNow = new Date().toISOString().slice(0,7);
  renderCats(ymNow); renderTx(ymNow);
}

async function upsertSaving(obj) {
  // anti-surallocation : ne pas dépasser reste à allouer du mois en cours
  const ymNow = new Date().toISOString().slice(0,7);
  const left = leftToAllocate(ymNow) + (obj.prevAmount || 0); // autorise de rééditer sans être bloqué
  if (Number(obj.amount||0) > left) return warn("Montant supérieur au reste à allouer du mois.");
  await put("savings", { id: obj.id, name: obj.name, amount: Number(obj.amount||0), target: Number(obj.target||0) });
  savings = await getAll("savings");
  renderSavings();
  renderTx(ymNow); // met à jour left/dash
}

async function deleteSaving(id) {
  await del("savings", id);
  savings = await getAll("savings");
  renderSavings();
  const ymNow = new Date().toISOString().slice(0,7);
  renderTx(ymNow);
}

// ---------- Events ----------
saveSalary.addEventListener("click", async () => {
  const v = Number(salaryInput.value || 0);
  if (!v) return warn("Entre un salaire valide.");
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
  const all = await getAll("tx");
  for (const t of all) await del("tx", t.id);
  tx = [];
  const ymNow = new Date().toISOString().slice(0,7);
  renderCats(ymNow); renderTx(ymNow);
});

// Savings
addSav.addEventListener("click", async () => {
  const name = (savName.value || "").trim();
  const amount = Number(savAmount.value || 0);
  const target = Number(savTarget.value || 0);
  if (!name) return warn("Nom requis.");
  const found = savings.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (found) {
    await upsertSaving({ id: found.id, name, amount, target, prevAmount: found.amount||0 });
  } else {
    await upsertSaving({ id: crypto.randomUUID(), name, amount, target, prevAmount: 0 });
  }
  savName.value = ""; savAmount.value = ""; savTarget.value = "";
});

savBody.addEventListener("click", async (e) => {
  const saveBtn = e.target.closest("button[data-save-s]");
  const delBtn  = e.target.closest("button[data-del-s]");
  if (saveBtn) {
    const id = saveBtn.getAttribute("data-save-s");
    const name = document.querySelector(`[data-edit-name="${id}"]`).value.trim();
    const amount = Number(document.querySelector(`[data-edit-amount="${id}"]`).value || 0);
    const target = Number(document.querySelector(`[data-edit-target="${id}"]`).value || 0);
    const prev = (savings.find(s => s.id === id)?.amount) || 0;
    await upsertSaving({ id, name, amount, target, prevAmount: prev });
  }
  if (delBtn) {
    const id = delBtn.getAttribute("data-del-s");
    if (!confirm("Supprimer cette enveloppe d’épargne ?")) return;
    await deleteSaving(id);
  }
});

// Export / Import
exportBtn.addEventListener("click", async () => {
  const data = {
    salary: salary,
    cats: await getAll("cats"),
    tx: await getAll("tx"),
    savings: await getAll("savings")
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
    // reset cats/tx/savings
    const existingCats = await getAll("cats"); for (const c of existingCats) await del("cats", c.id);
