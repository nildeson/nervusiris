// ===================================================================
// ===================  TELA ADMIN — 2 ABAS  =========================
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

const linkSuperAdmin = document.getElementById("linkSuper");
if (linkSuperAdmin && _usuario.papel === "super") {
  linkSuperAdmin.style.display = "inline-block";
}

// ===== Estado =====
let profissionais = [];

// ===================================================================
// ======================  NAVEGAÇÃO ENTRE ABAS  =====================
// ===================================================================

document.querySelectorAll(".aba").forEach(btn => {
  btn.addEventListener("click", () => {
    const alvo = btn.dataset.aba;

    document.querySelectorAll(".aba").forEach(b => b.classList.toggle("ativa", b === btn));
    document.querySelectorAll(".aba-conteudo").forEach(c => {
      c.classList.toggle("ativa", c.id === `aba-${alvo}`);
    });
  });
});

// ===================================================================
// ====================  === PROFISSIONAIS ===  ======================
// ===================================================================

const formProf = document.getElementById("formNovoProfissional");
const listaProfEl = document.getElementById("listaProfissionais");
const erroProfBox = document.getElementById("profErro");

async function carregarProfissionais() {
  listaProfEl.innerHTML = '<p class="vazio">Carregando...</p>';

  try {
    profissionais = await apiFetch("/profissionais");
    renderizarProfissionais();
    popularSelectVinculo();
  } catch (err) {
    console.error(err);
    listaProfEl.innerHTML = `<p class="vazio">❌ Erro: ${err.message}</p>`;
  }
}

function renderizarProfissionais() {
  if (profissionais.length === 0) {
    listaProfEl.innerHTML = '<p class="vazio">Nenhum profissional cadastrado.</p>';
    return;
  }

  listaProfEl.innerHTML = "";

  profissionais.forEach(p => {
    const div = document.createElement("div");
    div.className = "profissional-item";
    if (!p.ativo) div.classList.add("inativo");

    div.innerHTML = `
      <div class="usuario-info">
        <strong>${p.nome}</strong>
        <small>🩺 ${p.especialidade}</small>
        <small>🔑 ID: <code>${p.id}</code></small>
        ${!p.ativo ? '<small style="color:#991b1b;">⚠️ Desativado</small>' : ""}
      </div>
      <button class="btn-editar-prof" onclick="editarProfissional('${p.id}')">✏️ Editar</button>
    `;

    listaProfEl.appendChild(div);
  });
}

formProf.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErroProf();

  const nome = document.getElementById("profNome").value.trim();
  const especialidade = document.getElementById("profEspecialidade").value;

  if (!nome || !especialidade) {
    mostrarErroProf("Preencha nome e especialidade.");
    return;
  }

  try {
    const id = await gerarProximoProfissionalId();

    const novo = await apiFetch("/profissionais", {
      method: "POST",
      body: JSON.stringify({ id, nome, especialidade })
    });

    mostrarSucessoProf(`✅ ${novo.nome} cadastrado com o ID ${novo.id}`);
    formProf.reset();
    await carregarProfissionais();
  } catch (err) {
    console.error(err);
    mostrarErroProf(err.message);
  }
});

async function gerarProximoProfissionalId() {
  const lista = await apiFetch("/profissionais");
  const ids = lista
    .map(p => Number((p.id || "").replace("p", "")))
    .filter(n => !isNaN(n));
  const maior = ids.length > 0 ? Math.max(...ids) : 0;
  return `p${maior + 1}`;
}

