// ===================================================================
// =================  ROTAS DE PROFISSIONAIS  ========================
// ===================================================================

const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar, exigirAdmin } = require("../middleware/auth");

// ===================================================================
// ==========  GET /api/profissionais — lista (público)  =============
// ===================================================================
router.get("/", async (req, res) => {
  try {
    // Público: pacientes agendam sem estar logados,
    // então deixamos listar os profissionais ativos.
    // Por enquanto, todos da empresa 1 (ajustar quando multi-tenant real).
    const lista = await all(
      `SELECT * FROM profissionais
       WHERE ativo = 1
       ORDER BY nome`
    );
    res.json(lista);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar profissionais" });
  }
});

// ===================================================================
// ==========  GET /api/profissionais/:id  ===========================
// ===================================================================
router.get("/:id", async (req, res) => {
  try {
    const p = await get("SELECT * FROM profissionais WHERE id = ?", [req.params.id]);
    if (!p) return res.status(404).json({ erro: "Profissional não encontrado" });
    res.json(p);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar profissional" });
  }
});

// ===================================================================
// ==========  POST /api/profissionais (só admin)  ===================
// ===================================================================
router.post("/", autenticar, exigirAdmin, async (req, res) => {
  try {
    const { id, nome, especialidade } = req.body;

    if (!id || !nome || !especialidade) {
      return res.status(400).json({ erro: "ID, nome e especialidade são obrigatórios" });
    }

    if (!/^p\d+$/.test(id)) {
      return res.status(400).json({ erro: "ID deve ter o formato p1, p2, p3..." });
    }

    const empresaId = req.usuario.empresaId || 1;

    const existe = await get(
      "SELECT id FROM profissionais WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );
    if (existe) {
      return res.status(400).json({ erro: "Já existe um profissional com esse ID" });
    }

    await run(
      "INSERT INTO profissionais (empresaId, id, nome, especialidade) VALUES (?, ?, ?, ?)",
      [empresaId, id, nome, especialidade]
    );

    const novo = await get(
      "SELECT * FROM profissionais WHERE id = ? AND empresaId = ?",
      [id, empresaId]
    );
    res.status(201).json(novo);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar profissional" });
  }
});

// ===================================================================
// ==========  PUT /api/profissionais/:id (só admin)  ================
// ===================================================================
router.put("/:id", autenticar, exigirAdmin, async (req, res) => {
  try {
    const { nome, especialidade, ativo } = req.body;
    const empresaId = req.usuario.empresaId || 1;

    const existente = await get(
      "SELECT * FROM profissionais WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!existente) return res.status(404).json({ erro: "Profissional não encontrado" });

    await run(
      `UPDATE profissionais
       SET nome = ?, especialidade = ?, ativo = ?
       WHERE id = ? AND empresaId = ?`,
      [
        nome ?? existente.nome,
        especialidade ?? existente.especialidade,
        ativo ?? existente.ativo,
        req.params.id,
        empresaId
      ]
    );

    const atualizado = await get(
      "SELECT * FROM profissionais WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    res.json(atualizado);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao atualizar profissional" });
  }
});

// ===================================================================
// ==========  DELETE /api/profissionais/:id (só admin)  =============
// ===================================================================
// Soft delete: marca ativo=0
router.delete("/:id", autenticar, exigirAdmin, async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;

    const existente = await get(
      "SELECT id FROM profissionais WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!existente) return res.status(404).json({ erro: "Profissional não encontrado" });

    await run(
      "UPDATE profissionais SET ativo = 0 WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    res.json({ ok: true, desativado: req.params.id });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover profissional" });
  }
});

module.exports = router;