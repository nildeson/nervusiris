// ===================================================================
// =======================  SERVIDOR  ================================
// ===================================================================

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const path = require("path");

const { inicializarBanco } = require("./db");
const { autenticar } = require("./middleware/auth");
const { verificarTrial } = require("./middleware/trial");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares globais =====
// ===== CORS — permite origens confiáveis =====
const origensPermitidas = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "https://nervusiris.netlify.app",
  "https://www.nervusiris.netlify.app"
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Postman, mobile apps, etc)
    if (!origin) return callback(null, true);

    // Permite origens na lista
    if (origensPermitidas.includes(origin)) {
      return callback(null, true);
    }

    // Em desenvolvimento, permite tudo
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    console.warn(`⚠️ CORS bloqueado: ${origin}`);
    callback(new Error("Origem não permitida"));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

// ===== Middleware de debug =====
app.use((req, res, next) => {
  if (req.method === "POST" || req.method === "PUT") {
    console.log(`📥 ${req.method} ${req.url}`);
    console.log("   Content-Type:", req.headers["content-type"]);
    console.log("   Body:", req.body);
  }
  next();
});

// ===== Servir arquivos estáticos (logos) =====
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===================================================================
// ======================  ROTA DE BOAS-VINDAS  ======================
// ===================================================================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    mensagem: "API Nervus Iris funcionando 🚀",
    endpoints: [
      "POST   /api/auth/login",
      "POST   /api/auth/registrar",
      "GET    /api/auth/me",
      "GET    /api/auth/usuarios",
      "GET    /api/profissionais",
      "POST   /api/profissionais",
      "GET    /api/consultas",
      "GET    /api/consultas/:id",
      "POST   /api/consultas",
      "PUT    /api/consultas/:id",
      "DELETE /api/consultas/:id",
      "GET    /api/super/estatisticas",
      "GET    /api/super/empresas",
      "POST   /api/super/empresas",
      "GET    /api/super/empresas/:id",
      "PATCH  /api/super/empresas/:id/ativo",
      "DELETE /api/super/empresas/:id",
      "GET    /api/pacientes",
      "POST   /api/pacientes",
      "GET    /api/pacientes/:id",
      "PUT    /api/pacientes/:id",
      "DELETE /api/pacientes/:id",
      "POST   /api/pacientes/:id/anotacoes",
      "DELETE /api/pacientes/:id/anotacoes/:anotacaoId",
      "GET    /api/receitas/paciente/:pacienteId",
      "POST   /api/receitas",
      "PUT    /api/receitas/:id",
      "DELETE /api/receitas/:id",
      "GET    /api/agenda/profissionais",
      "GET    /api/agenda/slots-ocupados",
      "GET    /api/agenda/config",
      "POST   /api/agenda/agendar"
    ]
  });
});

// ===================================================================
// ===========  ROTAS PÚBLICAS (NÃO PASSAM PELO TRIAL)  ==============
// ===================================================================

// Auth (login/registro)
const authRouter = require("./routes/auth");
app.use("/api/auth", authRouter);

// Super admin (dono do SaaS — sempre acesso)
const superRouter = require("./routes/super");
app.use("/api/super", superRouter);

// Agenda pública (paciente não logado)
const agendaRouter = require("./routes/agenda");
app.use("/api/agenda", agendaRouter);


// ===================================================================
// =====  GET /api/status-trial (SEM trial — sempre acessível)  ======
// ===================================================================
const { get } = require("./db");

app.get("/api/status-trial", autenticar, async (req, res) => {
  try {
    const empresa = await get(
      "SELECT plano, trialInicio, trialExpiraEm, modulos FROM empresas WHERE id = ?",
      [req.usuario.empresaId || 1]
    );

    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

    const agora = new Date();
    const expira = empresa.trialExpiraEm ? new Date(empresa.trialExpiraEm) : null;
    const dias = expira
      ? Math.max(0, Math.ceil((expira - agora) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      plano: empresa.plano || "trial",
      trialInicio: empresa.trialInicio,
      trialExpiraEm: empresa.trialExpiraEm,
      diasRestantes: dias,
      expirado: expira ? agora > expira : false,
      modulos: empresa.modulos ? JSON.parse(empresa.modulos) : ["optometria"]
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar status" });
  }
});

app.get("/api/empresas/por-dominio", async (req, res) => {
  const dominio = req.query.dominio || req.headers.host;

  const empresa = await get(
    "SELECT id, nome, slug, logoUrl, corPrimaria FROM empresas WHERE dominio = ?",
    [dominio]
  );

  if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });
  res.json(empresa);
});
// ===================================================================
// ===========  ROTAS PROTEGIDAS (AUTENTICAÇÃO + TRIAL)  =============
// ===================================================================

const consultasRouter = require("./routes/consultas");
const pacientesRouter = require("./routes/pacientes");
const profissionaisRouter = require("./routes/profissionais");
const receitasRouter = require("./routes/receitas");
const empresasRouter = require("./routes/empresas");

app.use("/api/consultas", autenticar, verificarTrial, consultasRouter);
app.use("/api/pacientes", autenticar, verificarTrial, pacientesRouter);
app.use("/api/profissionais", autenticar, verificarTrial, profissionaisRouter);
app.use("/api/receitas", autenticar, verificarTrial, receitasRouter);
app.use("/api/empresas", autenticar, verificarTrial, empresasRouter);

// ===================================================================
// ================  HANDLER DE ERRO (SEMPRE POR ÚLTIMO)  ============
// ===================================================================
app.use((err, req, res, next) => {
  console.error("💥", err);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

// ===================================================================
// ===========================  START  ===============================
// ===================================================================
inicializarBanco()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "development"}`);
      console.log(`📚 Endpoints disponíveis em http://localhost:${PORT}/`);
    });
  })
  .catch(err => {
    console.error("💥 Falha ao inicializar banco:", err);
    process.exit(1);
  });