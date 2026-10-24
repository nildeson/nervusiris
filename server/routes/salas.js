const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar, exigirAdmin } = require("../middleware/auth");

// Listar salas (público para a tela de agendamento)
router.get("/", async (req, res) => {
  try {
    // Se não tiver token (paciente), busca as salas da empresa 1
    // Se tiver token (admin), busca da empresa logada
    const empresaId = req.usuario?.empresaId || 1; 
    const salas = await all("SELECT * FROM salas WHERE empresaId = ? AND ativo = 1 ORDER BY nome", [empresaId]);
    res.json(salas);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar salas" });
  }
});

// Criar sala (só admin)
router.post("/", autenticar, exigirAdmin, async (req, res) => {
  try {
    const { nome } = req.body;
    const empresaId = req.usuario.empresaId || 1;
    const id = `s_${Date.now()}`; // Gera um ID único

    await run("INSERT INTO salas (empresaId, id, nome) VALUES (?, ?, ?)", [empresaId, id, nome]);
    res.status(201).json({ id, nome, ativo: 1 });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar sala" });
  }
});

// Desativar sala (só admin)
router.delete("/:id", autenticar, exigirAdmin, async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    await run("UPDATE salas SET ativo = 0 WHERE id = ? AND empresaId = ?", [req.params.id, empresaId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao remover sala" });
  }
});

module.exports = router;