async function editarProfissional(id) {
  const p = profissionais.find(x => x.id === id);
  if (!p) return;

  const novoNome = prompt("Nome:", p.nome);
  if (novoNome === null) return;

  const novaEsp = prompt(
    "Especialidade (Optometria / Oftalmologia / Clínica Geral / Odontologia / Psicologia):",
    p.especialidade
  );
  if (novaEsp === null) return;

  const ativoStr = prompt("Ativo? (1 = sim, 0 = não)", p.ativo ? "1" : "0");
  if (ativoStr === null) return;

  try {
    await apiFetch(`/profissionais/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        nome: novoNome.trim(),
        especialidade: novaEsp.trim(),
        ativo: Number(ativoStr) ? 1 : 0
      })
    });
    await carregarProfissionais();
  } catch (err) {
    alert("❌ Erro ao editar: " + err.message);
  }
}

// ===================================================================
// =======================  === USUÁRIOS ===  ========================
// ===================================================================

const formNovo = document.getElementById("formNovoUsuario");
const listaEl = document.getElementById("listaUsuarios");
const erroBox = document.getElementById("novoErro");

async function carregarUsuarios() {
  listaEl.innerHTML = '<p class="vazio">Carregando...</p>';

  try {
    const lista = await apiFetch("/auth/usuarios");
    renderizarUsuarios(lista);
  } catch (err) {
    console.error(err);
    listaEl.innerHTML = `<p class="vazio">❌ Erro: ${err.message}</p>`;
  }
}

function renderizarUsuarios(lista) {
  if (lista.length === 0) {
    listaEl.innerHTML = '<p class="vazio">Nenhum usuário cadastrado.</p>';
    return;
  }

  listaEl.innerHTML = "";

  lista.forEach(u => {
    const div = document.createElement("div");
    div.className = "usuario-item " + u.papel;
    if (u.id === _usuario.id) div.classList.add("eu");

    const ehEu = u.id === _usuario.id;
    const prof = u.profissionalId ? profissionais.find(p => p.id === u.profissionalId) : null;

    div.innerHTML = `
      <div class="usuario-info">
        <strong>
          ${u.nome}
          <span class="papel-tag ${u.papel}">${u.papel}</span>
          ${ehEu ? '<span class="papel-tag profissional">você</span>' : ""}
        </strong>
        <small>🔑 Usuário: <code>${u.usuario}</code></small>
        ${prof ? `<small>🩺 ${prof.nome} (${prof.id})</small>` : ""}
        <small>📅 Criado em ${new Date(u.criadoEm).toLocaleDateString("pt-BR")}</small>
      </div>
      ${ehEu ? "" : `<button class="btn-remover-usuario" onclick="removerUsuario(${u.id}, '${u.nome}')">🗑️ Remover</button>`}
    `;

    listaEl.appendChild(div);
  });
}

formNovo.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErro();

  const nome = document.getElementById("novoNome").value.trim();
  const usuario = document.getElementById("novoUsuario").value.trim();
  const senha = document.getElementById("novaSenha").value;
  const papel = document.getElementById("novoPapel").value;
  const profissionalId = document.getElementById("novoProfissionalId").value;

  if (!nome || !usuario || !senha) {
    mostrarErro("Preencha todos os campos obrigatórios.");
    return;
  }

  if (senha.length < 6) {
    mostrarErro("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  if (papel === "profissional" && !profissionalId) {
    mostrarErro("Selecione o profissional para vincular.");
    return;
  }

  const payload = { usuario, senha, nome, papel };
  if (papel === "profissional") payload.profissionalId = profissionalId;

  try {
    const novo = await apiFetch("/auth/registrar", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    mostrarSucesso(`✅ ${novo.nome} cadastrado!`);
    formNovo.reset();
    document.getElementById("labelProfissionalVinculo").style.display = "block";
    await carregarUsuarios();
  } catch (err) {
    console.error(err);
    mostrarErro(err.message);
  }
});

async function removerUsuario(id, nome) {
  if (!confirm(`Remover o usuário "${nome}"?`)) return;

  try {
    await apiFetch(`/auth/usuarios/${id}`, { method: "DELETE" });
    await carregarUsuarios();
  } catch (err) {
    alert("❌ Erro ao remover: " + err.message);
  }
}

// ===================================================================
// =================  SELECT DE VÍNCULO (profissionais)  =============
// ===================================================================

function popularSelectVinculo() {
  const sel = document.getElementById("novoProfissionalId");
  if (!sel) return;

  sel.innerHTML = '<option value="">Selecione...</option>';
  profissionais
    .filter(p => p.ativo)
    .forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${p.nome} (${p.especialidade})</option>`;
    });
}

document.getElementById("novoPapel").addEventListener("change", (e) => {
  const ehProf = e.target.value === "profissional";
  document.getElementById("labelProfissionalVinculo").style.display = ehProf ? "block" : "none";
  if (!ehProf) document.getElementById("novoProfissionalId").value = "";
});

// ===================================================================
// =========================  ERROS UI  ==============================
// ===================================================================

function mostrarErro(msg) {
  erroBox.textContent = msg;
  erroBox.classList.add("visivel");
  erroBox.classList.remove("sucesso");
}

function mostrarSucesso(msg) {
  erroBox.textContent = msg;
  erroBox.classList.add("visivel", "sucesso");
  setTimeout(() => limparErro(), 4000);
}

