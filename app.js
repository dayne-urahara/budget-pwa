// --- Storage helpers (localStorage pour MVP) ---
const KEYS = {
  salary: "salary",
  cats: "cats",      // [{id,name,budget,spent}]
  tx: "tx"           // [{date,catId,amount,note}]
};

const fmt = (n) => new Intl.NumberFormat("fr-DZ").format(Math.round(Number(n) || 0)) + " DZD";

const loadJSON = (k, def) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? def; }
  catch { return def; }
};
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// --- State ---
let salary = Number(localStorage.getItem(KEYS.salary) || 0);
let cats   = loadJSON(KEYS.cats, []);
let tx     = loadJSON(KEYS.tx, []);

// --- DOM refs ---
const $ = (id) => document.getElementById(id);
const salaryInput = $("salary"), currentSalary = $("currentSalary"), saveSalary = $("saveSalary");
const catName = $("catName"), catBudget = $("catBudget"), addCat = $("addCat"), catsBody = $("catsBody"), catsTotal = $("catsTotal");
const txCat = $("txCat"), txAmount = $("txAmount"), txNote = $("txNote"), txDate = $("txDate"), addTx = $("addTx"), clearTx = $("clearTx"), txBody = $("txBody");
const dashSalary = $("dashSalary"), dashCats = $("dashCats"), dashSpent = $("dashSpent"), dashSave = $("dashSave"), barSpent = $("barSpent");
const exportBtn = $("exportBtn"), importFile = $("importFile"), seedDz = $("seedDz");

// --- Render helpers ---
function renderSalary(){
  currentSalary.textContent = salary ? fmt(salary) : "—";
  salaryInput.value = salary || "";
  dashSalary.textContent = salary ? fmt(salary) : "—";
}

function renderCats(){
  // recalc spent per cat
  const spentByCat = {};
  tx.forEach(t => spentByCat[t.catId] = (spentByCat[t.catId]||0) + Number(t.amount));
  let totalBud = 0;

  catsBody.innerHTML = cats.map(c => {
    const spent = spentByCat[c.id] || 0;
    const rest  = Number(c.budget) - spent;
    totalBud += Number(c.budget || 0);
    return `<tr>
      <td>${c.name}</td>
      <td class="right">${fmt(c.budget||0)}</td>
      <td class="right">${fmt(spent)}</td>
      <td class="right">${fmt(rest)}</td>
      <td class="right"><button data-del="${c.id}" class="danger" style="padding:6px 8px">Suppr.</button></td>
    </tr>`;
  }).join("");

  catsTotal.textContent = fmt(totalBud).replace(" DZD",""); // visuel
  dashCats.textContent = fmt(totalBud);

  // select
  txCat.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderTx(){
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

// --- Init date default ---
txDate.value = new Date().toISOString().slice(0,10);

// --- Events ---
saveSalary.addEventListener("click", () => {
  const v = Number(salaryInput.value || 0);
  if (!v) return alert("Entre un salaire valide.");
  salary = v;
  localStorage.setItem(KEYS.salary, String(v));
  renderSalary(); renderTx();
});

addCat.addEventListener("click", () => {
  const name = (catName.value || "").trim();
  const bud  = Number(catBudget.value || 0);
  if (!name || !bud) return alert("Nom et budget obligatoires.");
  const id = crypto.randomUUID();
  cats.push({ id, name, budget: bud, spent: 0 });
  saveJSON(KEYS.cats, cats);
  catName.value = ""; catBudget.value = "";
  renderCats(); renderTx();
});

// delete cat
catsBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-del]");
  if (!btn) return;
  const id = btn.getAttribute("data-del");
  // also remove related tx
  tx = tx.filter(t => t.catId !== id);
  cats = cats.filter(c => c.id !== id);
  saveJSON(KEYS.cats, cats);
  saveJSON(KEYS.tx, tx);
  renderCats(); renderTx();
});

addTx.addEventListener("click", () => {
  if (!cats.length) return alert("Crée d'abord une catégorie.");
  const catId = txCat.value;
  const amount = Number(txAmount.value || 0);
  if (!amount || amount <= 0) return alert("Montant invalide.");
  tx.push({
    date: txDate.value || new Date().toISOString().slice(0,10),
    catId,
    amount,
    note: (txNote.value||"").trim()
  });
  saveJSON(KEYS.tx, tx);
  txAmount.value = ""; txNote.value = "";
  renderCats(); renderTx();
});

clearTx.addEventListener("click", () => {
  if (!confirm("Supprimer tout l'historique des dépenses ?")) return;
  tx = [];
  saveJSON(KEYS.tx, tx);
  renderCats(); renderTx();
});

// Export / Import
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ salary, cats, tx }, null, 2)], { type: "application/json" });
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
    salary = Number(data.salary || 0);
    cats = Array.isArray(data.cats) ? data.cats : [];
    tx   = Array.isArray(data.tx)   ? data.tx   : [];
    if (salary) localStorage.setItem(KEYS.salary, String(salary));
    saveJSON(KEYS.cats, cats); saveJSON(KEYS.tx, tx);
    renderSalary(); renderCats(); renderTx();
    alert("Import OK.");
  } catch {
    alert("Fichier invalide.");
  }
});

// Précharger enveloppes DZ (exemple)
seedDz.addEventListener("click", () => {
  if (!confirm("Ajouter un exemple d'enveloppes ?")) return;
  cats = [
    { id: crypto.randomUUID(), name:"Courses alimentaires", budget:50000, spent:0 },
    { id: crypto.randomUUID(), name:"Voyages", budget:50000, spent:0 },
    { id: crypto.randomUUID(), name:"Épargne", budget:40000, spent:0 },
    { id: crypto.randomUUID(), name:"Frais scolaires", budget:25000, spent:0 },
    { id: crypto.randomUUID(), name:"Enfants & Épouse", budget:30000, spent:0 },
    { id: crypto.randomUUID(), name:"Véhicule", budget:20000, spent:0 },
    { id: crypto.randomUUID(), name:"Maison (aménagement)", budget:60000, spent:0 },
    { id: crypto.randomUUID(), name:"Maman", budget:5000, spent:0 },
    { id: crypto.randomUUID(), name:"Perso (Dayne)", budget:30000, spent:0 }
  ];
  saveJSON(KEYS.cats, cats);
  renderCats(); renderTx();
});

// --- First render ---
renderSalary(); renderCats(); renderTx();
