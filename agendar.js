// ===================================================================
// ====================  AGENDAMENTO PÚBLICO  ========================
// ===================================================================
// ✅ Versão segura: usa rotas públicas /api/agenda/*
// ✅ NÃO expõe dados de pacientes
// ✅ NÃO exige login
// ✅ Resistente a bots (rate limit + confirmação)
// ===================================================================

// ===== Constantes =====
let PROFISSIONAIS = []; // carregado da API

const DURACOES = {
  "Optometria":      30,
  "Oftalmologia":    30,
  "Clínica Geral":   30,
  "Odontologia":     45,
  "Psicologia":      50
};

const CONFIG = {
  horaAbertura: "08:00",
  horaFechamento: "18:00",
  intervaloMinimo: 30
};

// ===== Estado =====
let slotSelecionado = null;

// ===== Máscaras =====
["pTelefone"].forEach(id => {
  const el = document.getElementById(id);
  if (el && typeof aplicarMascaraTelefone === "function") {
    aplicarMascaraTelefone(el);
  }
});

// ===================================================================
// =======================  UTILITÁRIOS  =============================
// ===================================================================

function paraMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function duracaoDaEspecialidade(esp) {
  return DURACOES[esp] || 30;
}

function gerarHorarios() {
  const slots = [];
  for (let h = 8; h < 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function formatarData(dataISO) {
  const [a, m, d] = dataISO.split("-");
  return `${d}/${m}/${a}`;
}

function ehOftalmo() {
  const esp = document.getElementById("aEspecialidade").value;
  return esp === "Optometria" || esp === "Oftalmologia";
}

// ===================================================================
// ==================  NAVEGAÇÃO ENTRE ETAPAS  =======================
// ===================================================================

function irParaEtapa(n) {
  if (n > 1 && !validarEtapaAtual()) return;

  document.querySelectorAll(".etapa").forEach(el => el.classList.remove("ativa"));
  document.getElementById(`etapa${n}`).classList.add("ativa");

  document.querySelectorAll(".passo").forEach(el => {
    const p = Number(el.dataset.passo);
    el.classList.toggle("ativo", p === n);
    el.classList.toggle("concluido", p < n);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validarEtapaAtual() {
  const etapaAtiva = document.querySelector(".etapa.ativa").id;

  if (etapaAtiva === "etapa1") {
    const nome = document.getElementById("pNome").value.trim();
    const tel = document.getElementById("pTelefone").value.trim();
    if (!nome || !tel) {
      alert("⚠️ Preencha nome e telefone para continuar.");
      return false;
    }
  }

  if (etapaAtiva === "etapa2") {
    const motivo = document.getElementById("tMotivo").value;
    if (!motivo) {
      alert("⚠️ Selecione o motivo principal da consulta.");
      return false;
    }
  }

  return true;
}

// ===================================================================
// ==================  CARREGAR PROFISSIONAIS  =======================
// ===================================================================

async function carregarProfissionais() {
  try {
    PROFISSIONAIS = await API.listarProfissionaisPublico();
    console.log("✅ Profissionais carregados:", PROFISSIONAIS.length);
  } catch (err) {
    console.error("❌ Erro ao carregar profissionais:", err);
    PROFISSIONAIS = [];
    alert("⚠️ Não foi possível carregar a lista de profissionais. Tente novamente.");
  }
}

// ===================================================================
// ==========  BUSCAR SLOTS OCUPADOS (rota pública segura)  ==========
// ===================================================================

async function buscarSlotsOcupados(profissionalId, data) {
  try {
    const slots = await API.buscarSlotsOcupados(profissionalId, data);
    // Retorna só as horas ocupadas
    return slots.map(s => s.hora);
  } catch (err) {
    console.error("❌ Erro ao buscar slots:", err);
    return [];
  }
}

// ===================================================================
// ==================  RENDERIZAR SLOTS  =============================
// ===================================================================

async function renderizarSlots() {
  const esp = document.getElementById("aEspecialidade").value;
  const profId = document.getElementById("aProfissional").value;
  const data = document.getElementById("aData").value;
  const container = document.getElementById("slotsDisponiveis");

  slotSelecionado = null;

  if (!esp || !profId || !data) {
    container.innerHTML = '<p class="slots-vazio">Escolha especialidade, profissional e data para ver os horários.</p>';
    return;
  }

  container.innerHTML = '<p class="slots-vazio">Carregando horários...</p>';

  const duracao = duracaoDaEspecialidade(esp);
  const horarios = gerarHorarios();
  const agora = new Date();
  const dataSelecionada = new Date(`${data}T00:00`);
  const ehHoje = dataSelecionada.toDateString() === agora.toDateString();

  // 🔒 Busca APENAS horários ocupados (sem dados de paciente)
  const slotsOcupados = await buscarSlotsOcupados(profId, data);

  container.innerHTML = "";

  let disponiveis = 0;

  horarios.forEach(hora => {
    const minutos = paraMinutos(hora);
    const minutosFim = minutos + duracao;

    // Fora do horário comercial
    if (minutosFim > paraMinutos(CONFIG.horaFechamento)) return;

    // Se for hoje, esconde horários que já passaram
    if (ehHoje) {
      const horaAtual = agora.getHours() * 60 + agora.getMinutes();
      if (minutos <= horaAtual) return;
    }

    // 🔒 Verifica se o horário está ocupado
    const ocupado = slotsOcupados.includes(hora);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-horario";
    btn.textContent = hora;

    if (ocupado) {
      btn.classList.add("indisponivel");
      btn.disabled = true;
    } else {
      disponiveis++;
      // 🔑 Não sabemos a sala ainda — o backend decide na criação
      btn.onclick = () => selecionarSlot(hora, btn);
    }

    container.appendChild(btn);
  });

  if (disponiveis === 0) {
    container.innerHTML = '<p class="slots-vazio">Nenhum horário disponível nesse dia. Tente outra data.</p>';
  }
}

// ===================================================================
// ====================  SELECIONAR SLOT  ============================
// ===================================================================

function selecionarSlot(hora, btn) {
  slotSelecionado = { hora };

  document.querySelectorAll(".slot-horario").forEach(el => el.classList.remove("selecionado"));
  btn.classList.add("selecionado");
}

// ===================================================================
// ===================  ETAPA 3 — EVENTOS  ===========================
// ===================================================================

document.getElementById("aEspecialidade").addEventListener("change", (e) => {
  const esp = e.target.value;
  const selProf = document.getElementById("aProfissional");

  // Mostrar/esconder triagem oftalmológica
  const triagemExtra = document.getElementById("triagemOftalmo");
  const ehOft = (esp === "Optometria" || esp === "Oftalmologia");
  triagemExtra.classList.toggle("escondido", !ehOft);

  if (!esp) {
    selProf.innerHTML = '<option value="">Escolha a especialidade primeiro</option>';
    selProf.disabled = true;
    return;
  }

  const disponiveis = PROFISSIONAIS.filter(p => p.especialidade === esp);
  selProf.innerHTML = '<option value="">Selecione...</option>';
  disponiveis.forEach(p => {
    selProf.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });
  selProf.disabled = false;

  if (disponiveis.length === 1) {
    selProf.value = disponiveis[0].id;
    renderizarSlots();
  }
});

document.getElementById("aProfissional").addEventListener("change", renderizarSlots);
document.getElementById("aData").addEventListener("change", renderizarSlots);

// ===================================================================
// ==================  CONFIRMAR AGENDAMENTO  ========================
// ===================================================================

async function confirmarAgendamento() {
  if (!document.getElementById("aceiteLgpd").checked) {
    alert("⚠️ Você precisa aceitar os termos de uso dos dados para continuar.");
    return;
  }

  const esp = document.getElementById("aEspecialidade").value;
  const profId = document.getElementById("aProfissional").value;
  const data = document.getElementById("aData").value;

  if (!esp || !profId || !data) {
    alert("⚠️ Preencha especialidade, profissional e data.");
    return;
  }

  if (!slotSelecionado) {
    alert("⚠️ Escolha um horário disponível.");
    return;
  }

  const profissional = PROFISSIONAIS.find(p => p.id === profId);

  // Monta a consulta — sala é decidida pelo backend
  const nova = {
    nome: document.getElementById("pNome").value.trim(),
    telefone: document.getElementById("pTelefone").value.trim(),
    email: document.getElementById("pEmail").value.trim(),
    nascimento: document.getElementById("pNascimento").value,
    cpf: document.getElementById("pCpf").value.trim(),
    especialidade: esp,
    profissionalId: profId,
    salaId: null,                             // 🆕 backend escolhe
    data,
    hora: slotSelecionado.hora,
    duracao: duracaoDaEspecialidade(esp),
    obs: document.getElementById("tObs").value.trim(),

    triagem: {
      motivo: document.getElementById("tMotivo").value,
      tempo: document.getElementById("tTempo").value,
      urgencia: document.getElementById("tUrgencia").value,
      diabete: document.getElementById("tDiabete").checked,
      hipertensao: document.getElementById("tHipertensao").checked,
      cirurgia: document.getElementById("tCirurgia").checked,
      alergia: document.getElementById("tAlergia").checked,
      lentes: document.getElementById("tLentes").checked,
      oculos: document.getElementById("tOculos").checked,
      medicamentos: document.getElementById("tMedicamentos").value.trim(),
      acuidade: document.getElementById("tAcuidade").value || null,

      oftalmo: ehOftalmo() ? {
        oculos: document.getElementById("oOculos").checked,
        lentes: document.getElementById("oLentes").checked,
        ultimoExame: document.getElementById("oUltimoExame").checked,
        familiar: document.getElementById("oFamiliar").checked,
        luz: document.getElementById("oLuz").checked,
        coceira: document.getElementById("oCoceira").checked,
        olhoSeco: document.getElementById("oOlhoSeco").checked,
        dificuldade: document.getElementById("oDificuldade").value,
        telas: document.getElementById("oTelas").value,
        tempoOculos: document.getElementById("oTempoOculos").value
      } : null
    },

    lgpd: {
      aceito: true,
      dataAceite: new Date().toISOString()
    },

    status: "aguardando-confirmacao",
    origem: "online"
  };

  // 🔑 ENVIA PARA O SERVIDOR
  try {
    const criada = await API.criarConsultaPublica(nova);
    console.log("✅ Consulta criada no servidor. ID:", criada.id);
  } catch (err) {
    console.error("❌ Erro ao salvar no servidor:", err);
    alert("Não foi possível concluir o agendamento. Tente novamente.\n\n" + err.message);
    return;
  }

  // Monta o resumo de sucesso
  document.getElementById("resumoSucesso").innerHTML = `
    <strong>${nova.nome}</strong><br>
    ${esp} com <strong>${profissional.nome}</strong><br>
    📅 ${formatarData(data)} às ${slotSelecionado.hora}<br>
    <small style="color:#64748b;">A sala será confirmada pela clínica</small>
  `;

  irParaEtapa(4);
}

// ===================================================================
// =================  TESTE DE ACUIDADE VISUAL  ======================
// ===================================================================

function inicializarAcuidade() {
  const linhas = document.querySelectorAll(".linha-acuidade");

  linhas.forEach(btn => {
    btn.addEventListener("click", () => {
      linhas.forEach(l => l.classList.remove("selecionada"));
      btn.classList.add("selecionada");

      const valor = btn.dataset.valor;
      document.getElementById("tAcuidade").value = valor;
      document.getElementById("acuidadeSelecionada").textContent = valor;
    });
  });
}

function limparAcuidade() {
  document.querySelectorAll(".linha-acuidade").forEach(l => l.classList.remove("selecionada"));
  document.getElementById("tAcuidade").value = "";
  document.getElementById("acuidadeSelecionada").textContent = "— não informado —";
}

// ===================================================================
// =========================  INIT  ==================================
// ===================================================================

async function iniciarAgendar() {
  // Define data mínima como hoje
  document.getElementById("aData").setAttribute(
    "min",
    new Date().toISOString().split("T")[0]
  );

  // Aplica máscaras
  if (typeof aplicarMascaras === "function") {
    aplicarMascaras();
  }

  // Inicializa acuidade
  inicializarAcuidade();

  // 🔑 Carrega profissionais da API pública
  await carregarProfissionais();

  // Slots são renderizados sob demanda (quando escolher profissional + data)
  renderizarSlots();
}

iniciarAgendar();