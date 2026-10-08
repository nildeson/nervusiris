// ===================================================================
// ====================  PROTEÇÃO DE ROTA  ===========================
// ===================================================================
const _token = localStorage.getItem("token");
if (!_token) {
  window.location.href = "login.html";
  // Interrompe a execução do resto do app.js
  throw new Error("Redirecionando para login...");
}

const _usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
// ===================================================================
// ====================  AGENDA SAÚDE — app.js  ======================
// ====================  (versão com API)  ===========================
// ===================================================================

// ===== Configurações =====
const CONFIG = {
  intervaloMinimo: 30,
  horaAbertura: "08:00",
  horaFechamento: "18:00",
  permitirDataPassada: false
};

// ===== Cadastros =====
let PROFISSIONAIS = [];


const SALAS = [
  { id: "s1", nome: "Sala 1 - Refração" },
  { id: "s2", nome: "Sala 2 - Refração" },
  { id: "s3", nome: "Sala 3 - Consultório" },
  { id: "s4", nome: "Sala 4 - Odontologia" },
  { id: "s5", nome: "Sala 5 - Psicologia" }
];

const DURACOES = {
  "Optometria":      30,
  "Oftalmologia":    30,
  "Clínica Geral":   30,
  "Odontologia":     45,
  "Psicologia":      50
};

function duracaoDaEspecialidade(esp) {
  return DURACOES[esp] || 30;
}

// ===== Estado (cache em memória) =====
let consultas = [];

// ===== Elementos =====
const form = document.getElementById("formConsulta");
const lista = document.getElementById("listaConsultas");
const semConsultas = document.getElementById("semConsultas");
const busca = document.getElementById("busca");
const filtroEsp = document.getElementById("filtroEspecialidade");

// ===================================================================
// =======================  HELPERS  =================================
// ===================================================================

function paraMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutosParaHora(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function nomeProfissional(id) {
  return PROFISSIONAIS.find(p => p.id === id)?.nome || "—";
}

function nomeSala(id) {
  return SALAS.find(s => s.id === id)?.nome || "—";
}

// ===== Descobre se o usuário logado é admin =====
function souAdmin() {
  return _usuario && _usuario.papel === "admin";
}

// ===================================================================
// ==================  CARREGAR DADOS DA API  ========================
// ===================================================================

async function carregarConsultas() {
  try {
    consultas = await API.listarConsultas();
    renderizar();
    renderizarCalendario();
    atualizarFiltroEspecialidades();
  } catch (err) {
    console.error("Erro ao carregar consultas:", err);
    alert("❌ Não foi possível carregar as consultas.\n" +
          "Verifique se o servidor backend está rodando (node server.js).");
  }
}

// ===================================================================
// =============  CARREGAR PROFISSIONAIS DA API  =====================
// ===================================================================

async function carregarProfissionais() {
  try {
    PROFISSIONAIS = await API.listarProfissionais();
    console.log("✅ Profissionais carregados:", PROFISSIONAIS.length);
  } catch (err) {
    console.error("❌ Erro ao carregar profissionais:", err);
    PROFISSIONAIS = [];
  }
}

// ===================================================================
// =======================  VALIDAÇÃO  ===============================
// ===================================================================

function validarConflitos(nova) {
  const erros = [];

  if (!CONFIG.permitirDataPassada) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(`${nova.data}T00:00`) < hoje) {
      erros.push("❌ Não é possível agendar em data passada.");
    }
  }

  const minutosNova = paraMinutos(nova.hora);
  const duracaoNova = nova.duracao || duracaoDaEspecialidade(nova.especialidade);
  const minutosFim = minutosNova + duracaoNova;

  if (
    minutosNova < paraMinutos(CONFIG.horaAbertura) ||
    minutosFim > paraMinutos(CONFIG.horaFechamento)
  ) {
    erros.push(
      `❌ Horário fora do atendimento (${CONFIG.horaAbertura} às ${CONFIG.horaFechamento}).`
    );
  }

  const profissional = PROFISSIONAIS.find(p => p.id === nova.profissionalId);
  if (!profissional) {
    erros.push("❌ Selecione um profissional válido.");
    return erros;
  }

  const sala = SALAS.find(s => s.id === nova.salaId);
  if (!sala) {
    erros.push("❌ Selecione uma sala válida.");
    return erros;
  }

  if (profissional.especialidade !== nova.especialidade) {
    erros.push(
      `❌ ${profissional.nome} não atende ${nova.especialidade}.`
    );
  }

  function seSobrepoe(inicioA, duracaoA, inicioB, duracaoB) {
    const fimA = inicioA + duracaoA;
    const fimB = inicioB + duracaoB;
    return inicioA < fimB && inicioB < fimA;
  }

  const conflitoProf = consultas.find(c => {
    if (c.id === nova.id) return false;
    if (c.data !== nova.data) return false;
    if (c.profissionalId !== nova.profissionalId) return false;
    const inicioOutro = paraMinutos(c.hora);
    const duracaoOutro = c.duracao || 30;
    return seSobrepoe(minutosNova, duracaoNova, inicioOutro, duracaoOutro);
  });

  if (conflitoProf) {
    erros.push(
      `⚠️ ${profissional.nome} já tem consulta em ${formatarData(nova.data)} ` +
      `às ${conflitoProf.hora} (${conflitoProf.nome}).`
    );
  }

  const conflitoSala = consultas.find(c => {
    if (c.id === nova.id) return false;
    if (c.data !== nova.data) return false;
    if (c.salaId !== nova.salaId) return false;
    const inicioOutro = paraMinutos(c.hora);
    const duracaoOutro = c.duracao || 30;
    return seSobrepoe(minutosNova, duracaoNova, inicioOutro, duracaoOutro);
  });

  if (conflitoSala) {
    erros.push(
      `⚠️ ${sala.nome} já está ocupada em ${formatarData(nova.data)} ` +
      `às ${conflitoSala.hora} com ${conflitoSala.nome}.`
    );
  }

  return erros;
}

