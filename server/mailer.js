// server/mailer.js
const { Resend } = require('resend');
require('dotenv').config();

// Inicializa o Resend com a chave que você criou
const resend = new Resend(process.env.RESEND_API_KEY);

// ===================================================================
// ==============  Envia e-mail de confirmação  ======================
// ===================================================================
async function enviarEmailConfirmacao(consulta) {
  if (!consulta.email) {
    console.log("📧 Sem e-mail — pulando envio");
    return { ok: false, motivo: "sem-email" };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0f172a;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #0ea5e9;">
        <h1 style="color: #6b21a8; margin: 0; font-size: 1.6rem;">👁️ Nervus Iris</h1>
      </div>
      <div style="padding: 24px 0;">
        <h2 style="color: #0369a1; margin-top: 0;">Olá, ${consulta.nome}!</h2>
        <p style="color: #475569; line-height: 1.6;">Sua consulta foi <strong>agendada com sucesso</strong>. Confira os detalhes:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background: #f0f9ff; border-radius: 10px; padding: 16px;">
          <tr><td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">📅 Data</td><td style="padding: 10px 16px; font-weight: 700;">${formatarDataBr(consulta.data)}</td></tr>
          <tr><td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">🕐 Horário</td><td style="padding: 10px 16px; font-weight: 700;">${consulta.hora}</td></tr>
          <tr><td style="padding: 10px 16px; color: #64748b; font-size: 0.9rem;">🩺 Especialidade</td><td style="padding: 10px 16px; font-weight: 700;">${consulta.especialidade}</td></tr>
        </table>
        <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 6px; font-size: 0.9rem; color: #78350f;">
          <strong>📍 Importante:</strong> Chegue com 10 minutos de antecedência.
        </div>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Nervus Iris <onboarding@resend.dev>',
      to: consulta.email,
      subject: `✅ Consulta confirmada — ${formatarDataBr(consulta.data)} às ${consulta.hora}`,
      html: html
    });
    console.log(`📧 E-mail enviado para ${consulta.email} (via Resend)`);
    return { ok: true };
  } catch (error) {
    console.error("💥 Erro no Resend:", error);
    return { ok: false, motivo: error.message };
  }
}

// ===================================================================
// ==============  Envia e-mail de recuperação de senha  =============
// ===================================================================
async function enviarEmailRecuperacao(email, nome, token) {
  const link = `https://nervusiris.netlify.app/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #6b21a8;">👁️ Nervus Iris</h1>
      <h2>Olá, ${nome}!</h2>
      <p>Recebemos um pedido para redefinir sua senha.</p>
      <a href="${link}" style="background-color: #0ea5e9; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Redefinir minha senha</a>
      <p style="font-size: 0.9rem; color: #64748b; margin-top: 20px;">Este link é válido por 1 hora.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Nervus Iris <onboarding@resend.dev>',
      to: email,
      subject: '🔑 Recuperação de senha - Nervus Iris',
      html: html
    });
    console.log(`📧 E-mail de recuperação enviado para ${email} (via Resend)`);
    return true;
  } catch (error) {
    console.error("💥 Erro no Resend (recuperação):", error);
    return false;
  }
}

// Helper
function formatarDataBr(dataISO) {
  if (!dataISO) return "—";
  const [a, m, d] = dataISO.split("-");
  return `${d}/${m}/${a}`;
}

module.exports = { enviarEmailConfirmacao, enviarEmailRecuperacao };