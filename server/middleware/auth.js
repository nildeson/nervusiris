// ===================================================================
// ================  MIDDLEWARE DE AUTENTICAÇÃO  =====================
// ===================================================================

const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido no .env! O servidor não deve subir sem isso.");
  process.exit(1);
}

// ===== Verifica se o token é válido e injeta req.usuario =====
function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  const token = header.slice(7); // remove "Bearer "

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload; // { id, usuario, papel, profissionalId }
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

// ===== Exige que o usuário seja admin =====
function exigirAdmin(req, res, next) {
  if (!req.usuario || req.usuario.papel !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito a administradores" });
  }
  next();
}

function exigirSuper(req, res, next) {
  if (!req.usuario || req.usuario.papel !== "super") {
    return res.status(403).json({ erro: "Acesso restrito ao super admin" });
  }
  next();
}

module.exports = { autenticar, exigirAdmin, exigirSuper };