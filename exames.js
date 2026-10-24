const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar } = require("../middleware/auth");

router.use(autenticar);

// Salvar novo exame
router.post("/", async (req, res) => {
  try {
    const e = req.body;
    const empresaId = req.usuario.empresaId || 1;

    const result = await run(
      `INSERT INTO exames_optometricos 
        (empresaId, pacienteId, consultaId, profissionalId, anamnese, 
         acuidade_od_longe, acuidade_os_longe, acuidade_od_perto, acuidade_os_perto,
         autorrefrator, refracao, motilidade, visao_cores, fundo_olho) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId, e.pacienteId, e.consultaId || null, req.usuario.profissionalId,
        e.anamnese, e.acuidade_od_longe, e.acuidade_os_longe, e.acuidade_od_perto, e.acuidade_os_perto,
        e.autorrefrator, e.refracao, e.motilidade, e.visao_cores, e.fundo_olho
      ]
    );

    const novo = await get("SELECT * FROM exames_optometricos WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(novo);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao salvar exame" });
  }
});

// Listar exames de um paciente
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    const exames = await all(
      `SELECT e.*, p.nome as profissionalNome 
       FROM exames_optometricos e
       LEFT JOIN profissionais p ON e.profissionalId = p.id AND p.empresaId = e.empresaId
       WHERE e.pacienteId = ? AND e.empresaId = ?
       ORDER BY e.criadoEm DESC`,
      [req.params.pacienteId, empresaId]
    );
    res.json(exames);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar exames" });
  }
});

module.exports = router;