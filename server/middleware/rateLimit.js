// ===================================================================
// ==============  RATE LIMITING (sem libs externas)  ================
// ===================================================================
// Bloqueia IPs que fazem muitas requisições em pouco tempo.
// 100% gratuito.
// ===================================================================

const tentativas = new Map();

const LIMITE = 30;          // máximo de requisições
const JANELA_MS = 60000;    // por 60 segundos

// Limpa entradas antigas a cada 5 minutos
setInterval(() => {
  const agora = Date.now();
  for (const [ip, dados] of tentativas.entries()) {
    if (agora - dados.inicio > JANELA_MS) {
      tentativas.delete(ip);
    }
  }
}, 5 * 60 * 1000);

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const agora = Date.now();

  if (!tentativas.has(ip)) {
    tentativas.set(ip, { count: 1, inicio: agora });
    return next();
  }

  const dados = tentativas.get(ip);

  // Se passou da janela, reseta
  if (agora - dados.inicio > JANELA_MS) {
    tentativas.set(ip, { count: 1, inicio: agora });
    return next();
  }

  // Se passou do limite, bloqueia
  if (dados.count >= LIMITE) {
    return res.status(429).json({
      erro: "Muitas requisições. Aguarde alguns instantes."
    });
  }

  dados.count++;
  next();
}

module.exports = { rateLimit };