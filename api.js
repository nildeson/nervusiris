// ===================================================================
// ==================  MÓDULO DE API (FRONTEND)  =====================
// ===================================================================

// Detecta ambiente automaticamente
const API_URL = (() => {
  const host = window.location.hostname;

  // Em desenvolvimento
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000/api";
  }

  // Em produção (Render) — vai ser trocada após o deploy
  return "https://nervusiris.onrender.com/api";
})();

// ... resto do arquivo (apiFetch, etc)

// ===== Helper genérico de fetch =====
async function apiFetch(caminho, opcoes = {}) {
  const token = localStorage.getItem("token");

  const config = {
    method: opcoes.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": "Bearer " + token } : {}),
      ...(opcoes.headers || {})
    }
  };

  if (opcoes.body) config.body = opcoes.body;

  const resp = await fetch(`${API_URL}${caminho}`, config);

  // Só redireciona pra login se NÃO for rota pública
  const rotasPublicas = ["/agenda/"];
  const ehRotaPublica = rotasPublicas.some(r => caminho.startsWith(r));

  if (resp.status === 401 && !ehRotaPublica) {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "login.html";
    throw new Error("Sessão expirada");
  }

  // Trata erros lendo o body UMA única vez
  if (!resp.ok) {
    const texto = await resp.text();
    let detalhe = texto;

    try {
      const json = JSON.parse(texto);
      detalhe = json.erro || texto;
    } catch {
      // não era JSON
    }

    throw new Error(`API ${resp.status}: ${detalhe}`);
  }

  if (resp.status === 204) return null;
  return resp.json();
}

// ===================================================================
// =======================  ENDPOINTS  ===============================
// ===================================================================

const API = {
  // ===== Consultas =====
  listarConsultas: () => apiFetch("/consultas"),
  buscarConsulta: (id) => apiFetch(`/consultas/${id}`),
  criarConsulta: (dados) =>
    apiFetch("/consultas", {
      method: "POST",
      body: JSON.stringify(dados)
    }),
  atualizarConsulta: (id, dados) =>
    apiFetch(`/consultas/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados)
    }),
  removerConsulta: (id) =>
    apiFetch(`/consultas/${id}`, { method: "DELETE" }),

  buscarStatusTrial: () => apiFetch("/status-trial"),
  
  // ===== Profissionais =====
  listarProfissionais: () => apiFetch("/profissionais"),
  buscarProfissional: (id) => apiFetch(`/profissionais/${id}`),
  criarProfissional: (dados) =>
    apiFetch("/profissionais", {
      method: "POST",
      body: JSON.stringify(dados)
    }),
  atualizarProfissional: (id, dados) =>
    apiFetch(`/profissionais/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados)
    }),
  removerProfissional: (id) =>
    apiFetch(`/profissionais/${id}`, { method: "DELETE" }),
  
  // ===== Empresas =====
  buscarMinhaEmpresa: () => apiFetch("/empresas/minha"),
  buscarConfigEmpresa: () => apiFetch("/empresas/config"),
  atualizarConfigEmpresa: (dados) =>
    apiFetch("/empresas/config", {
      method: "PUT",
      body: JSON.stringify(dados)
    }),

  // ===== Super Admin =====
  estatisticasSuper: () => apiFetch("/super/estatisticas"),
  listarEmpresasSuper: () => apiFetch("/super/empresas"),
  buscarEmpresaSuper: (id) => apiFetch(`/super/empresas/${id}`),
  criarEmpresaSuper: (dados) =>
    apiFetch("/super/empresas", {
      method: "POST",
      body: JSON.stringify(dados)
    }),
  alterarAtivoEmpresaSuper: (id, ativo) =>
    apiFetch(`/super/empresas/${id}/ativo`, {
      method: "PATCH",
      body: JSON.stringify({ ativo })
    }),
      atualizarEmpresaSuper: (id, dados) =>
    apiFetch(`/super/empresas/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados)
    }),

  // ===== Pacientes =====
  listarPacientes: (busca = "") =>
    apiFetch("/pacientes" + (busca ? `?q=${encodeURIComponent(busca)}` : "")),
  buscarPaciente: (id) => apiFetch(`/pacientes/${id}`),
  criarPaciente: (dados) =>
    apiFetch("/pacientes", {
      method: "POST",
      body: JSON.stringify(dados)
    }),
  atualizarPaciente: (id, dados) =>
    apiFetch(`/pacientes/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados)
    }),
  removerPaciente: (id) =>
    apiFetch(`/pacientes/${id}`, { method: "DELETE" }),

  // ===== Receitas =====
  listarReceitasPaciente: (pacienteId) =>
    apiFetch(`/receitas/paciente/${pacienteId}`),
  buscarReceita: (id) => apiFetch(`/receitas/${id}`),
  criarReceita: (dados) =>
    apiFetch("/receitas", { method: "POST", body: JSON.stringify(dados) }),
  atualizarReceita: (id, dados) =>
    apiFetch(`/receitas/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  removerReceita: (id) =>
    apiFetch(`/receitas/${id}`, { method: "DELETE" }),

  // ===== Anotações (prontuário) =====
  criarAnotacao: (pacienteId, dados) =>
    apiFetch(`/pacientes/${pacienteId}/anotacoes`, {
      method: "POST",
      body: JSON.stringify(dados)
    }),
  removerAnotacao: (pacienteId, anotacaoId) =>
    apiFetch(`/pacientes/${pacienteId}/anotacoes/${anotacaoId}`, {
      method: "DELETE"
    }),

  // ===== Agenda pública (sem autenticação) =====
  listarProfissionaisPublico: () => apiFetch("/agenda/profissionais"),
  buscarSlotsOcupados: (profissionalId, data) =>
    apiFetch(`/agenda/slots-ocupados?profissionalId=${profissionalId}&data=${data}`),
  buscarConfigPublica: () => apiFetch("/agenda/config"),
  criarConsultaPublica: (dados) =>
    apiFetch("/agenda/agendar", {
      method: "POST",
      body: JSON.stringify(dados)
    })
};