// ===================================================================
// =======================  LISTA  ===================================
// ===================================================================

function renderizar() {
  const termo = busca.value.toLowerCase();
  const especialidadeFiltro = filtroEsp.value;

  const filtradas = consultas
    .filter(c => c.nome.toLowerCase().includes(termo))
    .filter(c => !especialidadeFiltro || c.especialidade === especialidadeFiltro)
    .sort((a, b) => new Date(`${a.data}T${a.hora}`) - new Date(`${b.data}T${b.hora}`));

  lista.innerHTML = "";

  if (filtradas.length === 0) {
    semConsultas.classList.remove("escondido");
    return;
  }
  semConsultas.classList.add("escondido");

  filtradas.forEach(c => {
    const li = document.createElement("li");
    li.className = "consulta";
    li.innerHTML = `
  <div class="consulta-info">
    <strong>${c.nome}</strong>
    <small>🩺 ${c.especialidade} (${c.duracao || 30}min) • 📅 ${formatarData(c.data)} às ${c.hora}</small>
    <small>👨‍⚕️ ${nomeProfissional(c.profissionalId)} • 🚪 ${nomeSala(c.salaId)}</small>
    <small>📞 ${c.telefone}${c.obs ? " • 📝 " + c.obs : ""}</small>
    <small>📞 ${c.telefone}${c.email ? " • ✉️ " + c.email : ""}${c.obs ? " • 📝 " + c.obs : ""}</small>
  </div>
  <div class="consulta-acoes">
    ${c.telefone ? `<button class="btn-whats" onclick="enviarWhats(event, ${c.id})" title="Enviar WhatsApp">💬</button>` : ""}
    <button class="btn-cancelar" onclick="cancelarConsulta(${c.id})" title="Cancelar consulta">✕</button>
  </div>
`;
    lista.appendChild(li);
  });
}

// ===================================================================
// =====================  FEEDBACK (UI)  =============================
// ===================================================================

function mostrarErros(erros) {
  const box = document.getElementById("erros");
  box.innerHTML = erros.map(e => `<p>${e}</p>`).join("");
  box.classList.add("visivel");
  clearTimeout(mostrarErros._timer);
  mostrarErros._timer = setTimeout(() => box.classList.remove("visivel"), 6000);
}

function mostrarSucesso(msg) {
  const box = document.getElementById("erros");
  box.innerHTML = `<p>${msg}</p>`;
  box.classList.add("visivel", "sucesso");
  clearTimeout(mostrarSucesso._timer);
  mostrarSucesso._timer = setTimeout(() => box.classList.remove("visivel", "sucesso"), 4000);
}

// ===================================================================
// =====================  CRIAR (POST)  ==============================
// ===================================================================
// ===== Arredonda uma hora para o slot mais próximo (30 min) =====
function arredondarParaSlot(hora, intervaloMin = 30) {
  const [h, m] = hora.split(":").map(Number);
  const minutosTotais = h * 60 + m;
  const arredondado = Math.round(minutosTotais / intervaloMin) * intervaloMin;
  const novaH = String(Math.floor(arredondado / 60) % 24).padStart(2, "0");
  const novaM = String(arredondado % 60).padStart(2, "0");
  return `${novaH}:${novaM}`;
}

form.addEventListener("submit", async e => {
  e.preventDefault();

  const nova = {
    nome: document.getElementById("nome").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    email: document.getElementById("email").value.trim(),
    pacienteId: pacienteSelecionado ? pacienteSelecionado.id : null, 
    especialidade: document.getElementById("especialidade").value,
    profissionalId: document.getElementById("profissional").value,
    salaId: document.getElementById("sala").value,
    data: document.getElementById("data").value,
    //hora: document.getElementById("hora").value,
    hora: arredondarParaSlot(document.getElementById("hora").value),
    obs: document.getElementById("obs").value.trim(),
    duracao: duracaoDaEspecialidade(document.getElementById("especialidade").value),
    status: "confirmada",
    origem: "presencial"
  };

  const erros = validarConflitos(nova);
  if (erros.length > 0) {
    mostrarErros(erros);
    return;
  }

  try {
    const criada = await API.criarConsulta(nova);
    consultas.push(criada);
    renderizar();
    renderizarCalendario();
    atualizarFiltroEspecialidades();
    form.reset();
    mostrarSucesso(`✅ Consulta de ${criada.nome} agendada.`);
  } catch (err) {
    console.error(err);
    mostrarErros([`❌ Erro ao salvar no servidor: ${err.message}`]);
  }
});

