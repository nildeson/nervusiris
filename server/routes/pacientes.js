// ===================================================================
// ====================  ROTAS DE PACIENTES  =========================
// ===================================================================

const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar } = require("../middleware/auth");

// Todos exigem login
router.use(autenticar);

// ===================================================================
// ==========  GET /api/pacientes  ===================================
// ==========  Lista pacientes da empresa  ===========================
// ===================================================================
router.get("/", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    const busca = req.query.q || "";

    let sql = `
      SELECT p.*,
             (SELECT COUNT(*) FROM consultas c WHERE c.pacienteId = p.id) as totalConsultas,
             (SELECT MAX(c.data) FROM consultas c WHERE c.pacienteId = p.id) as ultimaConsulta
      FROM pacientes p
      WHERE p.empresaId = ? AND p.ativo = 1
    `;
    const params = [empresaId];

    if (busca) {
      sql += ` AND (p.nome LIKE ? OR p.cpf LIKE ? OR p.telefone LIKE ?)`;
      const termo = `%${busca}%`;
      params.push(termo, termo, termo);
    }

    sql += ` ORDER BY p.nome`;

    const lista = await all(sql, params);
    res.json(lista);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar pacientes" });
  }
});

// ===================================================================
// ==========  GET /api/pacientes/:id  ===============================
// ===================================================================
router.get("/:id", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;

    const paciente = await get(
      "SELECT * FROM pacientes WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!paciente) return res.status(404).json({ erro: "Paciente não encontrado" });

    // Consultas do paciente
    const consultas = await all(
      `SELECT c.*,
              (SELECT nome FROM profissionais WHERE id = c.profissionalId AND empresaId = c.empresaId) as profissionalNome
       FROM consultas c
       WHERE c.pacienteId = ? AND c.empresaId = ?
       ORDER BY c.data DESC, c.hora DESC`,
      [req.params.id, empresaId]
    );

    // Anotações (prontuário)
    const anotacoes = await all(
      `SELECT a.*,
              (SELECT nome FROM profissionais WHERE id = a.profissionalId AND empresaId = a.empresaId) as profissionalNome
       FROM anotacoes a
       WHERE a.pacienteId = ? AND a.empresaId = ?
       ORDER BY a.criadoEm DESC`,
      [req.params.id, empresaId]
    );

    res.json({ paciente, consultas, anotacoes });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar paciente" });
  }
});

// ===================================================================
// ==========  POST /api/pacientes  ==================================
// ===================================================================
router.post("/", async (req, res) => {
  try {
    const p = req.body;
    const empresaId = req.usuario.empresaId || 1;

    if (!p.nome) {
      return res.status(400).json({ erro: "Nome é obrigatório" });
    }

    // Verifica CPF duplicado
    if (p.cpf) {
      const existe = await get(
        "SELECT id FROM pacientes WHERE cpf = ? AND empresaId = ? AND ativo = 1",
        [p.cpf, empresaId]
      );
      if (existe) {
        return res.status(400).json({
          erro: "Já existe um paciente com esse CPF",
          pacienteId: existe.id
        });
      }
    }

    const result = await run(
      `INSERT INTO pacientes
        (empresaId, nome, cpf, telefone, email, nascimento, endereco,
         cidade, estado, cep, convenio, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        p.nome,
        p.cpf || null,
        p.telefone || null,
        p.email || null,
        p.nascimento || null,
        p.endereco || null,
        p.cidade || null,
        p.estado || null,
        p.cep || null,
        p.convenio || null,
        p.observacoes || null
      ]
    );

    const novo = await get("SELECT * FROM pacientes WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(novo);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar paciente" });
  }
});

// ===================================================================
// ==========  PUT /api/pacientes/:id  ===============================
// ===================================================================
router.put("/:id", async (req, res) => {
  try {
    const p = req.body;
    const empresaId = req.usuario.empresaId || 1;

    const existente = await get(
      "SELECT id FROM pacientes WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!existente) return res.status(404).json({ erro: "Paciente não encontrado" });

    await run(
      `UPDATE pacientes SET
         nome = ?, cpf = ?, telefone = ?, email = ?, nascimento = ?,
         endereco = ?, cidade = ?, estado = ?, cep = ?,
         convenio = ?, observacoes = ?
       WHERE id = ? AND empresaId = ?`,
      [
        p.nome,
        p.cpf || null,
        p.telefone || null,
        p.email || null,
        p.nascimento || null,
        p.endereco || null,
        p.cidade || null,
        p.estado || null,
        p.cep || null,
        p.convenio || null,
        p.observacoes || null,
        req.params.id,
        empresaId
      ]
    );

    const atualizado = await get("SELECT * FROM pacientes WHERE id = ?", [req.params.id]);
    res.json(atualizado);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao atualizar paciente" });
  }
});

// ===================================================================
// ==========  DELETE /api/pacientes/:id  ============================
// ===================================================================
router.delete("/:id", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;

    const existente = await get(
      "SELECT id FROM pacientes WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!existente) return res.status(404).json({ erro: "Paciente não encontrado" });

    await run(
      "UPDATE pacientes SET ativo = 0 WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    res.json({ ok: true, desativado: Number(req.params.id) });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover paciente" });
  }
});

// ===================================================================
// ==========  POST /api/pacientes/:id/anotacoes  ====================
// ===================================================================
router.post("/:id/anotacoes", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    const { titulo, texto, tipo, consultaId } = req.body;

    if (!texto) return res.status(400).json({ erro: "Texto da anotação é obrigatório" });

    const paciente = await get(
      "SELECT id FROM pacientes WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!paciente) return res.status(404).json({ erro: "Paciente não encontrado" });

    const result = await run(
      `INSERT INTO anotacoes
        (empresaId, pacienteId, consultaId, profissionalId, titulo, texto, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        req.params.id,
        consultaId || null,
        req.usuario.profissionalId || null,
        titulo || null,
        texto,
        tipo || "anotacao"
      ]
    );

    const nova = await get("SELECT * FROM anotacoes WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(nova);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar anotação" });
  }
});

// ===================================================================
// ==========  DELETE /api/pacientes/:id/anotacoes/:anotacaoId  ======
// ===================================================================
router.delete("/:id/anotacoes/:anotacaoId", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;

    const existe = await get(
      "SELECT id FROM anotacoes WHERE id = ? AND pacienteId = ? AND empresaId = ?",
      [req.params.anotacaoId, req.params.id, empresaId]
    );
    if (!existe) return res.status(404).json({ erro: "Anotação não encontrada" });

    await run("DELETE FROM anotacoes WHERE id = ?", [req.params.anotacaoId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover anotação" });
  }
});

module.exports = router;