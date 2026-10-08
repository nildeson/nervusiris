// ===================================================================
// =================  ROTAS PÚBLICAS DE AGENDA  ======================
// ===================================================================
// Só retorna o MÍNIMO necessário pro paciente ver horários livres.
// NÃO expõe: nome, telefone, queixa, histórico.
// ===================================================================

const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { rateLimit } = require("../middleware/rateLimit");

// Aplica rate limit em todas as rotas deste arquivo
router.use(rateLimit);

// ===================================================================
// =====  GET /api/agenda/profissionais  ============================
// =====  Lista profissionais ativos (só nome + especialidade)  =====
// ===================================================================
router.get("/profissionais", async (req, res) => {
  try {
    const rows = await all(
      `SELECT id, nome, especialidade
       FROM profissionais
       WHERE ativo = 1
       ORDER BY nome`
    );
    res.json(rows);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar profissionais" });
  }
});

// ===================================================================
// =====  GET /api/agenda/slots-ocupados  ===========================
// =====  Query: profissionalId, data  =============================
// ===================================================================
router.get("/slots-ocupados", async (req, res) => {
  try {
    const { profissionalId, data } = req.query;

    if (!profissionalId || !data) {
      return res.status(400).json({ erro: "Profissional e data obrigatórios" });
    }

    // Valida formato da data (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ erro: "Data inválida" });
    }

    // Retorna SÓ horários ocupados (sem dados de paciente)
    const rows = await all(
      `SELECT hora, duracao
       FROM consultas
       WHERE profissionalId = ?
         AND data = ?
         AND status != 'cancelada'
       ORDER BY hora`,
      [profissionalId, data]
    );

    res.json(rows.map(r => ({ hora: r.hora, duracao: r.duracao || 30 })));
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar disponibilidade" });
  }
});

// ===================================================================
// =====  GET /api/agenda/config  ===================================
// =====  Dados públicos da empresa (nome, whatsapp)  ===============
// ===================================================================
router.get("/config", async (req, res) => {
  try {
    // Pega a empresa 1 (ou a primeira ativa)
    const empresa = await all(
      `SELECT nome, whatsapp FROM empresas WHERE ativo = 1 LIMIT 1`
    );

    if (empresa.length === 0) {
      return res.json({ nome: "Nervus Iris", whatsapp: null });
    }

    res.json({
      nome: empresa[0].nome,
      whatsapp: empresa[0].whatsapp
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar config" });
  }
});

// ===================================================================
// =====  POST /api/agenda/agendar  ==================================
// =====  Rota PÚBLICA pra criar consulta (sem login)  ===============
// ===================================================================
router.post("/agendar", async (req, res) => {
  try {
    const c = req.body;

    // Validações básicas
    if (!c.nome || !c.telefone || !c.especialidade || !c.profissionalId || !c.data || !c.hora) {
      return res.status(400).json({ erro: "Campos obrigatórios faltando" });
    }

    // Força valores seguros (não confiar no cliente)
    c.status = "aguardando-confirmacao";
    c.origem = "online";
    c.empresaId = 1;   // TODO: detectar empresa pelo profissionalId

    // 🔑 Escolhe uma sala livre automaticamente
    const SALAS = ["s1", "s2", "s3", "s4", "s5"];
    let salaEscolhida = null;
    for (const salaId of SALAS) {
      const ocupada = await get(
        `SELECT id FROM consultas
         WHERE data = ? AND hora = ? AND salaId = ? AND status != 'cancelada'`,
        [c.data, c.hora, salaId]
      );
      if (!ocupada) {
        salaEscolhida = salaId;
        break;
      }
    }
    if (!salaEscolhida) {
      return res.status(400).json({ erro: "Nenhuma sala disponível nesse horário." });
    }
    c.salaId = salaEscolhida;

    // 🔑 Verifica se o profissional já tem consulta nesse horário
    const conflitoProf = await get(
      `SELECT id FROM consultas
       WHERE data = ? AND hora = ? AND profissionalId = ? AND status != 'cancelada'`,
      [c.data, c.hora, c.profissionalId]
    );
    if (conflitoProf) {
      return res.status(400).json({ erro: "Profissional já tem consulta nesse horário." });
    }

    // 🔑 Busca ou cria paciente
    let pacienteId = null;

    if (c.cpf) {
      const p = await get(
        "SELECT id FROM pacientes WHERE cpf = ? AND empresaId = ? AND ativo = 1",
        [c.cpf, c.empresaId]
      );
      if (p) pacienteId = p.id;
    }
    if (!pacienteId && c.telefone) {
      const p = await get(
        "SELECT id FROM pacientes WHERE telefone = ? AND empresaId = ? AND ativo = 1",
        [c.telefone, c.empresaId]
      );
      if (p) pacienteId = p.id;
    }
    if (!pacienteId) {
      const resultPac = await run(
        `INSERT INTO pacientes (empresaId, nome, cpf, telefone, email, nascimento)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [c.empresaId, c.nome, c.cpf || null, c.telefone || null, c.email || null, c.nascimento || null]
      );
      pacienteId = resultPac.lastInsertRowid;
      console.log(`👤 Paciente criado (online): ${c.nome} (id ${pacienteId})`);
    }

    // 🔑 Insere a consulta
    const result = await run(
      `INSERT INTO consultas
        (empresaId, pacienteId, nome, telefone, email, nascimento, cpf, especialidade,
         profissionalId, salaId, data, hora, duracao, obs,
         triagem, lgpd, status, origem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.empresaId,
        pacienteId,
        c.nome,
        c.telefone,
        c.email || null,
        c.nascimento || null,
        c.cpf || null,
        c.especialidade,
        c.profissionalId,
        c.salaId,
        c.data,
        c.hora,
        c.duracao || 30,
        c.obs || null,
        c.triagem ? JSON.stringify(c.triagem) : null,
        c.lgpd ? JSON.stringify(c.lgpd) : null,
        "aguardando-confirmacao",
        "online"
      ]
    );

    const nova = await get("SELECT * FROM consultas WHERE id = ?", [result.lastInsertRowid]);

    // Responde com dados mínimos (não expõe tudo)
    res.status(201).json({
      id: nova.id,
      nome: nova.nome,
      data: nova.data,
      hora: nova.hora,
      status: nova.status
    });

    // Envia e-mail em background
    if (nova.email) {
      const { enviarEmailConfirmacao } = require("../mailer");
      enviarEmailConfirmacao(nova).catch(err =>
        console.error("⚠️ Falha ao enviar e-mail:", err.message)
      );
    }
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar consulta" });
  }
});
module.exports = router;