// ===================================================================
// ===============  ENVIO DE E-MAIL (multi-tenant)  ==================
// ===================================================================

const nodemailer = require("nodemailer");
const db = require("./db");
require("dotenv").config();

// ===================================================================
// ==============  Resolve config SMTP para a empresa  ===============
// ===================================================================
async function obterConfigSMTP(empresaId) {
  // 1. Tenta buscar config específica da empresa
  let empresa = null;
  try {
    const { get } = require("./db");
    empresa = await get(
      `SELECT smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, nome
       FROM empresas WHERE id = ?`,
      [empresaId]
    );
  } catch (err) {
    console.warn("⚠️ Erro ao buscar config SMTP da empresa:", err.message);
  }

  // 2. Se a empresa tem config própria, usa
  if (empresa && empresa.smtpHost && empresa.smtpUser && empresa.smtpPass) {
    return {
      host: empresa.smtpHost,
      port: Number(empresa.smtpPort || 587),
      user: empresa.smtpUser,
      pass: empresa.smtpPass,
      from: empresa.smtpFrom || `${empresa.nome} <${empresa.smtpUser}>`
    };
  }

  // 3. Fallback: .env global (usado em testes)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || process.env.SMTP_USER
    };
  }

  // 4. Sem config → não envia
  return null;
}

// ===================================================================
// ==============  Envia e-mail de confirmação  ======================
// ===================================================================
async function enviarEmailConfirmacao(consulta) {
  if (!consulta.email) {
    console.log("📧 Sem e-mail — pulando envio");
    return { ok: false, motivo: "sem-email" };
  }

  const empresaId = consulta.empresaId || 1;
  const cfg = await obterConfigSMTP(empresaId);   // 🔑 await aqui!

  if (!cfg) {
    console.log(`📧 Empresa ${empresaId} sem SMTP configurado — pulando envio`);
    return { ok: false, motivo: "sem-smtp" };
  }
  
  // Cria transportador com a config da empresa
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass }
  });

  const html = montarEmailHTML(consulta);

  await transporter.sendMail({
    from: cfg.from,
    to: consulta.email,
    subject: `✅ Consulta confirmada — ${formatarDataBr(consulta.data)} às ${consulta.hora}`,
    html
  });

  console.log(`📧 E-mail enviado para ${consulta.email} (empresa ${empresaId})`);
  return { ok: true };
}

// ===================================================================
// ==============  Template do e-mail  ===============================
// ===================================================================
function montarEmailHTML(consulta) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0f172a;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #0ea5e9;">
        <h1 style="color: #6b21a8; margin: 0; font-size: 1.6rem;">👁️ Nervus Iris</h1>
      </div>

      <div style="padding: 24px 0;">
        <h2 style="color: #0369a1; margin-top: 0;">Olá, ${consulta.nome}!</h2>
        <p style="color: #475569; line-height: 1.6;">
          Sua consulta foi <strong>agendada com sucesso</strong>. Confira os detalhes:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background: #f0f9ff; border-radius: 10px; padding: 16px;">
          <tr>
            <td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">📅 Data</td>
            <td style="padding: 10px 16px; font-weight: 700;">${formatarDataBr(consulta.data)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">🕐 Horário</td>
            <td style="padding: 10px 16px; font-weight: 700;">${consulta.hora}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">🩺 Especialidade</td>
            <td style="padding: 10px 16px; font-weight: 700;">${consulta.especialidade}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">⏱️ Duração</td>
            <td style="padding: 10px 16px; font-weight: 700;">${consulta.duracao || 30} minutos</td>
          </tr>
        </table>

        <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 6px; font-size: 0.9rem; color: #78350f;">
          <strong>📍 Importante:</strong> Chegue com 10 minutos de antecedência.
          Se precisar cancelar, entre em contato com a clínica.
        </div>
      </div>

         <p style="text-align: center; color: #94a3b8; font-size: 0.75rem; margin-top: 16px;">
           <strong>Nervus Iris</strong> — Agenda de Consultas
      </p>

      <p style="text-align: center; color: #94a3b8; font-size: 0.75rem; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        Este é um e-mail automático. Por favor, não responda.
      </p>
    </div>
  `;
}

// ===================================================================
// ==============  Helper: data pt-BR  ===============================
// ===================================================================
function formatarDataBr(dataISO) {
  if (!dataISO) return "—";
  const [a, m, d] = dataISO.split("-");
  return `${d}/${m}/${a}`;
}

module.exports = { enviarEmailConfirmacao, obterConfigSMTP };