// ===================================================================
// ====================  ROTAS DE AUTENTICAÇÃO  ======================
// ===================================================================

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { all, get, run } = require("../db");
const { autenticar, exigirAdmin } = require("../middleware/auth");

require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ===== Helper: gera token JWT =====
function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      usuario: usuario.usuario,
      papel: usuario.papel,
      profissionalId: usuario.profissionalId,
      empresaId: usuario.empresaId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ===================================================================
// ==========  POST /api/auth/login  =================================
// ===================================================================
router.post("/login", async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Usuário e senha obrigatórios" });
    }

    const u = await get("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);

    if (!u || !u.ativo) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const senhaOk = await bcrypt.compare(senha, u.senha);
    if (!senhaOk) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const token = gerarToken(u);

    res.json({
      token,
      usuario: {
        id: u.id,
        usuario: u.usuario,
        nome: u.nome,
        papel: u.papel,
        profissionalId: u.profissionalId,
        empresaId: u.empresaId
      }
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao fazer login" });
  }
});

// ===================================================================
// ==========  POST /api/auth/registrar (só admin)  ==================
// ===================================================================
router.post("/registrar", autenticar, exigirAdmin, async (req, res) => {
  try {
    const { usuario, senha, nome, papel, profissionalId } = req.body;

    if (!usuario || !senha || !nome) {
      return res.status(400).json({ erro: "Usuário, senha e nome são obrigatórios" });
    }

    if (!["admin", "profissional"].includes(papel)) {
      return res.status(400).json({ erro: "Papel deve ser 'admin' ou 'profissional'" });
    }

    if (papel === "profissional" && !profissionalId) {
      return res.status(400).json({ erro: "Profissional precisa de profissionalId" });
    }

    const existe = await get("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);
    if (existe) {
      return res.status(400).json({ erro: "Usuário já existe" });
    }

    const hash = await bcrypt.hash(senha, 10);

    const result = await run(
      `INSERT INTO usuarios (empresaId, usuario, senha, nome, papel, profissionalId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.usuario.empresaId || 1, usuario, hash, nome, papel, profissionalId || null]
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      usuario,
      nome,
      papel,
      profissionalId: profissionalId || null,
      empresaId: req.usuario.empresaId || 1
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao registrar usuário" });
  }
});

// ===================================================================
// ==========  GET /api/auth/me  =====================================
// ===================================================================
router.get("/me", autenticar, async (req, res) => {
  try {
    const u = await get(
      `SELECT id, usuario, nome, papel, profissionalId, ativo, empresaId
       FROM usuarios WHERE id = ?`,
      [req.usuario.id]
    );
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado" });
    res.json(u);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar usuário" });
  }
});

// ===================================================================
// ==========  GET /api/auth/usuarios (só admin)  ====================
// ===================================================================
router.get("/usuarios", autenticar, exigirAdmin, async (req, res) => {
  try {
    const lista = await all(
      `SELECT id, usuario, nome, papel, profissionalId, ativo, empresaId, criadoEm
       FROM usuarios
       WHERE empresaId = ?
       ORDER BY nome`,
      [req.usuario.empresaId || 1]
    );
    res.json(lista);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao listar usuários" });
  }
});

// ===================================================================
// ==========  DELETE /api/auth/usuarios/:id (só admin)  =============
// ===================================================================
router.delete("/usuarios/:id", autenticar, exigirAdmin, async (req, res) => {
  try {
    const existente = await get(
      "SELECT id, empresaId FROM usuarios WHERE id = ?",
      [req.params.id]
    );
    if (!existente) return res.status(404).json({ erro: "Usuário não encontrado" });

    // Só permite deletar usuários da própria empresa
    if (Number(existente.empresaId) !== Number(req.usuario.empresaId)) {
      return res.status(403).json({ erro: "Sem permissão" });
    }

    await run("DELETE FROM usuarios WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover usuário" });
  }
});

module.exports = router;