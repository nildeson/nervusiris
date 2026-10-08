// ===================================================================
// ========================  DASHBOARD  ==============================
// ===================================================================

// ===== Proteção de rota =====
const _token = localStorage.getItem("token");
if (!_token) {
  window.location.href = "login.html";
  throw new Error("Redirecionando para login...");
}

const _usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
if (_usuario.papel !== "admin") {
  alert("Acesso restrito a administradores.");
  window.location.href = "index.html";
  throw new Error("Sem permissão");
}

// ===== Estado =====
let todasConsultas = [];
let todosProfissionais = [];
let graficos = {};   // pra destruir antes de recriar

// ===================================================================
// ===========================  INIT  ================================
// ===================================================================

async function iniciarDashboard() {
  document.getElementById("nomeUsuario").textContent = _usuario.nome || "—";

  try {
    [todasConsultas, todosProfissionais] = await Promise.all([
      API.listarConsultas(),
      API.listarProfissionais()
    ]);

    popularFiltroProfissionais();
    atualizarTudo();
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar dados: " + err.message);
  }
}

// ===================================================================
// =======================  FILTROS  =================================
// ===================================================================

function popularFiltroProfissionais() {
  const sel = document.getElementById("filtroProfissional");
  sel.innerHTML = '<option value="">Todos profissionais</option>';

  todosProfissionais.forEach(p => {
    sel.innerHTML += `<option value="${p.id}">${p.nome} — ${p.especialidade}</option>`;
  });
}

document.getElementById("filtroPeriodo").addEventListener("change", atualizarTudo);
document.getElementById("filtroProfissional").addEventListener("change", atualizarTudo);
document.getElementById("btnAtualizar").addEventListener("click", async () => {
  const btn = document.getElementById("btnAtualizar");
  btn.textContent = "Carregando...";
  btn.disabled = true;

  try {
    [todasConsultas, todosProfissionais] = await Promise.all([
      API.listarConsultas(),
      API.listarProfissionais()
    ]);
    atualizarTudo();
  } finally {
    btn.textContent = "🔄 Atualizar";
    btn.disabled = false;
  }
});

// ===================================================================
// ====================  ATUALIZAR TUDO  =============================
// ===================================================================

function atualizarTudo() {
  const consultasFiltradas = filtrarConsultas();

  atualizarKPIs(consultasFiltradas);
  renderizarGraficoDias(consultasFiltradas);
  renderizarGraficoEspecialidade(consultasFiltradas);
  renderizarGraficoProfissionais(consultasFiltradas);
  renderizarGraficoHorarios(consultasFiltradas);
}

function filtrarConsultas() {
  const dias = Number(document.getElementById("filtroPeriodo").value);
  const profId = document.getElementById("filtroProfissional").value;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - dias);

  return todasConsultas.filter(c => {
    if (profId && c.profissionalId !== profId) return false;

    const [a, m, d] = c.data.split("-").map(Number);
    const dataConsulta = new Date(a, m - 1, d);
    return dataConsulta >= limite;
  });
}

// ===================================================================
// ===========================  KPIs  ================================
// ===================================================================

function atualizarKPIs(consultas) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());

  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const hojeISO = paraISO(hoje);
  const inicioSemanaISO = paraISO(inicioSemana);
  const inicioMesISO = paraISO(inicioMes);

  const contHoje = consultas.filter(c => c.data === hojeISO).length;
  const contSemana = consultas.filter(c => c.data >= inicioSemanaISO).length;
  const contMes = consultas.filter(c => c.data >= inicioMesISO).length;

  const online = consultas.filter(c => c.origem === "online").length;
  const pctOnline = consultas.length > 0
    ? Math.round((online / consultas.length) * 100)
    : 0;

  document.getElementById("kpiHoje").textContent = contHoje;
  document.getElementById("kpiSemana").textContent = contSemana;
  document.getElementById("kpiMes").textContent = contMes;
  document.getElementById("kpiOnline").textContent = pctOnline + "%";

  // 🆕 Taxa de cancelamento
  const taxaCancel = calcularTaxaCancelamento(consultas);
  const elCancel = document.getElementById("kpiCancel");
  elCancel.textContent = taxaCancel + "%";
  elCancel.style.color = taxaCancel > 15 ? "#dc2626" : "#0369a1";

  // 🆕 Comparativo mensal
  const comp = calcularComparativoMensal();
  const elComp = document.getElementById("kpiComparativo");
  const sinal = comp.variacao >= 0 ? "+" : "";
  elComp.textContent = `${sinal}${comp.variacao}%`;
  elComp.style.color = comp.variacao >= 0 ? "#16a34a" : "#dc2626";

  // 🆕 Novos vs recorrentes
  const nr = calcularNovosRecorrentes(consultas);
  const elNR = document.getElementById("kpiNovosRecorrentes");
  elNR.textContent = `${nr.novos} / ${nr.recorrentes}`;
  elNR.title = `${nr.novos} novos • ${nr.recorrentes} recorrentes`;
  elNR.style.fontSize = "1.3rem";
}

