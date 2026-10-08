// ===================================================================
// ===============  MIDDLEWARE DE TRIAL / PLANO  =====================
// ===================================================================
// Verifica se a empresa do usuário tem acesso liberado.
// Se trial expirou e não tem plano pago → bloqueia.
// ===================================================================

const { get } = require("../db");

// ===== Descobre se o trial expirou =====
function trialExpirado(empresa) {
  if (!empresa) return true;
  if (empresa.plano && empresa.plano !== "trial") return false;
  if (!empresa.trialExpiraEm) return false;

  const agora = new Date();
  const expira = new Date(empresa.trialExpiraEm);

  return agora > expira;
}

// ===== Dias restantes =====
function diasRestantes(empresa) {
  if (!empresa || !empresa.trialExpiraEm) return null;

  const agora = new Date();
  const expira = new Date(empresa.trialExpiraEm);
  const diff = Math.ceil((expira - agora) / (1000 * 60 * 60 * 24));

  return Math.max(0, diff);
}

// ===================================================================
// =========================  MIDDLEWARE  ============================
// ===================================================================
async function verificarTrial(req, res, next) {
  try {
    // 🆕 SEMPRE permite status-trial (pra o frontend saber se está bloqueado)
    if (req.path === "/status-trial" || req.path === "/minha") {
      return next();
    }

    // Super admin não é bloqueado
    if (req.usuario.papel === "super") return next();

    // Sem empresa → deixa passar
    if (!req.usuario.empresaId) return next();

    const empresa = await get(
      "SELECT id, nome, plano, trialExpiraEm, ativo, modulos FROM empresas WHERE id = ?",
      [req.usuario.empresaId]
    );

    if (!empresa) {
      return res.status(403).json({
        erro: "Empresa não encontrada",
        codigo: "EMPRESA_INVALIDA"
      });
    }

    // Empresa bloqueada manualmente
    if (Number(empresa.ativo) === 0) {
      return res.status(403).json({
        erro: "Sua conta está bloqueada. Entre em contato com o suporte.",
        codigo: "CONTA_BLOQUEADA"
      });
    }

    // Trial expirado?
    if (trialExpirado(empresa)) {
      return res.status(402).json({
        erro: "Seu período de teste de 30 dias expirou. Assine um plano para continuar.",
        codigo: "TRIAL_EXPIRADO",
        diasRestantes: 0
      });
    }

    // Anexa dados
    req.empresa = {
      id: empresa.id,
      nome: empresa.nome,
      plano: empresa.plano,
      modulos: empresa.modulos ? JSON.parse(empresa.modulos) : ["optometria"],
      trialExpiraEm: empresa.trialExpiraEm,
      diasRestantes: diasRestantes(empresa)
    };

    next();
  } catch (err) {
    console.error("💥 Erro no middleware de trial:", err);
    res.status(500).json({ erro: "Erro ao verificar acesso" });
  }
}
module.exports = { verificarTrial, trialExpirado, diasRestantes };