function limparErro() {
  erroBox.textContent = "";
  erroBox.classList.remove("visivel", "sucesso");
}

function mostrarErroProf(msg) {
  erroProfBox.textContent = msg;
  erroProfBox.classList.add("visivel");
  erroProfBox.classList.remove("sucesso");
}

function mostrarSucessoProf(msg) {
  erroProfBox.textContent = msg;
  erroProfBox.classList.add("visivel", "sucesso");
  setTimeout(() => {
    erroProfBox.textContent = "";
    erroProfBox.classList.remove("visivel", "sucesso");
  }, 4000);
}

function limparErroProf() {
  erroProfBox.textContent = "";
  erroProfBox.classList.remove("visivel", "sucesso");
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
// =====================  ABA CONFIGURAÇÕES  =========================
// ===================================================================

async function carregarConfig() {
  try {
    const cfg = await API.buscarConfigEmpresa();

    document.getElementById("cfgNome").value = cfg.nome || "";
    document.getElementById("cfgWhatsapp").value = cfg.whatsapp || "";
    document.getElementById("cfgSmtpHost").value = cfg.smtpHost || "";
    document.getElementById("cfgSmtpPort").value = cfg.smtpPort || "";
    document.getElementById("cfgSmtpUser").value = cfg.smtpUser || "";
    document.getElementById("cfgSmtpPass").value = "";
    document.getElementById("cfgSmtpFrom").value = cfg.smtpFrom || "";
  } catch (err) {
    console.error("Erro ao carregar config:", err);
  }
}

document.getElementById("formConfig").addEventListener("submit", async (e) => {
  e.preventDefault();
  const erroBox = document.getElementById("cfgErro");
  erroBox.classList.remove("visivel", "sucesso");

  const dados = {
    nome: document.getElementById("cfgNome").value.trim(),
    whatsapp: document.getElementById("cfgWhatsapp").value.trim(),
    smtpHost: document.getElementById("cfgSmtpHost").value.trim(),
    smtpPort: document.getElementById("cfgSmtpPort").value || null,
    smtpUser: document.getElementById("cfgSmtpUser").value.trim(),
    smtpFrom: document.getElementById("cfgSmtpFrom").value.trim()
  };

  const senha = document.getElementById("cfgSmtpPass").value;
  if (senha) dados.smtpPass = senha;

  try {
    await API.atualizarConfigEmpresa(dados);
    erroBox.textContent = "✅ Configurações salvas!";
    erroBox.classList.add("visivel", "sucesso");
    document.getElementById("cfgSmtpPass").value = "";
    setTimeout(() => erroBox.classList.remove("visivel", "sucesso"), 4000);
  } catch (err) {
    erroBox.textContent = "❌ Erro: " + err.message;
    erroBox.classList.add("visivel");
  }
});

// Carrega ao iniciar
carregarConfig();

// ===================================================================
// =========================  INIT  ==================================
// ===================================================================

document.getElementById("nomeUsuario").textContent = _usuario.nome || "—";

document.getElementById("btnRecarregar").addEventListener("click", carregarUsuarios);
document.getElementById("btnRecarregarProf").addEventListener("click", carregarProfissionais);

// Carrega profissionais primeiro (o select de vínculo depende deles)
(async () => {
  await carregarProfissionais();
  await carregarUsuarios();
})();

// ===================================================================
// =====================  ABA CONFIGURAÇÕES  =========================
// ===================================================================

const formConfig = document.getElementById("formConfig");
const cfgErroBox = document.getElementById("cfgErro");

// ===== Carrega configurações da empresa =====
async function carregarConfig() {
  try {
    const cfg = await API.buscarConfigEmpresa();

    document.getElementById("cfgNome").value = cfg.nome || "";
    document.getElementById("cfgWhatsapp").value = cfg.whatsapp || "";
    document.getElementById("cfgSmtpHost").value = cfg.smtpHost || "";
    document.getElementById("cfgSmtpPort").value = cfg.smtpPort || "";
    document.getElementById("cfgSmtpUser").value = cfg.smtpUser || "";
    document.getElementById("cfgSmtpPass").value = ""; // nunca vem
    document.getElementById("cfgSmtpFrom").value = cfg.smtpFrom || "";

    console.log("✅ Configurações carregadas");
  } catch (err) {
    console.error("Erro ao carregar config:", err);
    mostrarErroCfg("Erro ao carregar configurações: " + err.message);
  }
}

// ===== Salva configurações =====
formConfig.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErroCfg();

  const dados = {
    nome: document.getElementById("cfgNome").value.trim(),
    whatsapp: document.getElementById("cfgWhatsapp").value.trim(),
    smtpHost: document.getElementById("cfgSmtpHost").value.trim(),
    smtpPort: document.getElementById("cfgSmtpPort").value || null,
    smtpUser: document.getElementById("cfgSmtpUser").value.trim(),
    smtpFrom: document.getElementById("cfgSmtpFrom").value.trim()
  };

  // Senha só vai se preenchida
  const senha = document.getElementById("cfgSmtpPass").value;
  if (senha) dados.smtpPass = senha;

  try {
    await API.atualizarConfigEmpresa(dados);
    mostrarSucessoCfg("✅ Configurações salvas!");
    document.getElementById("cfgSmtpPass").value = "";
  } catch (err) {
    console.error(err);
    mostrarErroCfg("❌ Erro ao salvar: " + err.message);
  }
});