// ===================================================================
// =================  EVENTOS DOS BOTÕES  ============================
// ===================================================================

document.getElementById("btnExportarCsv").addEventListener("click", exportarCSV);
document.getElementById("btnImprimir").addEventListener("click", imprimirDashboard);
// ===================================================================
// ================  GRÁFICO 1: Consultas por dia  ===================
// ===================================================================

function renderizarGraficoDias(consultas) {
  const dias = Number(document.getElementById("filtroPeriodo").value);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Gera labels e valores
  const labels = [];
  const valores = [];

  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() - i);
    const iso = paraISO(dia);

    labels.push(`${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`);
    valores.push(consultas.filter(c => c.data === iso).length);
  }

  desenharGrafico("graficoDias", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Consultas",
        data: valores,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14, 165, 233, 0.15)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#0ea5e9"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 }
        }
      }
    }
  });
}

// ===================================================================
// ===========  GRÁFICO 2: Distribuição por especialidade  ===========
// ===================================================================

function renderizarGraficoEspecialidade(consultas) {
  const contagem = {};
  consultas.forEach(c => {
    contagem[c.especialidade] = (contagem[c.especialidade] || 0) + 1;
  });

  const labels = Object.keys(contagem);
  const valores = Object.values(contagem);

  if (labels.length === 0) {
    mostrarVazio("graficoEspecialidade");
    return;
  }

  const cores = ["#0ea5e9", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444"];

  desenharGrafico("graficoEspecialidade", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: cores.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 12, font: { size: 11 } }
        }
      }
    }
  });
}

// ===================================================================
// ==============  GRÁFICO 3: Top profissionais  =====================
// ===================================================================

function renderizarGraficoProfissionais(consultas) {
  const contagem = {};
  consultas.forEach(c => {
    contagem[c.profissionalId] = (contagem[c.profissionalId] || 0) + 1;
  });

  // Ordena e pega os 5 maiores
  const ordenado = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (ordenado.length === 0) {
    mostrarVazio("graficoProfissionais");
    return;
  }

  const labels = ordenado.map(([id]) => {
    const p = todosProfissionais.find(x => x.id === id);
    return p ? p.nome : id;
  });

  const valores = ordenado.map(([, n]) => n);

  desenharGrafico("graficoProfissionais", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Consultas",
        data: valores,
        backgroundColor: "#0ea5e9",
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 }
        }
      }
    }
  });
}

// ===================================================================
// ==============  GRÁFICO 4: Horários de pico  ======================
// ===================================================================

