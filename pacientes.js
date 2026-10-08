// ===================================================================
// ====================  TELA DE PACIENTES  ==========================
// ===================================================================

// ===== Proteção de rota =====
const _token = localStorage.getItem("token");
if (!_token) {
  window.location.href = "login.html";
  throw new Error("Redirecionando para login...");
}

const _usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

// ===== Estado =====
let pacientes = [];
let pacienteAtual = null;
let timerBusca = null;

// ===================================================================
// =======================  HELPERS  =================================
// ===================================================================

function formatarData(dataISO) {
  if (!dataISO) return "—";
  const [a, m, d] = dataISO.split("-");
  return `${d}/${m}/${a}`;
}

function formatarDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

// ===================================================================
// =======================  CARREGAR  ================================
// ===================================================================

async function carregarPacientes(termo = "") {
  const listaEl = document.getElementById("listaPacientes");
  listaEl.innerHTML = '<p class="vazio">Carregando...</p>';

  try {
    pacientes = await API.listarPacientes(termo);

    if (pacientes.length === 0) {
      listaEl.innerHTML = termo
        ? '<p class="vazio">Nenhum paciente encontrado para essa busca.</p>'
        : '<p class="vazio">Nenhum paciente cadastrado ainda. Clique em "➕ Novo paciente".</p>';
      return;
    }

    listaEl.innerHTML = "";

    pacientes.forEach(p => {
      const div = document.createElement("div");
      div.className = "paciente-item";
      div.onclick = (e) => {
        if (e.target.closest(".btn-edit-paciente")) return;
        abrirProntuario(p.id);
      };

      div.innerHTML = `
        <div class="paciente-info">
          <strong>${p.nome}</strong>
          <div class="linha">
            ${p.cpf ? `<span>📄 ${p.cpf}</span>` : ""}
            ${p.telefone ? `<span>📞 ${p.telefone}</span>` : ""}
            ${p.email ? `<span>✉️ ${p.email}</span>` : ""}
          </div>
          <div class="linha">
            <span>📅 ${p.totalConsultas} consulta${p.totalConsultas === 1 ? "" : "s"}</span>
            ${p.ultimaConsulta ? `<span>Última: ${formatarData(p.ultimaConsulta)}</span>` : ""}
          </div>
        </div>
        <div class="paciente-acoes">
          <button class="btn-edit-paciente" onclick="editarPaciente(${p.id}, event)" title="Editar">✏️</button>
          <button class="btn-ver-paciente">Ver →</button>
        </div>
      `;

      listaEl.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    listaEl.innerHTML = `<p class="vazio">❌ Erro: ${err.message}</p>`;
  }
}

// ===================================================================
// ==================  MODAL: NOVO / EDITAR PACIENTE  ================
// ===================================================================

const modalPaciente = document.getElementById("modalPaciente");
const formPaciente = document.getElementById("formPaciente");
const paciErroBox = document.getElementById("paciErro");

function abrirModalPaciente() {
  document.getElementById("tituloModalPaciente").textContent = "👤 Novo paciente";
  document.getElementById("paciId").value = "";
  formPaciente.reset();
  limparErroPaci();
  modalPaciente.classList.remove("escondido");
  document.getElementById("paciNome").focus();
}

function editarPaciente(id, event) {
  if (event) event.stopPropagation();

  const p = pacientes.find(x => x.id === id);
  if (!p) return;

  document.getElementById("tituloModalPaciente").textContent = "✏️ Editar paciente";
  document.getElementById("paciId").value = p.id;
  document.getElementById("paciNome").value = p.nome || "";
  document.getElementById("paciCpf").value = p.cpf || "";
  document.getElementById("paciNascimento").value = p.nascimento || "";
  document.getElementById("paciTelefone").value = p.telefone || "";
  document.getElementById("paciEmail").value = p.email || "";
  document.getElementById("paciEndereco").value = p.endereco || "";
  document.getElementById("paciCidade").value = p.cidade || "";
  document.getElementById("paciEstado").value = p.estado || "";
  document.getElementById("paciConvenio").value = p.convenio || "";
  document.getElementById("paciObservacoes").value = p.observacoes || "";

  limparErroPaci();
  modalPaciente.classList.remove("escondido");
  document.getElementById("paciNome").focus();
}

function fecharModalPaciente() {
  modalPaciente.classList.add("escondido");
  formPaciente.reset();
  limparErroPaci();
}

formPaciente.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErroPaci();

  const id = document.getElementById("paciId").value;
  const dados = {
    nome: document.getElementById("paciNome").value.trim(),
    cpf: document.getElementById("paciCpf").value.trim(),
    nascimento: document.getElementById("paciNascimento").value,
    telefone: document.getElementById("paciTelefone").value.trim(),
    email: document.getElementById("paciEmail").value.trim(),
    endereco: document.getElementById("paciEndereco").value.trim(),
    cidade: document.getElementById("paciCidade").value.trim(),
    estado: document.getElementById("paciEstado").value.trim().toUpperCase(),
    convenio: document.getElementById("paciConvenio").value.trim(),
    observacoes: document.getElementById("paciObservacoes").value.trim()
  };

  if (!dados.nome) {
    mostrarErroPaci("O nome é obrigatório.");
    return;
  }

  try {
    if (id) {
      await API.atualizarPaciente(id, dados);
    } else {
      await API.criarPaciente(dados);
    }

    fecharModalPaciente();
    await carregarPacientes(document.getElementById("busca").value);
  } catch (err) {
    mostrarErroPaci(err.message);
  }
});

