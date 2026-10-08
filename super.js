// ===================================================================
// ====================  TELA SUPER ADMIN  ===========================
// ===================================================================

// ===== Proteção de rota =====
const _token = localStorage.getItem("token");
if (!_token) {
  window.location.href = "login.html";
  throw new Error("Redirecionando para login...");
}

const _usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
if (_usuario.papel !== "super") {
  alert("Acesso restrito ao super admin.");
  window.location.href = "index.html";
  throw new Error("Sem permissão");
}

// ===== Estado =====
let empresas = [];

// ===================================================================
// =========================  CARREGAR  ==============================
// ===================================================================

async function carregarTudo() {
  await Promise.all([
    carregarEstatisticas(),
    carregarEmpresas()
  ]);
}

async function carregarEstatisticas() {
  try {
    const stats = await API.estatisticasSuper();
    document.getElementById("kpiEmpresas").textContent = stats.empresas;
    document.getElementById("kpiAtivas").textContent = stats.empresasAtivas;
    document.getElementById("kpiUsuarios").textContent = stats.usuarios;
    document.getElementById("kpiConsultas").textContent = stats.consultas;
    document.getElementById("kpiProfissionais").textContent = stats.profissionais;
  } catch (err) {
    console.error("Erro ao carregar estatísticas:", err);
  }
}

async function carregarEmpresas() {
  const listaEl = document.getElementById("listaEmpresas");
  listaEl.innerHTML = '<p class="vazio">Carregando...</p>';

  try {
    empresas = await API.listarEmpresasSuper();

    document.getElementById("totalEmpresas").textContent = empresas.length;

    if (empresas.length === 0) {
      listaEl.innerHTML = '<p class="vazio">Nenhuma clínica cadastrada ainda.</p>';
      return;
    }

    listaEl.innerHTML = "";

    empresas.forEach(e => {
      const div = document.createElement("div");
      div.className = "empresa-item" + (e.ativo ? "" : " bloqueada");

      const tag = e.ativo
        ? '<span class="tag-ativa">Ativa</span>'
        : '<span class="tag-ativa tag-bloqueada">Bloqueada</span>';

      div.innerHTML = `
        <div class="empresa-info">
          <strong>${e.nome} ${tag}</strong>
          <div class="slug">/${e.slug}</div>
          <div class="contadores">
            <span>👥 ${e.totalUsuarios} usuários</span>
            <span>🩺 ${e.totalProfissionais} profissionais</span>
            <span>📅 ${e.totalConsultas} consultas</span>
          </div>
        </div>
        <div class="empresa-acoes">
          <button class="btn-bloquear ${e.ativo ? '' : 'btn-desbloquear'}"
                  onclick="alternarAtivo(${e.id}, ${e.ativo ? 0 : 1})">
            ${e.ativo ? "🔒 Bloquear" : "🔓 Desbloquear"}
          </button>
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
// =====================  CRIAR EMPRESA  =============================
// ===================================================================

const formNova = document.getElementById("formNovaEmpresa");
const formEmpresa = document.getElementById("formEmpresa");
const empErroBox = document.getElementById("empErro");

document.getElementById("btnNovaEmpresa").addEventListener("click", () => {
  formNova.classList.toggle("escondido");
  if (!formNova.classList.contains("escondido")) {
    document.getElementById("empNome").focus();
  }
});

document.getElementById("btnCancelarEmpresa").addEventListener("click", () => {
  formNova.classList.add("escondido");
  formEmpresa.reset();
  limparErroEmpresa();
});

formEmpresa.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErroEmpresa();

  const dados = {
    nomeEmpresa: document.getElementById("empNome").value.trim(),
    slug: document.getElementById("empSlug").value.trim().toLowerCase(),
    cnpj: document.getElementById("empCnpj").value.trim(),
    email: document.getElementById("empEmail").value.trim(),
    telefone: document.getElementById("empTelefone").value.trim(),
    whatsapp: document.getElementById("empWhatsapp").value.trim(),
    nomeAdmin: document.getElementById("admNome").value.trim(),
    usuarioAdmin: document.getElementById("admUsuario").value.trim(),
    senhaAdmin: document.getElementById("admSenha").value
  };

  if (!dados.nomeEmpresa || !dados.slug || !dados.nomeAdmin || !dados.usuarioAdmin || !dados.senhaAdmin) {
    mostrarErroEmpresa("Preencha todos os campos obrigatórios (*)");
    return;
  }

  if (dados.senhaAdmin.length < 6) {
    mostrarErroEmpresa("A senha precisa ter pelo menos 6 caracteres");
    return;
  }

  try {
    const criada = await API.criarEmpresaSuper(dados);
    mostrarSucessoEmpresa(`✅ Clínica "${criada.empresa.nome}" criada com sucesso!`);

    formEmpresa.reset();
    formNova.classList.add("escondido");
    await carregarTudo();
  } catch (err) {
    console.error(err);
    mostrarErroEmpresa(err.message);
  }
});

function mostrarErroEmpresa(msg) {
  empErroBox.textContent = msg;
  empErroBox.classList.add("visivel");
  empErroBox.classList.remove("sucesso");
}

function mostrarSucessoEmpresa(msg) {
  empErroBox.textContent = msg;
  empErroBox.classList.add("visivel", "sucesso");
  setTimeout(() => limparErroEmpresa(), 5000);
}

function limparErroEmpresa() {
  empErroBox.textContent = "";
  empErroBox.classList.remove("visivel", "sucesso");
}

// ===================================================================
// ===============  BLOQUEAR / DESBLOQUEAR  ==========================
// ===================================================================

async function alternarAtivo(empresaId, novoAtivo) {
  const acao = novoAtivo ? "desbloquear" : "bloquear";
  if (!confirm(`Deseja ${acao} esta clínica?`)) return;

  try {
    await API.alterarAtivoEmpresaSuper(empresaId, novoAtivo);
    await carregarTudo();
  } catch (err) {
    alert("Erro: " + err.message);
  }
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

document.getElementById("btnRecarregar").addEventListener("click", carregarTudo);

// ===================================================================
// =========================  INIT  ==================================
// ===================================================================

document.getElementById("nomeUsuario").textContent = _usuario.nome || "—";

carregarTudo();