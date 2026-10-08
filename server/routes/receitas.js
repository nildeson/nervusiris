// ===================================================================
// ====================  ROTAS DE RECEITAS  ==========================
// ===================================================================

const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar } = require("../middleware/auth");

router.use(autenticar);

// ===================================================================
// ==========  GET /api/receitas/paciente/:pacienteId  ===============
// ===================================================================
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    const receitas = await all(
      `SELECT r.*,
              (SELECT nome FROM profissionais WHERE id = r.profissionalId AND empresaId = r.empresaId) as profissionalNome
       FROM receitas r
       WHERE r.pacienteId = ? AND r.empresaId = ?
       ORDER BY r.criadoEm DESC`,
      [req.params.pacienteId, empresaId]
    );
    res.json(receitas);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar receitas" });
  }
});

// ===================================================================
// ==========  GET /api/receitas/:id  ================================
// ===================================================================
router.get("/:id", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    const receita = await get(
      "SELECT * FROM receitas WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!receita) return res.status(404).json({ erro: "Receita não encontrada" });
    res.json(receita);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar receita" });
  }
});

// ===================================================================
// ==========  POST /api/receitas  ===================================
// ===================================================================
router.post("/", async (req, res) => {
  try {
    const r = req.body;
    const empresaId = req.usuario.empresaId || 1;

    if (!r.pacienteId) {
      return res.status(400).json({ erro: "pacienteId é obrigatório" });
    }

    const result = await run(
      `INSERT INTO receitas
        (empresaId, pacienteId, consultaId, profissionalId,
         od_esf_longe, od_cil_longe, od_eixo_longe, od_dp,
         oe_esf_longe, oe_cil_longe, oe_eixo_longe, oe_dp,
         adicao,
         od_esf_perto, od_cil_perto, od_eixo_perto,
         oe_esf_perto, oe_cil_perto, oe_eixo_perto,
         observacoes, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        r.pacienteId,
        r.consultaId || null,
        req.usuario.profissionalId || null,
        r.od_esf_longe ?? null,
        r.od_cil_longe ?? null,
        r.od_eixo_longe ?? null,
        r.od_dp ?? null,
        r.oe_esf_longe ?? null,
        r.oe_cil_longe ?? null,
        r.oe_eixo_longe ?? null,
        r.oe_dp ?? null,
        r.adicao ?? null,
        r.od_esf_perto ?? null,
        r.od_cil_perto ?? null,
        r.od_eixo_perto ?? null,
        r.oe_esf_perto ?? null,
        r.oe_cil_perto ?? null,
        r.oe_eixo_perto ?? null,
        r.observacoes || null,
        r.tipo || "oculos"
      ]
    );

    const nova = await get("SELECT * FROM receitas WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(nova);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar receita" });
  }
});

// ===================================================================
// ==========  PUT /api/receitas/:id  ================================
// ===================================================================
router.put("/:id", async (req, res) => {
  try {
    const r = req.body;
    const empresaId = req.usuario.empresaId || 1;

    const existente = await get(
      "SELECT id FROM receitas WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!existente) return res.status(404).json({ erro: "Receita não encontrada" });

    await run(
      `UPDATE receitas SET
         od_esf_longe = ?, od_cil_longe = ?, od_eixo_longe = ?, od_dp = ?,
         oe_esf_longe = ?, oe_cil_longe = ?, oe_eixo_longe = ?, oe_dp = ?,
         adicao = ?,
         od_esf_perto = ?, od_cil_perto = ?, od_eixo_perto = ?,
         oe_esf_perto = ?, oe_cil_perto = ?, oe_eixo_perto = ?,
         observacoes = ?, tipo = ?
       WHERE id = ? AND empresaId = ?`,
      [
        r.od_esf_longe ?? null,
        r.od_cil_longe ?? null,
        r.od_eixo_longe ?? null,
        r.od_dp ?? null,
        r.oe_esf_longe ?? null,
        r.oe_cil_longe ?? null,
        r.oe_eixo_longe ?? null,
        r.oe_dp ?? null,
        r.adicao ?? null,
        r.od_esf_perto ?? null,
        r.od_cil_perto ?? null,
        r.od_eixo_perto ?? null,
        r.oe_esf_perto ?? null,
        r.oe_cil_perto ?? null,
        r.oe_eixo_perto ?? null,
        r.observacoes || null,
        r.tipo || "oculos",
        req.params.id,
        empresaId
      ]
    );

    const atualizada = await get("SELECT * FROM receitas WHERE id = ?", [req.params.id]);
    res.json(atualizada);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao atualizar receita" });
  }
});

// ===================================================================
// ==========  DELETE /api/receitas/:id  =============================
// ===================================================================
router.delete("/:id", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    const existente = await get(
      "SELECT id FROM receitas WHERE id = ? AND empresaId = ?",
      [req.params.id, empresaId]
    );
    if (!existente) return res.status(404).json({ erro: "Receita não encontrada" });

    await run("DELETE FROM receitas WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover receita" });
  }
});

module.exports = router;