// ===================================================================
// =====================  REMOVER (DELETE)  ==========================
// ===================================================================

async function remover(id) {
  if (!confirm("Deseja cancelar esta consulta?")) return;

  try {
    await API.removerConsulta(id);
    consultas = consultas.filter(c => c.id !== id);
    renderizar();
    renderizarCalendario();
    atualizarFiltroEspecialidades();
  } catch (err) {
    console.error(err);
    alert("❌ Erro ao remover: " + err.message);
  }
}

// ===================================================================
// ======================  CALENDÁRIO  ===============================
// ===================================================================

const CAL = {
  semanaAtual: inicioDaSemana(new Date()),
  diasSemana: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  horaInicio: 8,
  horaFim: 18,
  intervalo: 30
};

function inicioDaSemana(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDias(data, n) {
  const d = new Date(data);
  d.setDate(d.getDate() + n);
  return d;
}

function paraISO(data) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mesmoDia(a, b) {
  return paraISO(a) === paraISO(b);
}

function gerarHorarios() {
  const slots = [];
  for (let h = CAL.horaInicio; h < CAL.horaFim; h++) {
    for (let m = 0; m < 60; m += CAL.intervalo) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function renderizarCalendario() {
  const cal = document.getElementById("calendario");
  if (!cal) return;

  const hoje = new Date();
  cal.innerHTML = "";

  // Substituir a parte de pegar os filtros por:
const filtroProf = souAdmin() ? (document.getElementById("calFiltroProf")?.value || "") : "";
const filtroSala = document.getElementById("calFiltroSala")?.value || "";
const filtroEsp  = document.getElementById("calFiltroEsp")?.value  || "";

  const consultasFiltradas = consultas.filter(c =>
    (!filtroProf || c.profissionalId === filtroProf) &&
    (!filtroSala || c.salaId === filtroSala) &&
    (!filtroEsp  || c.especialidade === filtroEsp)
  );

  const fim = addDias(CAL.semanaAtual, 6);
  document.getElementById("tituloSemana").textContent =
    `${CAL.semanaAtual.getDate()}/${CAL.semanaAtual.getMonth() + 1} – ` +
    `${fim.getDate()}/${fim.getMonth() + 1} de ${fim.getFullYear()}`;

  cal.appendChild(criarCelula("", "cal-cabecalho"));
  for (let i = 0; i < 7; i++) {
    const dia = addDias(CAL.semanaAtual, i);
    const classe = mesmoDia(dia, hoje) ? "cal-cabecalho hoje" : "cal-cabecalho";
    cal.appendChild(criarCelula(
      `${CAL.diasSemana[i]}<br><small>${dia.getDate()}/${dia.getMonth() + 1}</small>`,
      classe
    ));
  }

  const horarios = gerarHorarios();
  horarios.forEach(hora => {
    cal.appendChild(criarCelula(hora, "cal-hora"));

    for (let i = 0; i < 7; i++) {
      const dia = addDias(CAL.semanaAtual, i);
      const iso = paraISO(dia);
      const consultasNoSlot = consultasFiltradas.filter(c => c.data === iso && c.hora === hora);

      const slot = document.createElement("div");
      slot.className = "cal-slot";

      if (consultasNoSlot.length > 0) {
        slot.classList.add("ocupado");
        slot.innerHTML = consultasNoSlot.map(c => `
          <div class="slot-item" data-esp="${c.especialidade}" data-prof="${c.profissionalId}" data-id="${c.id}">
            <span class="slot-nome">${c.nome}</span>
            <span class="slot-esp">${c.especialidade} • ${c.duracao || 30}min • ${nomeSala(c.salaId)}</span>
          </div>
        `).join("");

        slot.title = consultasNoSlot.map(c =>
          `${c.nome} • ${c.especialidade} (${c.duracao || 30} min)\n` +
          `${nomeProfissional(c.profissionalId)} • ${nomeSala(c.salaId)}\n` +
          `${c.telefone}`
        ).join("\n─────────────\n");

        slot.addEventListener("click", (e) => {
          const itemEl = e.target.closest(".slot-item");
          if (itemEl) {
            abrirModal(Number(itemEl.dataset.id));
          } else if (consultasNoSlot.length === 1) {
            abrirModal(consultasNoSlot[0].id);
          }
        });
      } else {
        slot.classList.add("livre");
        slot.addEventListener("click", () => preencherFormulario(iso, hora));
      }

      cal.appendChild(slot);
    }
  });
}

function criarCelula(conteudo, classe) {
  const el = document.createElement("div");
  el.className = classe;
  el.innerHTML = conteudo;
  return el;
}

function preencherFormulario(dataISO, hora) {
  document.getElementById("data").value = dataISO;
  document.getElementById("hora").value = hora;
  document.getElementById("nome").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===================================================================
// ====================  NAVEGAÇÃO DO CALENDÁRIO  ====================
// ===================================================================

document.getElementById("semanaAnterior").addEventListener("click", () => {
  CAL.semanaAtual = addDias(CAL.semanaAtual, -7);
  renderizarCalendario();
});

document.getElementById("semanaProxima").addEventListener("click", () => {
  CAL.semanaAtual = addDias(CAL.semanaAtual, 7);
  renderizarCalendario();
});

document.getElementById("semanaAtual").addEventListener("click", () => {
  CAL.semanaAtual = inicioDaSemana(new Date());
  renderizarCalendario();
});

// ===================================================================
// ====================  TOGGLE LISTA / CALENDÁRIO  ==================
// ===================================================================

const btnLista = document.getElementById("btnLista");
const btnCalendario = document.getElementById("btnCalendario");
const viewLista = document.getElementById("viewLista");
const viewCalendario = document.getElementById("viewCalendario");

btnLista.addEventListener("click", () => {
  btnLista.classList.add("ativo");
  btnCalendario.classList.remove("ativo");
  viewLista.classList.remove("escondido");
  viewCalendario.classList.add("escondido");
});

btnCalendario.addEventListener("click", () => {
  btnCalendario.classList.add("ativo");
  btnLista.classList.remove("ativo");
  viewCalendario.classList.remove("escondido");
  viewLista.classList.add("escondido");
  renderizarCalendario();
});

// ===================================================================
// =====================  SELECTS E FILTROS  =========================
// ===================================================================

function popularProfissionaisESalas() {
  const selProf = document.getElementById("profissional");
  const selSala = document.getElementById("sala");

  // Se for profissional, só pode escolher ele mesmo
  if (!souAdmin()) {
    const eu = PROFISSIONAIS.find(p => p.id === _usuario.profissionalId);
    selProf.innerHTML = "";
    if (eu) {
      const opt = document.createElement("option");
      opt.value = eu.id;
      opt.textContent = `${eu.nome} (${eu.especialidade})`;
      selProf.appendChild(opt);
      selProf.value = eu.id;
    }
    selProf.disabled = true;

    // Sala ainda pode escolher qualquer uma
    selSala.innerHTML = '<option value="">Selecione...</option>';
    SALAS.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nome;
      selSala.appendChild(opt);
    });
    return;
  }

  // Admin: dropdown completo, como antes
  selProf.innerHTML = '<option value="">Selecione...</option>';
  PROFISSIONAIS.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.nome} (${p.especialidade})`;
    selProf.appendChild(opt);
  });

  selSala.innerHTML = '<option value="">Selecione...</option>';
  SALAS.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nome;
    selSala.appendChild(opt);
  });
}

function popularFiltrosCalendario() {
  function popularFiltrosCalendario() {
  const selProf = document.getElementById("calFiltroProf");
  const selSala = document.getElementById("calFiltroSala");
  const selEsp  = document.getElementById("calFiltroEsp");
  if (!selProf || !selSala || !selEsp) return;

  // Se for profissional, esconde o filtro de profissional
  if (!souAdmin()) {
    selProf.style.display = "none";
  }
  // ... resto igual
}
  const selProf = document.getElementById("calFiltroProf");
  const selSala = document.getElementById("calFiltroSala");
  const selEsp  = document.getElementById("calFiltroEsp");
  if (!selProf || !selSala || !selEsp) return;

  selProf.innerHTML = '<option value="">👨‍⚕️ Todos profissionais</option>';
  PROFISSIONAIS.forEach(p => {
    selProf.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });

  selSala.innerHTML = '<option value="">🚪 Todas as salas</option>';
  SALAS.forEach(s => {
    selSala.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
  });

  selEsp.innerHTML = '<option value="">🩺 Todas especialidades</option>';
  [...new Set(PROFISSIONAIS.map(p => p.especialidade))].forEach(e => {
    selEsp.innerHTML += `<option value="${e}">${e}</option>`;
  });
}

["calFiltroProf", "calFiltroSala", "calFiltroEsp"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", renderizarCalendario);
});

document.getElementById("especialidade").addEventListener("change", e => {
  const esp = e.target.value;
  const selProf = document.getElementById("profissional");
  selProf.innerHTML = '<option value="">Selecione...</option>';
  PROFISSIONAIS.filter(p => !esp || p.especialidade === esp).forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nome;
    selProf.appendChild(opt);
  });

  const dur = duracaoDaEspecialidade(esp);
  const elDur = document.getElementById("duracaoInfo");
  if (elDur) elDur.value = dur ? dur + " minutos" : "";
});

busca.addEventListener("input", renderizar);
filtroEsp.addEventListener("change", renderizar);

function atualizarFiltroEspecialidades() {
  const especialidades = [...new Set(consultas.map(c => c.especialidade))];
  const valorAtual = filtroEsp.value;
  filtroEsp.innerHTML = '<option value="">Todas especialidades</option>';
  especialidades.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    filtroEsp.appendChild(opt);
  });
  filtroEsp.value = valorAtual;
}

// ===================================================================
// ======================  EXPORTAR / IMPORTAR  ======================
// ===================================================================

document.getElementById("btnExportar").addEventListener("click", () => {
  const dados = {
    versao: 2,
    exportadoEm: new Date().toISOString(),
    consultas
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agenda-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btnImportar").addEventListener("click", () => {
  document.getElementById("arquivoImport").click();
});

document.getElementById("arquivoImport").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      const lista_imp = Array.isArray(dados) ? dados : dados.consultas;

      if (!Array.isArray(lista_imp)) {
        alert("❌ Arquivo inválido.");
        return;
      }

      if (!confirm(`📦 ${lista_imp.length} consultas encontradas.\nImportar para o servidor?`)) return;

      let importadas = 0;
      for (const c of lista_imp) {
        // Remove id para o servidor gerar novo
        const { id, ...semId } = c;
        try {
          await API.criarConsulta(semId);
          importadas++;
        } catch (err) {
          console.warn("Falha ao importar:", c.nome, err.message);
        }
      }

      await carregarConsultas();
      alert(`✅ ${importadas} consultas importadas!`);
    } catch (err) {
      alert("❌ Erro ao ler o arquivo: " + err.message);
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ===================================================================
// ======================  MODAL DE EDIÇÃO  ==========================
// ===================================================================

const modal = document.getElementById("modalEdicao");
const formEdicao = document.getElementById("formEdicao");
const editErrosBox = document.getElementById("editErros");

function popularSelectsModal() {
  const selProf = document.getElementById("editProfissional");
  const selSala = document.getElementById("editSala");
  if (!selProf || !selSala) return;

  selProf.innerHTML = '<option value="">Selecione...</option>';
  PROFISSIONAIS.forEach(p => {
    selProf.innerHTML += `<option value="${p.id}">${p.nome} (${p.especialidade})</option>`;
  });

  selSala.innerHTML = '<option value="">Selecione...</option>';
  SALAS.forEach(s => {
    selSala.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
  });
}
function abrirModal(id) {
  const c = consultas.find(x => x.id === id);
  if (!c) return;

  const set = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.value = valor ?? "";
  };

  set("editId", c.id);
  set("editNome", c.nome);
  set("editTelefone", c.telefone);
  set("editEmail", c.email || "");
  set("editEspecialidade", c.especialidade);
  set("editProfissional", c.profissionalId);
  set("editSala", c.salaId);
  set("editData", c.data);
  set("editHora", c.hora);
  set("editObs", c.obs || "");
  set("editDuracao", (c.duracao || 30) + " minutos");

  // Triagem
  const box = document.getElementById("editTriagemBox");
  const conteudo = document.getElementById("editTriagemConteudo");

  if (box && conteudo && c.triagem) {
    const t = c.triagem;
    const urgClasse = (t.urgencia || "").toLowerCase() === "alta" ? "urgente"
                    : (t.urgencia || "").toLowerCase() === "média" ? "medio"
                    : "baixo";

    let html = `
      <p><strong>Motivo:</strong> ${t.motivo || "—"}</p>
      <p><strong>Tempo:</strong> ${t.tempo || "—"}</p>
      <p><strong>Urgência:</strong> <span class="badge ${urgClasse}">${t.urgencia || "—"}</span></p>
      <p><strong>Condições:</strong> ${
        [
          t.diabete && "diabetes", t.hipertensao && "hipertensão",
          t.cirurgia && "cirurgia ocular", t.alergia && "alergia",
          t.lentes && "usa lentes", t.oculos && "usa óculos"
        ].filter(Boolean).join(", ") || "nenhuma"
      }</p>
      ${t.medicamentos ? `<p><strong>Medicamentos:</strong> ${t.medicamentos}</p>` : ""}
      ${t.acuidade ? `<p><strong>👁️ Acuidade informada:</strong> ${t.acuidade}</p>` : ""}
    `;

    if (t.oftalmo) {
      html += `
        <hr style="margin:10px 0; border:none; border-top:1px solid #cbd5e1;">
        <p><strong>👁️ Oftalmo:</strong></p>
        <p>Dificuldade: <strong>${t.oftalmo.dificuldade || "—"}</strong></p>
        <p>Telas/dia: <strong>${t.oftalmo.telas || "—"}</strong></p>
        <p>Usa óculos/lentes há: <strong>${t.oftalmo.tempoOculos || "—"}</strong></p>
        <p>Outros: ${
          [
            t.oftalmo.ultimoExame && "exame > 2 anos",
            t.oftalmo.familiar && "familiar c/ glaucoma",
            t.oftalmo.luz && "sensibilidade à luz",
            t.oftalmo.coceira && "coceira",
            t.oftalmo.olhoSeco && "olho seco"
          ].filter(Boolean).join(", ") || "nenhum"
        }</p>
      `;
    }

    if (c.lgpd && c.lgpd.aceito) {
      html += `<p style="color:#22c55e; margin-top:8px;">✅ LGPD aceita em ${new Date(c.lgpd.dataAceite).toLocaleString("pt-BR")}</p>`;
    }

    conteudo.innerHTML = html;
    box.classList.remove("escondido");
  } else if (box) {
    box.classList.add("escondido");
  }

  editErrosBox.innerHTML = "";
  editErrosBox.classList.remove("visivel");

  const hoje = new Date().toISOString().split("T")[0];
  const elData = document.getElementById("editData");
  if (elData) elData.setAttribute("min", hoje);

  modal.classList.remove("escondido");
}

function fecharModal() {
  modal.classList.add("escondido");
  formEdicao.reset();
  editErrosBox.innerHTML = "";
  editErrosBox.classList.remove("visivel");
}

// ===================================================================
// ====================  ENVIAR WHATSAPP  ============================
// ===================================================================

function enviarWhats(event, id) {
  event.stopPropagation();

  const c = consultas.find(x => x.id === id);
  if (!c || !c.telefone) return;

  let numero = c.telefone.replace(/\D/g, "");
  if (!numero.startsWith("55")) numero = "55" + numero;

  const dataBr = formatarData(c.data);
  const profissional = nomeProfissional(c.profissionalId);

  // Emojis via Unicode — imunes a qualquer problema de encoding
  const EMOJI_ONDA    = "\u{1F44B}";
  const EMOJI_DATA    = "\u{1F4C5}";
  const EMOJI_RELOGIO = "\u{1F550}";
  const EMOJI_ESTETO  = "\u{1FA7A}";
  const EMOJI_MEDICO  = "\u{1F468}\u200D\u2695\uFE0F";

  const mensagem =
    "Olá, *" + c.nome + "*! " + EMOJI_ONDA + "\n\n" +
    "Sua consulta está agendada:\n\n" +
    EMOJI_DATA    + " *Data:* " + dataBr + "\n" +
    EMOJI_RELOGIO + " *Horário:* " + c.hora + "\n" +
    EMOJI_ESTETO  + " *Especialidade:* " + c.especialidade + "\n" +
    EMOJI_MEDICO  + " *Profissional:* " + profissional + "\n\n" +
    "Por favor, confirme sua presença respondendo esta mensagem.\n\n" +
    "_Nervus Iris_";

  const url = "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensagem);
  window.open(url, "_blank");
}

document.getElementById("modalFechar").addEventListener("click", fecharModal);
document.getElementById("btnFecharModal").addEventListener("click", fecharModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) fecharModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("escondido")) fecharModal();
});

document.getElementById("editEspecialidade").addEventListener("change", (e) => {
  const dur = duracaoDaEspecialidade(e.target.value);
  const el = document.getElementById("editDuracao");
  if (el) el.value = dur + " minutos";
});

formEdicao.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = Number(document.getElementById("editId").value);
  const atualizada = {
    nome: document.getElementById("editNome").value.trim(),
    telefone: document.getElementById("editTelefone").value.trim(),
    email: document.getElementById("editEmail").value.trim() || null,   // 🆕 FALTA ESSA
    especialidade: document.getElementById("editEspecialidade").value,
    profissionalId: document.getElementById("editProfissional").value,
    salaId: document.getElementById("editSala").value,
    data: document.getElementById("editData").value,
    hora: document.getElementById("editHora").value,
    obs: document.getElementById("editObs").value.trim(),
    duracao: duracaoDaEspecialidade(document.getElementById("editEspecialidade").value)
  };

  const erros = validarConflitos({ ...atualizada, id });
  if (erros.length > 0) {
    editErrosBox.innerHTML = erros.map(msg => `<p>${msg}</p>`).join("");
    editErrosBox.classList.add("visivel");
    return;
  }

  try {
    // Preserva campos não editáveis (triagem, lgpd, status, origem)
    const original = consultas.find(c => c.id === id);
    const payload = { ...original, ...atualizada };

    const salva = await API.atualizarConsulta(id, payload);

    const idx = consultas.findIndex(c => c.id === id);
    if (idx >= 0) consultas[idx] = salva;

    renderizar();
    renderizarCalendario();
    atualizarFiltroEspecialidades();
    fecharModal();
  } catch (err) {
    console.error(err);
    editErrosBox.innerHTML = `<p>❌ Erro ao salvar: ${err.message}</p>`;
    editErrosBox.classList.add("visivel");
  }
});

document.getElementById("btnCancelarConsulta").addEventListener("click", async () => {
  const id = Number(document.getElementById("editId").value);
  const c = consultas.find(x => x.id === id);
  if (!c) return;

  if (confirm(`Cancelar a consulta de ${c.nome}?`)) {
    await remover(id);
    fecharModal();
  }
});

document.getElementById("btnWhatsModal").addEventListener("click", () => {
  const id = Number(document.getElementById("editId").value);
  if (id) enviarWhats({ stopPropagation: () => {} }, id);
});

// ===================================================================
// =================  CANCELAR CONSULTA (soft)  ======================
// ===================================================================

async function cancelarConsulta(id) {
  if (!confirm("Cancelar esta consulta? (ela continuará no histórico)")) return;

  const c = consultas.find(x => x.id === id);
  if (!c) return;

  try {
    const atualizada = { ...c, status: "cancelada" };
    await API.atualizarConsulta(id, atualizada);

    const idx = consultas.findIndex(x => x.id === id);
    if (idx >= 0) consultas[idx] = atualizada;

    renderizar();
    renderizarCalendario();
  } catch (err) {
    console.error(err);
    alert("Erro ao cancelar: " + err.message);
  }
}

// ===================================================================
// ===========================  INIT  ================================
// ===================================================================

// ===== INIT =====
async function iniciarApp() {
  const hoje = new Date().toISOString().split("T")[0];
  document.getElementById("data").setAttribute("min", hoje);

  // 1. Carrega profissionais PRIMEIRO
  await carregarProfissionais();

  // 2. Agora popula tudo (usa PROFISSIONAIS já carregado)
  popularProfissionaisESalas();
  popularFiltrosCalendario();
  popularSelectsModal();

  // 3. Depois carrega as consultas
  await carregarConsultas();
  await carregarWhatsEmpresa(); 
}

iniciarApp();

// ===== Carrega WhatsApp da empresa =====
async function carregarWhatsEmpresa() {
  try {
    const empresa = await API.buscarMinhaEmpresa();
    const link = document.getElementById("linkWhatsEmpresa");

    if (link && empresa.whatsapp) {
      // Limpa e adiciona 55 se necessário
      let num = empresa.whatsapp.replace(/\D/g, "");
      if (!num.startsWith("55")) num = "55" + num;

      link.href = "https://wa.me/" + num;
      link.style.display = "inline-block";
      link.title = "Falar no WhatsApp da clínica";
    }
  } catch (err) {
    console.error("Erro ao carregar WhatsApp da empresa:", err);
  }
}

// ===== REGISTRO PWA (só em produção) =====
const emProducao = location.hostname !== "127.0.0.1" && location.hostname !== "localhost";
if ("serviceWorker" in navigator && emProducao) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("✅ SW registrado:", reg.scope))
      .catch((err) => console.warn("❌ Falha ao registrar SW:", err));
  });
}

// ===== Mostrar nome do usuário logado =====

const elNome = document.getElementById("nomeUsuario");
const elPapel = document.getElementById("papelUsuario");
if (elNome && _usuario.nome) {
  elNome.textContent = _usuario.nome;
}
if (elPapel) {
  elPapel.textContent = souAdmin() ? "Admin" : "";
}

// ===== Mostrar link admin só pra admin =====
const linkAdmin = document.getElementById("linkAdmin");
if (linkAdmin && souAdmin()) {
  linkAdmin.style.display = "inline-block";
}

// ===== Mostrar link dashboard só pra admin =====
const linkDashboard = document.getElementById("linkDashboard");
if (linkDashboard && souAdmin()) {
  linkDashboard.style.display = "inline-block";
}

// ===== Botão de logout =====
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    if (confirm("Deseja sair?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.href = "login.html";
    }
  });
}

// ===== Mostrar link super admin =====
const linkSuper = document.getElementById("linkSuper");
if (linkSuper && _usuario.papel === "super") {
  linkSuper.style.display = "inline-block";
}

// ===== Mostrar usuário logado =====

// ===================================================================
// ==================  AUTOCOMPLETE DE PACIENTE  =====================
// ===================================================================

const buscaPacienteEl = document.getElementById("buscaPaciente");
const sugestoesEl = document.getElementById("sugestoesPaciente");

let timerBuscaPaciente = null;
let pacientesCache = [];
let pacienteSelecionado = null;
let sugestaoAtiva = -1;

if (buscaPacienteEl) {
  buscaPacienteEl.addEventListener("input", (e) => {
    const termo = e.target.value.trim();
    clearTimeout(timerBuscaPaciente);

    if (termo.length < 2) {
      fecharSugestoes();
      return;
    }

    timerBuscaPaciente = setTimeout(() => buscarPacientesAutocomplete(termo), 250);
  });

  buscaPacienteEl.addEventListener("keydown", (e) => {
    if (sugestoesEl.classList.contains("escondido")) return;
    const itens = sugestoesEl.querySelectorAll(".sugestao-item");
    if (itens.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      sugestaoAtiva = Math.min(sugestaoAtiva + 1, itens.length - 1);
      atualizarSugestaoAtiva(itens);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      sugestaoAtiva = Math.max(sugestaoAtiva - 1, 0);
      atualizarSugestaoAtiva(itens);
    } else if (e.key === "Enter" && sugestaoAtiva >= 0) {
      e.preventDefault();
      itens[sugestaoAtiva].click();
    } else if (e.key === "Escape") {
      fecharSugestoes();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".campo-paciente")) fecharSugestoes();
  });
}

async function buscarPacientesAutocomplete(termo) {
  try {
    pacientesCache = await API.listarPacientes(termo);
    mostrarSugestoes(termo);
  } catch (err) {
    console.error("Erro na busca:", err);
  }
}

function mostrarSugestoes(termo) {
  sugestaoAtiva = -1;

  if (pacientesCache.length === 0) {
    sugestoesEl.innerHTML = `
      <div class="sugestao-item cadastrar" onclick="fecharSugestoes()">
        ➕ Nenhum paciente encontrado. Preencha os dados abaixo para cadastrar.
      </div>
    `;
    sugestoesEl.classList.remove("escondido");
    return;
  }

  sugestoesEl.innerHTML = pacientesCache.map((p, i) => `
    <div class="sugestao-item" data-index="${i}" onclick="selecionarPacienteAutocomplete(${i})">
      <strong>${p.nome}</strong>
      <small>
        ${p.cpf ? `📄 ${p.cpf}` : ""}
        ${p.telefone ? ` • 📞 ${p.telefone}` : ""}
        ${p.totalConsultas ? ` • 📅 ${p.totalConsultas} consulta${p.totalConsultas === 1 ? "" : "s"}` : ""}
      </small>
    </div>
  `).join("");

  sugestoesEl.classList.remove("escondido");
}

function atualizarSugestaoAtiva(itens) {
  itens.forEach((el, i) => el.classList.toggle("ativa", i === sugestaoAtiva));
  if (itens[sugestaoAtiva]) itens[sugestaoAtiva].scrollIntoView({ block: "nearest" });
}

function selecionarPacienteAutocomplete(index) {
  const p = pacientesCache[index];
  if (!p) return;

  pacienteSelecionado = p;

  document.getElementById("nome").value = p.nome || "";
  document.getElementById("telefone").value = p.telefone || "";
  document.getElementById("email").value = p.email || "";

  buscaPacienteEl.value = p.nome;
  buscaPacienteEl.classList.add("paciente-selecionado");

  fecharSugestoes();
  mostrarSucesso(`👤 Paciente "${p.nome}" selecionado.`);
}

function fecharSugestoes() {
  sugestoesEl.classList.add("escondido");
  sugestaoAtiva = -1;
}

const _resetOriginal = form.reset.bind(form);
form.reset = function() {
  _resetOriginal();
  pacienteSelecionado = null;
  if (buscaPacienteEl) {
    buscaPacienteEl.value = "";
    buscaPacienteEl.classList.remove("paciente-selecionado");
  }
  fecharSugestoes();
};

// ===================================================================
// ====================  BADGE DE TRIAL  =============================
// ===================================================================
async function carregarStatusTrial() {
  try {
    const status = await API.buscarStatusTrial();
    const badge = document.getElementById("badgeTrial");
    if (!badge) return;

    if (status.plano && status.plano !== "trial") {
      badge.style.display = "none";
      return;
    }

    if (status.expirado) {
      badge.textContent = "🔒 Trial expirado";
      badge.className = "badge-trial expirado";
      badge.style.display = "inline-flex";
      badge.title = "Clique para saber mais";
      badge.onclick = mostrarModalExpirado;

      setTimeout(mostrarModalExpirado, 2000);
      return;
    }

    const dias = status.diasRestantes;
    badge.style.display = "inline-flex";
    badge.textContent = `🎁 ${dias} dia${dias === 1 ? "" : "s"}`;
    badge.onclick = mostrarModalInfo;

    if (dias <= 1) {
      badge.className = "badge-trial critico";
    } else if (dias <= 5) {
      badge.className = "badge-trial urgente";
    } else if (dias <= 10) {
      badge.className = "badge-trial atencao";
    } else {
      badge.className = "badge-trial";
    }
  } catch (err) {
    console.error("Erro ao carregar status do trial:", err);
    
    // 🆕 Se for 402, mostra como expirado
    if (err.message && err.message.includes("402")) {
      const badge = document.getElementById("badgeTrial");
      if (badge) {
        badge.textContent = "🔒 Trial expirado";
        badge.className = "badge-trial expirado";
        badge.style.display = "inline-flex";
        badge.onclick = mostrarModalExpirado;
      }
    }
  }
}
// ===== Modal de aviso =====
function mostrarModalInfo() {
  const modal = document.createElement("div");
  modal.className = "trial-modal";
  modal.innerHTML = `
    <div class="trial-modal-box">
      <div class="icone">🎁</div>
      <h2>Seu trial está ativo</h2>
      <p>
        Você tem <strong>${window._trialDias || "—"} dias</strong> restantes do período de teste gratuito.
      </p>
      <div class="contato">
        <strong>💡 O que acontece depois?</strong><br>
        Quando o trial expirar, você precisará assinar um plano para continuar usando o sistema.
        Entre em contato para saber mais.
      </div>
      <button onclick="this.closest('.trial-modal').remove()" class="btn-primario">
        Entendi
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Fecha ao clicar fora
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

function mostrarModalExpirado() {
  const modal = document.createElement("div");
  modal.className = "trial-modal";
  modal.innerHTML = `
    <div class="trial-modal-box">
      <div class="icone">🔒</div>
      <h2>Trial expirado</h2>
      <p>
        Seu período de teste de 30 dias chegou ao fim.
        Para continuar usando o sistema, entre em contato e assine um plano.
      </p>
      <div class="contato">
        <strong>📞 Entre em contato:</strong><br>
        WhatsApp: <strong>(66) 98127-1789</strong><br>
        E-mail: <strong>contato@nervusiris.com.br</strong>
      </div>
      <button onclick="this.closest('.trial-modal').remove()" class="btn-primario">
        Entendi
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

async function carregarLogoHeader() {
  try {
    const empresa = await API.buscarMinhaEmpresa();
    const logo = document.getElementById("logoHeader");
    const nome = document.getElementById("nomeHeader");

    if (empresa.logoUrl) {
      logo.src = `http://localhost:3000${empresa.logoUrl}`;
      logo.style.display = "inline";
      if (nome) nome.textContent = empresa.nome;
    } else if (empresa.nome) {
      if (nome) nome.textContent = `👁️ ${empresa.nome}`;
    }
  } catch (err) {
    console.error("Erro ao carregar logo:", err);
  }
}
// Detecta a empresa pelo hostname
function detectarEmpresa() {
  const host = window.location.hostname;
  // ex: "visao-clara.nervusiris.com.br"

  const partes = host.split(".");
  if (partes.length >= 3 && partes[1] === "nervusiris") {
    return partes[0]; // retorna "visao-clara"
  }
  return null;
}

// Chama ao iniciar
carregarLogoHeader();

// Chama ao carregar
carregarStatusTrial();

// ===== Máscaras de input =====
aplicarMascaras();