function renderizarGraficoHorarios(consultas) {
  const horarios = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30"
  ];

  const contagem = {};
  horarios.forEach(h => contagem[h] = 0);
  consultas.forEach(c => {
    if (contagem[c.hora] !== undefined) contagem[c.hora]++;
  });

  const valores = horarios.map(h => contagem[h]);
  const max = Math.max(...valores);

  // Colore o pico em laranja
  const cores = valores.map(v => v === max && max > 0 ? "#f59e0b" : "#0ea5e9");

  desenharGrafico("graficoHorarios", {
    type: "bar",
    data: {
      labels: horarios,
      datasets: [{
        label: "Consultas",
        data: valores,
        backgroundColor: cores,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 }
        },
        x: {
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
}

// ===================================================================
// ====================  HELPERS DE GRÁFICO  =========================
// ===================================================================

function desenharGrafico(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroi gráfico anterior se existir
  if (graficos[canvasId]) {
    graficos[canvasId].destroy();
  }

  graficos[canvasId] = new Chart(canvas, config);
}

function mostrarVazio(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (graficos[canvasId]) {
    graficos[canvasId].destroy();
    graficos[canvasId] = null;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Sem dados no período", canvas.width / 2, canvas.height / 2);
}

// ===================================================================
// =====================  HELPERS DE DATA  ===========================
// ===================================================================

function paraISO(data) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ===================================================================
// =========================  LOGOUT  ================================
// ===================================================================

document.getElementById("btnLogout").addEventListener("click", () => {
  if (confirm("Deseja sair?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "login.html";
  }
});

// ===================================================================
// =================  TAXA DE CANCELAMENTO  ==========================
// ===================================================================

function calcularTaxaCancelamento(consultas) {
  if (consultas.length === 0) return 0;

  const canceladas = consultas.filter(c =>
    c.status === "cancelada" || c.status === "faltou"
  ).length;

  return Math.round((canceladas / consultas.length) * 100);
}

// ===================================================================
// ============  COMPARAÇÃO MÊS ATUAL vs ANTERIOR  ===================
// ===================================================================

function calcularComparativoMensal() {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

  const contarMes = (mes, ano) =>
    todasConsultas.filter(c => {
      const [a, m] = c.data.split("-").map(Number);
      return (m - 1) === mes && a === ano;
    }).length;

  const atual = contarMes(mesAtual, anoAtual);
  const anterior = contarMes(mesAnterior, anoAnterior);

  if (anterior === 0) {
    return { atual, anterior, variacao: atual > 0 ? 100 : 0 };
  }

  const variacao = Math.round(((atual - anterior) / anterior) * 100);
  return { atual, anterior, variacao };
}

// ===================================================================
// =============  PACIENTES NOVOS vs RECORRENTES  ====================
// ===================================================================

function calcularNovosRecorrentes(consultas) {
  // Agrupa por CPF ou nome (fallback)
  const porPaciente = {};

  consultas.forEach(c => {
    const chave = c.cpf || c.nome.toLowerCase();
    if (!porPaciente[chave]) porPaciente[chave] = [];
    porPaciente[chave].push(c);
  });

  let novos = 0;
  let recorrentes = 0;

  Object.values(porPaciente).forEach(lista => {
    if (lista.length === 1) novos++;
    else recorrentes++;
  });

  return { novos, recorrentes, total: novos + recorrentes };
}

// ===================================================================
// =================  EXPORTAR CSV  ==================================
// ===================================================================

function exportarCSV() {
  const consultas = filtrarConsultas();

  if (consultas.length === 0) {
    alert("Não há dados para exportar.");
    return;
  }

  // Cabeçalho
  const colunas = [
    "ID", "Nome", "Telefone", "Email", "CPF",
    "Especialidade", "Profissional", "Sala",
    "Data", "Hora", "Duração (min)", "Status", "Origem"
  ];

  const linhas = consultas.map(c => {
    const prof = todosProfissionais.find(p => p.id === c.profissionalId);
    return [
      c.id,
      c.nome,
      c.telefone || "",
      c.email || "",
      c.cpf || "",
      c.especialidade,
      prof ? prof.nome : c.profissionalId,
      c.salaId,
      c.data,
      c.hora,
      c.duracao || 30,
      c.status || "confirmada",
      c.origem || "presencial"
    ];
  });

  const csv = [colunas, ...linhas]
    .map(linha => linha.map(campo => {
      const str = String(campo).replace(/"/g, '""');
      return `"${str}"`;
    }).join(","))
    .join("\n");

  // BOM UTF-8 pra Excel abrir certo
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===================================================================
// =================  IMPRIMIR / PDF  ================================
// ===================================================================

function imprimirDashboard() {
  window.print();
}

// ===================================================================
// =========================  INICIAR  ===============================
// ===================================================================

iniciarDashboard();
