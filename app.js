const salaryInput = document.getElementById("salary");
const current = document.getElementById("current");
const save = document.getElementById("save");

function load() {
  const v = localStorage.getItem("salary");
  current.textContent = v
    ? new Intl.NumberFormat("fr-DZ").format(Number(v)) + " DZD"
    : "—";
  salaryInput.value = v || "";
}

save.addEventListener("click", () => {
  const v = salaryInput.value.trim();
  if (!v) return alert("Entre un montant.");
  localStorage.setItem("salary", v);
  load();
});

load();
