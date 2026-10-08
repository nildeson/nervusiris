// ===================================================================
// ==================  ROTAS DO SUPER ADMIN  =========================
// ===================================================================
// Só o dono do SaaS acessa essas rotas.
// Permite criar empresas, listar, bloquear e ver estatísticas.
// ===================================================================

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { all, get, run } = require("../db");
const { autenticar, exigirSuper } = require("../middleware/auth");

// Todas as rotas exigem login + papel super
router.use(autenticar, exigirSuper);

// ===================================================================
// ==========  GET /api/super/estatisticas  ==========================
// ===================================================================
router.get("/estatisticas", async (req, res) => {
  try {
    const empresas = await get("SELECT COUNT(*) as n FROM empresas");
    const ativas = await get("SELECT COUNT(*) as n FROM empresas WHERE ativo = 1");
    const usuarios = await get("SELECT COUNT(*) as n FROM usuarios WHERE papel != 'super'");
    const consultas = await get("SELECT COUNT(*) as n FROM consultas");
    const profissionais = await get("SELECT COUNT(*) as n FROM profissionais WHERE ativo = 1");

    res.json({
      empresas: Number(empresas.n),
      empresasAtivas: Number(ativas.n),
      usuarios: Number(usuarios.n),
      consultas: Number(consultas.n),
      profissionais: Number(profissionais.n)
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar estatísticas" });
  }
});

// ===================================================================
// ==========  GET /api/super/empresas  ==============================
// ===================================================================
router.get("/empresas", async (req, res) => {
  try {
    const empresas = await all(`
      SELECT e.id, e.nome, e.slug, e.cnpj, e.email, e.telefone, e.whatsapp,
             e.ativo, e.criadoEm,
             (SELECT COUNT(*) FROM usuarios u WHERE u.empresaId = e.id) as totalUsuarios,
             (SELECT COUNT(*) FROM consultas c WHERE c.empresaId = e.id) as totalConsultas,
             (SELECT COUNT(*) FROM profissionais p WHERE p.empresaId = e.id AND p.ativo = 1) as totalProfissionais
      FROM empresas e
      ORDER BY e.criadoEm DESC
    `);

    res.json(empresas);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar empresas" });
  }
});

// ===================================================================
// ==========  POST /api/super/empresas  =============================
// ==========  Cria empresa + admin inicial  =========================
// ===================================================================
router.post("/empresas", async (req, res) => {
  try {
    const {
      nomeEmpresa,
      slug,
      cnpj,
      email,
      telefone,
      whatsapp,
      nomeAdmin,
      usuarioAdmin,
      senhaAdmin
    } = req.body;

    // Validações
    if (!nomeEmpresa || !slug || !nomeAdmin || !usuarioAdmin || !senhaAdmin) {
      return res.status(400).json({
        erro: "Campos obrigatórios: nomeEmpresa, slug, nomeAdmin, usuarioAdmin, senhaAdmin"
      });
    }

    if (senhaAdmin.length < 6) {
      return res.status(400).json({ erro: "Senha do admin precisa ter 6+ caracteres" });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        erro: "Slug deve conter apenas letras minúsculas, números e hífen"
      });
    }

    // Verifica se slug já existe
    const slugExiste = await get("SELECT id FROM empresas WHERE slug = ?", [slug]);
    if (slugExiste) {
      return res.status(400).json({ erro: "Já existe uma empresa com esse slug" });
    }

    // Verifica se usuário admin já existe
    const userExiste = await get("SELECT id FROM usuarios WHERE usuario = ?", [usuarioAdmin]);
    if (userExiste) {
      return res.status(400).json({ erro: "Usuário admin já existe" });
    }

    // 1. Cria a empresa
    const resultEmpresa = await run(
      `INSERT INTO empresas (nome, slug, cnpj, email, telefone, whatsapp, ativo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [nomeEmpresa, slug, cnpj || null, email || null, telefone || null, whatsapp || null]
    );

    const empresaId = resultEmpresa.lastInsertRowid;

    // 2. Cria o admin da empresa
    const hash = await bcrypt.hash(senhaAdmin, 10);

    const resultAdmin = await run(
      `INSERT INTO usuarios (empresaId, usuario, senha, nome, papel)
       VALUES (?, ?, ?, ?, 'admin')`,
      [empresaId, usuarioAdmin, hash, nomeAdmin]
    );

    // 3. Responde
    res.status(201).json({
      empresa: {
        id: empresaId,
        nome: nomeEmpresa,
        slug,
        ativo: 1
      },
      admin: {
        id: resultAdmin.lastInsertRowid,
        usuario: usuarioAdmin,
        nome: nomeAdmin
      }
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar empresa" });
  }
});

// ===================================================================
// ==========  PATCH /api/super/empresas/:id/ativo  ==================
// ==========  Bloqueia ou desbloqueia empresa  ======================
// ===================================================================
router.patch("/empresas/:id/ativo", async (req, res) => {
  try {
    const { ativo } = req.body;

    if (typeof ativo !== "number" || ![0, 1].includes(ativo)) {
      return res.status(400).json({ erro: "Campo 'ativo' deve ser 0 ou 1" });
    }

    const existente = await get("SELECT id FROM empresas WHERE id = ?", [req.params.id]);
    if (!existente) return res.status(404).json({ erro: "Empresa não encontrada" });

    await run("UPDATE empresas SET ativo = ? WHERE id = ?", [ativo, req.params.id]);

    res.json({
      ok: true,
      empresaId: Number(req.params.id),
      ativo
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao alterar status" });
  }
});

// ===================================================================
// ==========  GET /api/super/empresas/:id  ==========================
// ===================================================================
router.get("/empresas/:id", async (req, res) => {
  try {
    const empresa = await get("SELECT * FROM empresas WHERE id = ?", [req.params.id]);
    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

    // Lista os usuários da empresa
    const usuarios = await all(
      `SELECT id, usuario, nome, papel, profissionalId, ativo, criadoEm
       FROM usuarios WHERE empresaId = ? ORDER BY nome`,
      [req.params.id]
    );

    // Remove dados sensíveis de SMTP
    const { smtpPass, ...empresaSemSenha } = empresa;

    res.json({
      empresa: empresaSemSenha,
      usuarios
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar empresa" });
  }
});

// ===================================================================
// ==========  DELETE /api/super/empresas/:id  =======================
// ===================================================================
// ⚠️ CUIDADO: Só permite deletar se a empresa NÃO tem dados
router.delete("/empresas/:id", async (req, res) => {
  try {
    const existente = await get("SELECT id FROM empresas WHERE id = ?", [req.params.id]);
    if (!existente) return res.status(404).json({ erro: "Empresa não encontrada" });

    // Verifica se tem consultas
    const consultas = await get(
      "SELECT COUNT(*) as n FROM consultas WHERE empresaId = ?",
      [req.params.id]
    );

    if (Number(consultas.n) > 0) {
      return res.status(400).json({
        erro: `Esta empresa tem ${consultas.n} consultas. Use o bloqueio (ativo=0) em vez de deletar.`
      });
    }

    // Deleta usuários, profissionais e a empresa
    await run("DELETE FROM usuarios WHERE empresaId = ?", [req.params.id]);
    await run("DELETE FROM profissionais WHERE empresaId = ?", [req.params.id]);
    await run("DELETE FROM empresas WHERE id = ?", [req.params.id]);

    res.json({ ok: true, removida: Number(req.params.id) });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover empresa" });
  }
});

module.exports = router;