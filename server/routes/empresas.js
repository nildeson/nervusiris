const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", "logos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const empresaId = req.usuario.empresaId || 1;
    cb(null, `empresa-${empresaId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const permitidos = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (permitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato inválido. Use PNG, JPG, SVG ou WebP."));
    }
  }
});
// ===================================================================
// ====================  ROTAS DE EMPRESAS  ==========================
// ===================================================================

const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar, exigirAdmin } = require("../middleware/auth");

// ===================================================================
// ===== GET /api/empresas/minha — dados da empresa do usuário  ======
// ===================================================================
router.get("/minha", autenticar, async (req, res) => {
  try {
    const empresa = await get(
      `SELECT id, nome, slug, cnpj, email, telefone, whatsapp, ativo, criadoEm
       FROM empresas WHERE id = ?`,
      [req.usuario.empresaId || 1]
    );

    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });
    res.json(empresa);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar empresa" });
  }
});

// ===================================================================
// ===== GET /api/empresas/config — config SMTP/WhatsApp (admin)  ====
// ===================================================================
router.get("/config", autenticar, exigirAdmin, async (req, res) => {
  try {
    const empresa = await get(
      `SELECT id, nome, whatsapp,
              smtpHost, smtpPort, smtpUser, smtpFrom
       FROM empresas WHERE id = ?`,
      [req.usuario.empresaId || 1]
    );

    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });
    res.json(empresa);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar config" });
  }
});

// ===================================================================
// ===== PUT /api/empresas/config — atualiza config (admin)  =========
// ===================================================================
router.put("/config", autenticar, exigirAdmin, async (req, res) => {
  try {
    const { nome, whatsapp, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body;
    const empresaId = req.usuario.empresaId || 1;

    // Monta o UPDATE dinamicamente (só altera o que veio)
    const campos = [];
    const valores = [];

    if (nome !== undefined)     { campos.push("nome = ?");     valores.push(nome); }
    if (whatsapp !== undefined) { campos.push("whatsapp = ?"); valores.push(whatsapp); }
    if (smtpHost !== undefined) { campos.push("smtpHost = ?"); valores.push(smtpHost); }
    if (smtpPort !== undefined) { campos.push("smtpPort = ?"); valores.push(smtpPort); }
    if (smtpUser !== undefined) { campos.push("smtpUser = ?"); valores.push(smtpUser); }
    if (smtpPass !== undefined && smtpPass) { campos.push("smtpPass = ?"); valores.push(smtpPass); }
    if (smtpFrom !== undefined) { campos.push("smtpFrom = ?"); valores.push(smtpFrom); }

    if (campos.length === 0) {
      return res.status(400).json({ erro: "Nada para atualizar" });
    }

    valores.push(empresaId);

    await run(
      `UPDATE empresas SET ${campos.join(", ")} WHERE id = ?`,
      valores
    );

    const atualizada = await get(
      `SELECT id, nome, whatsapp, smtpHost, smtpPort, smtpUser, smtpFrom
       FROM empresas WHERE id = ?`,
      [empresaId]
    );

    res.json(atualizada);
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao atualizar config" });
  }
});

// ===================================================================
// =====  POST /api/empresas/upload-logo  ============================
// =====  Só admin — faz upload da logo da clínica  ==================
// ===================================================================
router.post("/upload-logo", exigirAdmin, upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado" });
    }

    const empresaId = req.usuario.empresaId || 1;
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    // Salva no banco
    await run("UPDATE empresas SET logoUrl = ? WHERE id = ?", [logoUrl, empresaId]);

    res.json({
      ok: true,
      logoUrl,
      mensagem: "Logo atualizada com sucesso!"
    });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao fazer upload" });
  }
});

// ===== DELETE /api/empresas/logo — remove logo =====
router.delete("/logo", exigirAdmin, async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    await run("UPDATE empresas SET logoUrl = NULL WHERE id = ?", [empresaId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover logo" });
  }
});

// ===================================================================
// =====  GET /api/empresas/status-trial  ============================
// ===================================================================
router.get("/status-trial", autenticar, async (req, res) => {
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

module.exports = router;