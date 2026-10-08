// ===================================================================
// ====================  BANCO DE DADOS (Turso)  =====================
// ===================================================================

const { createClient } = require("@libsql/client");
require("dotenv").config();

// ===== Cliente Turso =====
const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN
});

// ===================================================================
// =============  HELPERS PARA FACILITAR O USO  ======================
// ===================================================================

async function all(sql, args = []) {
  const res = await db.execute({ sql, args });
  return res.rows;
}

async function get(sql, args = []) {
  const res = await db.execute({ sql, args });
  return res.rows[0] || null;
}

async function run(sql, args = []) {
  const res = await db.execute({ sql, args });
  return {
    lastInsertRowid: Number(res.lastInsertRowid || 0),
    changes: res.rowsAffected || 0
  };
}

// ===================================================================
// ==========  HELPER: adicionar coluna se faltar  ===================
// ===================================================================
async function adicionarColunaSeFaltar(tabela, coluna, definicao) {
  try {
    await db.execute(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    console.log(`✅ Coluna ${coluna} adicionada em ${tabela}`);
  } catch (err) {
    if (!err.message.includes("duplicate column")) {
      console.error(`⚠️ Erro ao adicionar ${coluna} em ${tabela}:`, err.message);
    }
  }
}

// ===================================================================
// ==================  INICIALIZAÇÃO DAS TABELAS  ====================
// ===================================================================

async function inicializarBanco() {
  try {
    // ---- 1. Empresas ----
   // ---- 1. Empresas ----
await db.execute(`
  CREATE TABLE IF NOT EXISTS empresas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    slug           TEXT    UNIQUE,
    cnpj           TEXT,
    email          TEXT,
    telefone       TEXT,
    whatsapp       TEXT,
    ativo          INTEGER DEFAULT 1,

    -- Trial
    plano          TEXT    DEFAULT 'trial',
    trialInicio    TEXT,
    trialExpiraEm  TEXT,
    modulos        TEXT    DEFAULT '["optometria"]',

    -- SMTP
    smtpHost       TEXT,
    smtpPort       INTEGER,
    smtpUser       TEXT,
    smtpPass       TEXT,
    smtpFrom       TEXT,

    criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP
  );
`);
    // ---- 2. Empresa padrão ----
    const empresaPadrao = await get("SELECT id FROM empresas WHERE id = 1");
    if (!empresaPadrao) {
      await run(`
        INSERT INTO empresas (id, nome, slug, ativo)
        VALUES (1, 'Minha Clínica', 'minha-clinica', 1)
      `);
      console.log("✅ Empresa padrão criada (id=1)");
    }

    // ---- 3. Usuários ----
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        empresaId      INTEGER DEFAULT 1,
        usuario        TEXT    NOT NULL,
        senha          TEXT    NOT NULL,
        nome           TEXT    NOT NULL,
        papel          TEXT    NOT NULL DEFAULT 'profissional',
        profissionalId TEXT,
        ativo          INTEGER DEFAULT 1,
        criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ---- 4. Profissionais ----
    await db.execute(`
      CREATE TABLE IF NOT EXISTS profissionais (
        id             TEXT    NOT NULL,
        empresaId      INTEGER DEFAULT 1,
        nome           TEXT    NOT NULL,
        especialidade  TEXT    NOT NULL,
        ativo          INTEGER DEFAULT 1,
        criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (empresaId, id)
      );
    `);

    // ---- 5. Consultas ----
    await db.execute(`
      CREATE TABLE IF NOT EXISTS consultas (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        empresaId      INTEGER DEFAULT 1,
        nome           TEXT    NOT NULL,
        telefone       TEXT,
        email          TEXT,
        nascimento     TEXT,
        cpf            TEXT,
        especialidade  TEXT    NOT NULL,
        profissionalId TEXT    NOT NULL,
        salaId         TEXT    NOT NULL,
        data           TEXT    NOT NULL,
        hora           TEXT    NOT NULL,
        duracao        INTEGER DEFAULT 30,
        obs            TEXT,
        triagem        TEXT,
        lgpd           TEXT,
        status         TEXT    DEFAULT 'confirmada',
        origem         TEXT    DEFAULT 'presencial',
        criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ===== Tabela: pacientes =====
await db.execute(`
  CREATE TABLE IF NOT EXISTS pacientes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    empresaId      INTEGER NOT NULL,
    nome           TEXT    NOT NULL,
    cpf            TEXT,
    telefone       TEXT,
    email          TEXT,
    nascimento     TEXT,
    endereco       TEXT,
    cidade         TEXT,
    estado         TEXT,
    cep            TEXT,
    convenio       TEXT,
    observacoes    TEXT,
    ativo          INTEGER DEFAULT 1,
    criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP
  );
`);

// ===== Tabela: anotacoes =====
await db.execute(`
  CREATE TABLE IF NOT EXISTS anotacoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    empresaId      INTEGER NOT NULL,
    pacienteId     INTEGER NOT NULL,
    consultaId     INTEGER,
    profissionalId TEXT,
    titulo         TEXT,
    texto          TEXT    NOT NULL,
    tipo           TEXT    DEFAULT 'anotacao',
    criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP
  );
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS empresas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    slug           TEXT    UNIQUE,
    cnpj           TEXT,
    email          TEXT,
    telefone       TEXT,
    whatsapp       TEXT,
    ativo          INTEGER DEFAULT 1,

    -- Personalização
    logoUrl        TEXT,
    corPrimaria    TEXT    DEFAULT '#6b21a8',
    corSecundaria  TEXT    DEFAULT '#1e40af',

    -- Trial
    plano          TEXT    DEFAULT 'trial',
    trialInicio    TEXT,
    trialExpiraEm  TEXT,
    modulos        TEXT    DEFAULT '["optometria"]',

    -- SMTP
    smtpHost       TEXT,
    smtpPort       INTEGER,
    smtpUser       TEXT,
    smtpPass       TEXT,
    smtpFrom       TEXT,

    criadoEm       TEXT    DEFAULT CURRENT_TIMESTAMP
  );
`);



// ===== Migração: adicionar pacienteId em consultas =====
try {
  await db.execute("ALTER TABLE consultas ADD COLUMN pacienteId INTEGER");
  console.log("✅ Coluna pacienteId adicionada em consultas");
} catch (err) {
  if (!err.message.includes("duplicate column")) {
    console.warn("⚠️ pacienteId:", err.message);
  }
}

// ===== Migrações: personalização =====

await adicionarColunaSeFaltar("empresas", "dominio", "TEXT");
await adicionarColunaSeFaltar("empresas", "logoUrl", "TEXT");
await adicionarColunaSeFaltar("empresas", "corPrimaria", "TEXT DEFAULT '#6b21a8'");
await adicionarColunaSeFaltar("empresas", "corSecundaria", "TEXT DEFAULT '#1e40af'");

// ===== Migrações: trial =====
await adicionarColunaSeFaltar("empresas", "plano", "TEXT DEFAULT 'trial'");
await adicionarColunaSeFaltar("empresas", "trialInicio", "TEXT");
await adicionarColunaSeFaltar("empresas", "trialExpiraEm", "TEXT");
await adicionarColunaSeFaltar("empresas", "modulos", "TEXT");

    // ---- 6. Seed inicial de profissionais ----
    const totalProf = await get("SELECT COUNT(*) as n FROM profissionais");
    if (Number(totalProf.n) === 0) {
      const iniciais = [
        { id: "p1", nome: "Dra. Ana Souza",    especialidade: "Optometria" },
        { id: "p2", nome: "Dr. Carlos Lima",   especialidade: "Optometria" },
        { id: "p3", nome: "Dra. Marta Reis",   especialidade: "Oftalmologia" },
        { id: "p4", nome: "Dr. Pedro Alves",   especialidade: "Clínica Geral" },
        { id: "p5", nome: "Dra. Júlia Mendes", especialidade: "Psicologia" },
        { id: "p6", nome: "Dr. Rafael Costa",  especialidade: "Odontologia" }
      ];

      for (const p of iniciais) {
        await run(
          "INSERT INTO profissionais (empresaId, id, nome, especialidade) VALUES (1, ?, ?, ?)",
          [p.id, p.nome, p.especialidade]
        );
      }
      console.log("✅ Profissionais iniciais populados");
    }

    console.log("✅ Tabelas verificadas no Turso");
  } catch (err) {
    console.error("💥 Erro ao inicializar banco Turso:", err);
    throw err;
  }
}



// ===========================  EXPORT  ==============================
// ===================================================================

module.exports = {
  db,
  all,
  get,
  run,
  inicializarBanco
};