// ===== Helpers de UI =====
function mostrarErroCfg(msg) {
  cfgErroBox.textContent = msg;
  cfgErroBox.classList.add("visivel");
  cfgErroBox.classList.remove("sucesso");
}

function mostrarSucessoCfg(msg) {
  cfgErroBox.textContent = msg;
  cfgErroBox.classList.add("visivel", "sucesso");
  setTimeout(() => limparErroCfg(), 4000);
}

function limparErroCfg() {
  cfgErroBox.textContent = "";
  cfgErroBox.classList.remove("visivel", "sucesso");
}

// ===== Máscara no WhatsApp (se mascaras.js estiver carregado) =====
if (typeof aplicarMascaraTelefone === "function") {
  aplicarMascaraTelefone(document.getElementById("cfgWhatsapp"));
}

// ===================================================================
// =================  UPLOAD DE LOGO  ================================
// ===================================================================

const inputLogo = document.getElementById("inputLogo");
const previewLogo = document.getElementById("previewLogo");
const btnEscolherLogo = document.getElementById("btnEscolherLogo");
const btnRemoverLogo = document.getElementById("btnRemoverLogo");

// Carrega logo atual ao abrir
async function carregarLogoAtual() {
  try {
    const cfg = await API.buscarConfigEmpresa();
    if (cfg.logoUrl) {
      previewLogo.innerHTML = `<img src="http://localhost:3000${cfg.logoUrl}" alt="Logo" />`;
      btnRemoverLogo.style.display = "inline-block";
    }

    if (cfg.corPrimaria) document.getElementById("corPrimaria").value = cfg.corPrimaria;
    if (cfg.corSecundaria) document.getElementById("corSecundaria").value = cfg.corSecundaria;
  } catch (err) {
    console.error("Erro ao carregar logo:", err);
  }
}

// Escolher arquivo
btnEscolherLogo.addEventListener("click", () => inputLogo.click());

// Upload
inputLogo.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert("Arquivo muito grande. Máximo: 2MB.");
    return;
  }

  // Preview local imediato
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewLogo.innerHTML = `<img src="${ev.target.result}" alt="Logo" />`;
  };
  reader.readAsDataURL(file);

  // Envia pro servidor
  const formData = new FormData();
  formData.append("logo", file);

  btnEscolherLogo.disabled = true;
  btnEscolherLogo.textContent = "⏳ Enviando...";

  try {
    const token = localStorage.getItem("token");
    const resp = await fetch("http://localhost:3000/api/empresas/upload-logo", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
      body: formData
    });

    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || "Erro no upload");

    btnRemoverLogo.style.display = "inline-block";
    alert("✅ Logo atualizada com sucesso!");
  } catch (err) {
    alert("❌ Erro: " + err.message);
    carregarLogoAtual(); // reverte preview
  } finally {
    btnEscolherLogo.disabled = false;
    btnEscolherLogo.textContent = "📤 Escolher logo";
    inputLogo.value = "";
  }
});

// Remover
btnRemoverLogo.addEventListener("click", async () => {
  if (!confirm("Remover a logo da clínica?")) return;

  try {
    const token = localStorage.getItem("token");
    await fetch("http://localhost:3000/api/empresas/logo", {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });

    previewLogo.innerHTML = '<span class="logo-vazio">Sem logo</span>';
    btnRemoverLogo.style.display = "none";
  } catch (err) {
    alert("❌ Erro: " + err.message);
  }
});

// Chama ao carregar
carregarLogoAtual();

// ===== Carrega config ao iniciar =====
carregarConfig();