function mostrarErroPaci(msg) {
  paciErroBox.textContent = msg;
  paciErroBox.classList.add("visivel");
}

function limparErroPaci() {
  paciErroBox.textContent = "";
  paciErroBox.classList.remove("visivel");
}

// ===================================================================
// ==================  PRONTUÁRIO DO PACIENTE  =======================
// ===================================================================

const modalProntuario = document.getElementById("modalProntuario");
const conteudoProntuario = document.getElementById("conteudoProntuario");

async function abrirProntuario(pacienteId) {
  modalProntuario.classList.remove("escondido");
  conteudoProntuario.innerHTML = '<p class="vazio">Carregando...</p>';

  try {
    const dados = await API.buscarPaciente(pacienteId);
    pacienteAtual = dados.paciente;

    document.getElementById("tituloProntuario").textContent =
      `👤 ${dados.paciente.nome}`;

    // Monta HTML
    let html = `
      <div class="prontuario-info">
        ${dados.paciente.cpf ? `<div>📄 <strong>${dados.paciente.cpf}</strong></div>` : ""}
        ${dados.paciente.telefone ? `<div>📞 <strong>${dados.paciente.telefone}</strong></div>` : ""}
        ${dados.paciente.email ? `<div>✉️ <strong>${dados.paciente.email}</strong></div>` : ""}
        ${dados.paciente.nascimento ? `<div>🎂 <strong>${formatarData(dados.paciente.nascimento)}</strong></div>` : ""}
        ${dados.paciente.convenio ? `<div>🏥 <strong>${dados.paciente.convenio}</strong></div>` : ""}
      </div>

      <div class="secao-titulo">
        <h4>📅 Histórico de consultas (${dados.consultas.length})</h4>
      </div>
    `;

    if (dados.consultas.length === 0) {
      html += '<p class="vazio">Nenhuma consulta registrada.</p>';
    } else {
      html += '<div class="lista-consultas-pront">';
      dados.consultas.forEach(c => {
        html += `
          <div class="consulta-pront">
            <div class="cabecalho">
              <strong>${c.especialidade}</strong>
              <span class="data">${formatarData(c.data)} às ${c.hora}</span>
            </div>
            <div class="detalhes">
              👨‍⚕️ ${c.profissionalNome || c.profissionalId}
              ${c.status && c.status !== "confirmada" ? ` • <strong>${c.status.toUpperCase()}</strong>` : ""}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    // Anotações
    html += `
      <div class="secao-titulo">
        <h4>📝 Anotações (${dados.anotacoes.length})</h4>
        <button onclick="abrirModalAnotacao(${pacienteId})">➕ Nova anotação</button>
      </div>
    `;

    if (dados.anotacoes.length === 0) {
      html += '<p class="vazio">Nenhuma anotação registrada ainda.</p>';
    } else {
      html += '<div class="lista-anotacoes">';
      dados.anotacoes.forEach(a => {
        html += `
          <div class="anotacao-item">
            <div class="cabecalho">
              <div>
                <span class="titulo">${a.titulo || "Anotação"}</span>
                <span class="tipo">${a.tipo || "nota"}</span>
              </div>
              <button class="btn-remover-anotacao" onclick="removerAnotacao(${pacienteId}, ${a.id})" title="Remover">🗑️</button>
            </div>
            <div class="texto">${a.texto}</div>
            <div class="rodape">
              <span>${a.profissionalNome || a.profissionalId || "—"}</span>
              <span>${formatarDataHora(a.criadoEm)}</span>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    // 🆕 Receitas
let receitas = [];
try {
  receitas = await API.listarReceitasPaciente(pacienteId);
} catch (err) {
  console.error("Erro ao buscar receitas:", err);
}

html += `
  <div class="secao-titulo">
    <h4>💊 Receitas (${receitas.length})</h4>
    <button onclick="abrirModalReceita(${pacienteId})">➕ Nova receita</button>
  </div>
`;

if (receitas.length === 0) {
  html += '<p class="vazio">Nenhuma receita emitida ainda.</p>';
} else {
  html += '<div class="lista-receitas">';
  receitas.forEach(r => {
    html += `
      <div class="receita-item">
        <div class="cabecalho">
          <strong>💊 ${r.tipo === "lentes" ? "Lentes de contato" : "Óculos"}</strong>
          <span class="data">${formatarDataHora(r.criadoEm)}</span>
        </div>
        <div class="graus">
          <span>👁️ OD: <strong>${formatarGrau(r.od_esf_longe)}</strong> ${r.od_cil_longe ? `CIL ${formatarGrau(r.od_cil_longe)}` : ""} ${r.od_eixo_longe ? `EIXO ${r.od_eixo_longe}°` : ""}</span>
          <span>👁️ OE: <strong>${formatarGrau(r.oe_esf_longe)}</strong> ${r.oe_cil_longe ? `CIL ${formatarGrau(r.oe_cil_longe)}` : ""} ${r.oe_eixo_longe ? `EIXO ${r.oe_eixo_longe}°` : ""}</span>
          ${r.adicao ? `<span>📖 Adição: <strong>+${r.adicao.toFixed(2)}</strong></span>` : ""}
        </div>
        <div class="rodape">
          <span>${r.profissionalNome || "—"}</span>
          <div class="acoes-receita">
            <button onclick="imprimirReceita(${r.id})" title="Imprimir">🖨️</button>
            <button onclick="removerReceita(${pacienteId}, ${r.id})" title="Remover">🗑️</button>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
}

    conteudoProntuario.innerHTML = html;
  } catch (err) {
    console.error(err);
    conteudoProntuario.innerHTML = `<p class="vazio">❌ Erro: ${err.message}</p>`;
  }
}

function fecharProntuario() {
  modalProntuario.classList.add("escondido");
  pacienteAtual = null;
}

// ===================================================================
// ====================  MODAL: NOVA ANOTAÇÃO  =======================
// ===================================================================

const modalAnotacao = document.getElementById("modalAnotacao");
const formAnotacao = document.getElementById("formAnotacao");
const anotErroBox = document.getElementById("anotErro");

function abrirModalAnotacao(pacienteId, consultaId = null) {
  document.getElementById("anotPacienteId").value = pacienteId;
  document.getElementById("anotConsultaId").value = consultaId || "";
  formAnotacao.reset();
  document.getElementById("anotPacienteId").value = pacienteId;
  document.getElementById("anotConsultaId").value = consultaId || "";
  document.getElementById("anotTipo").value = "anamnese";
  limparErroAnot();
  modalAnotacao.classList.remove("escondido");
  document.getElementById("anotTitulo").focus();
}

function fecharModalAnotacao() {
  modalAnotacao.classList.add("escondido");
  formAnotacao.reset();
  limparErroAnot();
}

formAnotacao.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErroAnot();

  const pacienteId = document.getElementById("anotPacienteId").value;
  const consultaId = document.getElementById("anotConsultaId").value || null;
  const dados = {
    titulo: document.getElementById("anotTitulo").value.trim() || null,
    tipo: document.getElementById("anotTipo").value,
    texto: document.getElementById("anotTexto").value.trim(),
    consultaId: consultaId ? Number(consultaId) : null
  };

  if (!dados.texto) {
    mostrarErroAnot("O texto da anotação é obrigatório.");
    return;
  }

  try {
    await API.criarAnotacao(pacienteId, dados);
    fecharModalAnotacao();
    await abrirProntuario(Number(pacienteId));
  } catch (err) {
    mostrarErroAnot(err.message);
  }
});

function mostrarErroAnot(msg) {
  anotErroBox.textContent = msg;
  anotErroBox.classList.add("visivel");
}

function limparErroAnot() {
  anotErroBox.textContent = "";
  anotErroBox.classList.remove("visivel");
}

// ===================================================================
// =====================  REMOVER ANOTAÇÃO  ==========================
// ===================================================================

async function removerAnotacao(pacienteId, anotacaoId) {
  if (!confirm("Remover esta anotação?")) return;

  try {
    await API.removerAnotacao(pacienteId, anotacaoId);
    await abrirProntuario(pacienteId);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

// ===================================================================
// =========================  BUSCA  =================================
// ===================================================================

document.getElementById("busca").addEventListener("input", (e) => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(() => {
    carregarPacientes(e.target.value.trim());
  }, 300);
});

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
// =========================  INIT  ==================================
// ===================================================================

document.getElementById("nomeUsuario").textContent = _usuario.nome || "—";
document.getElementById("papelUsuario").textContent = _usuario.papel === "admin" ? "Admin" : "";

document.getElementById("btnNovoPaciente").addEventListener("click", abrirModalPaciente);

// Fecha modais ao clicar fora
[modalPaciente, modalProntuario, modalAnotacao].forEach(m => {
  m.addEventListener("click", (e) => {
    if (e.target === m) m.classList.add("escondido");
  });
});

// Fecha com ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    modalPaciente.classList.add("escondido");
    modalProntuario.classList.add("escondido");
    modalAnotacao.classList.add("escondido");
  }
});

// Aplica máscaras
if (typeof aplicarMascaraTelefone === "function") {
  aplicarMascaraTelefone(document.getElementById("paciTelefone"));
}
if (typeof aplicarMascaraCpf === "function") {
  aplicarMascaraCpf(document.getElementById("paciCpf"));
}


carregarPacientes();

function formatarGrau(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

// ===================================================================
// ======================  MODAL DE RECEITA  =========================
// ===================================================================

const modalReceita = document.getElementById("modalReceita");
const formReceita = document.getElementById("formReceita");
const recErroBox = document.getElementById("recErro");

let receitaEditando = null;

function abrirModalReceita(pacienteId, receita = null) {
  receitaEditando = receita;

  document.getElementById("recPacienteId").value = pacienteId;
  document.getElementById("recReceitaId").value = receita ? receita.id : "";

  if (receita) {
    document.getElementById("recTipo").value = receita.tipo || "oculos";
    document.getElementById("odEsfLonge").value = receita.od_esf_longe ?? "";
    document.getElementById("odCilLonge").value = receita.od_cil_longe ?? "";
    document.getElementById("odEixoLonge").value = receita.od_eixo_longe ?? "";
    document.getElementById("odDp").value = receita.od_dp ?? "";
    document.getElementById("oeEsfLonge").value = receita.oe_esf_longe ?? "";
    document.getElementById("oeCilLonge").value = receita.oe_cil_longe ?? "";
    document.getElementById("oeEixoLonge").value = receita.oe_eixo_longe ?? "";
    document.getElementById("oeDp").value = receita.oe_dp ?? "";
    document.getElementById("recAdicao").value = receita.adicao ?? "";
    document.getElementById("recObservacoes").value = receita.observacoes ?? "";
  } else {
    formReceita.reset();
    document.getElementById("recPacienteId").value = pacienteId;
    document.getElementById("recTipo").value = "oculos";
  }

  limparErroRec();
  atualizarPreviewPerto();
  modalReceita.classList.remove("escondido");
  document.getElementById("odEsfLonge").focus();
}

function fecharModalReceita() {
  modalReceita.classList.add("escondido");
  formReceita.reset();
  receitaEditando = null;
  limparErroRec();
}

// ===== Cálculo automático do grau de perto =====
function atualizarPreviewPerto() {
  const odEsf = parseFloat(document.getElementById("odEsfLonge").value) || 0;
  const oeEsf = parseFloat(document.getElementById("oeEsfLonge").value) || 0;
  const adicao = parseFloat(document.getElementById("recAdicao").value) || 0;

  const odPerto = odEsf + adicao;
  const oePerto = oeEsf + adicao;

  const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);

  document.getElementById("previewOdPerto").textContent = adicao ? fmt(odPerto) : "—";
  document.getElementById("previewOePerto").textContent = adicao ? fmt(oePerto) : "—";
}

// Atualiza preview em tempo real
["odEsfLonge", "oeEsfLonge", "recAdicao"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", atualizarPreviewPerto);
});

// ===== Submit da receita =====
formReceita.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErroRec();

  const pacienteId = Number(document.getElementById("recPacienteId").value);
  const receitaId = document.getElementById("recReceitaId").value;

  const odEsf = parseFloat(document.getElementById("odEsfLonge").value);
  const odCil = parseFloat(document.getElementById("odCilLonge").value);
  const odEixo = parseInt(document.getElementById("odEixoLonge").value);
  const odDp = parseFloat(document.getElementById("odDp").value);

  const oeEsf = parseFloat(document.getElementById("oeEsfLonge").value);
  const oeCil = parseFloat(document.getElementById("oeCilLonge").value);
  const oeEixo = parseInt(document.getElementById("oeEixoLonge").value);
  const oeDp = parseFloat(document.getElementById("oeDp").value);

  const adicao = parseFloat(document.getElementById("recAdicao").value);

  // Cálculo do perto
  const odEsfPerto = isNaN(odEsf) ? null : (odEsf + (adicao || 0));
  const oeEsfPerto = isNaN(oeEsf) ? null : (oeEsf + (adicao || 0));

  const dados = {
    pacienteId,
    consultaId: null,
    tipo: document.getElementById("recTipo").value,

    od_esf_longe: isNaN(odEsf) ? null : odEsf,
    od_cil_longe: isNaN(odCil) ? null : odCil,
    od_eixo_longe: isNaN(odEixo) ? null : odEixo,
    od_dp: isNaN(odDp) ? null : odDp,

    oe_esf_longe: isNaN(oeEsf) ? null : oeEsf,
    oe_cil_longe: isNaN(oeCil) ? null : oeCil,
    oe_eixo_longe: isNaN(oeEixo) ? null : oeEixo,
    oe_dp: isNaN(oeDp) ? null : oeDp,

    adicao: isNaN(adicao) ? null : adicao,

    od_esf_perto: odEsfPerto,
    od_cil_perto: isNaN(odCil) ? null : odCil,
    od_eixo_perto: isNaN(odEixo) ? null : odEixo,

    oe_esf_perto: oeEsfPerto,
    oe_cil_perto: isNaN(oeCil) ? null : oeCil,
    oe_eixo_perto: isNaN(oeEixo) ? null : oeEixo,

    observacoes: document.getElementById("recObservacoes").value.trim() || null
  };

  try {
    if (receitaId) {
      await API.atualizarReceita(receitaId, dados);
    } else {
      await API.criarReceita(dados);
    }

    fecharModalReceita();
    await abrirProntuario(pacienteId);
  } catch (err) {
    mostrarErroRec(err.message);
  }
});

function mostrarErroRec(msg) {
  recErroBox.textContent = msg;
  recErroBox.classList.add("visivel");
}

function limparErroRec() {
  recErroBox.textContent = "";
  recErroBox.classList.remove("visivel");
}

async function removerReceita(pacienteId, receitaId) {
  if (!confirm("Remover esta receita?")) return;

  try {
    await API.removerReceita(receitaId);
    await abrirProntuario(pacienteId);
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

// ===== Imprimir receita =====
async function imprimirReceita(receitaId) {
  try {
    const r = await API.buscarReceita(receitaId);
    const paciente = pacienteAtual;

    const fmt = (v) => {
      if (v === null || v === undefined) return "—";
      const n = Number(v);
      return (n >= 0 ? "+" : "") + n.toFixed(2);
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receita - ${paciente.nome}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
          h1 { text-align: center; color: #0369a1; margin-bottom: 4px; }
          .subtitulo { text-align: center; color: #64748b; margin-bottom: 30px; font-size: 0.9rem; }
          .paciente { background: #f0f9ff; padding: 16px; border-radius: 10px; margin-bottom: 24px; }
          .paciente strong { color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #0ea5e9; color: white; padding: 10px; text-align: left; }
          td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; }
          .grau { font-family: monospace; font-size: 1.05rem; font-weight: 700; color: #0f172a; }
          .adicao-box { background: #fef3c7; padding: 14px; border-radius: 10px; margin: 20px 0; }
          .obs { margin-top: 24px; font-size: 0.9rem; color: #475569; }
          .assinatura { margin-top: 60px; text-align: center; }
          .linha { border-top: 1px solid #0f172a; width: 300px; margin: 0 auto; }
          .assinatura p { margin: 6px 0; font-size: 0.85rem; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>👁️ Receita ${r.tipo === "lentes" ? "de Lentes de Contato" : "de Óculos"}</h1>
        <p class="subtitulo">Emitida em ${new Date(r.criadoEm).toLocaleDateString("pt-BR")}</p>

        <div class="paciente">
          <strong>Paciente:</strong> ${paciente.nome}<br>
          ${paciente.cpf ? `<strong>CPF:</strong> ${paciente.cpf}<br>` : ""}
          ${paciente.nascimento ? `<strong>Nascimento:</strong> ${formatarData(paciente.nascimento)}<br>` : ""}
        </div>

        <table>
          <thead>
            <tr>
              <th>Olho</th>
              <th>ESF</th>
              <th>CIL</th>
              <th>EIXO</th>
              ${r.od_dp ? "<th>DP</th>" : ""}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>OD (Direito)</strong></td>
              <td class="grau">${fmt(r.od_esf_longe)}</td>
              <td class="grau">${fmt(r.od_cil_longe)}</td>
              <td class="grau">${r.od_eixo_longe ? r.od_eixo_longe + "°" : "—"}</td>
              ${r.od_dp ? `<td class="grau">${r.od_dp}mm</td>` : ""}
            </tr>
            <tr>
              <td><strong>OE (Esquerdo)</strong></td>
              <td class="grau">${fmt(r.oe_esf_longe)}</td>
              <td class="grau">${fmt(r.oe_cil_longe)}</td>
              <td class="grau">${r.oe_eixo_longe ? r.oe_eixo_longe + "°" : "—"}</td>
              ${r.oe_dp ? `<td class="grau">${r.oe_dp}mm</td>` : ""}
            </tr>
          </tbody>
        </table>

        ${r.adicao ? `
          <div class="adicao-box">
            <strong>📖 Adição (perto):</strong> ${fmt(r.adicao)}<br>
            <strong>👁️ OD perto:</strong> <span class="grau">${fmt(r.od_esf_perto)}</span> &nbsp;|&nbsp;
            <strong>👁️ OE perto:</strong> <span class="grau">${fmt(r.oe_esf_perto)}</span>
          </div>
        ` : ""}

        ${r.observacoes ? `<div class="obs"><strong>Observações:</strong> ${r.observacoes}</div>` : ""}

        <div class="assinatura">
          <div class="linha"></div>
          <p><strong>${r.profissionalNome || "Profissional responsável"}</strong></p>
          <p>Assinatura e carimbo</p>
        </div>
      </body>
      </html>
    `;

    const janela = window.open("", "_blank");
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => janela.print(), 300);
  } catch (err) {
    alert("Erro ao imprimir: " + err.message);
  }
}

// Fechar modal ao clicar fora
modalReceita.addEventListener("click", (e) => {
  if (e.target === modalReceita) fecharModalReceita();
});