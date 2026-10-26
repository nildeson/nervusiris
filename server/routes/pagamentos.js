// server/routes/pagamentos.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { autenticar, exigirAdmin } = require("../middleware/auth");
const { get, run } = require("../db");

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// ===================================================================
// =====  POST /api/pagamentos/webhook  (PÚBLICO — MP chama)  =======
// ===================================================================
// Precisa vir ANTES de qualquer middleware de autenticação,
// pois o Mercado Pago não envia token de usuário.
router.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === "payment" && data?.id) {
      const resp = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          },
        }
      );
      const pagamento = await resp.json();

      if (pagamento.status === "approved") {
        const empresaId = pagamento.external_reference;
        if (empresaId) {
          await run(
            "UPDATE empresas SET plano = ?, pago = 1 WHERE id = ?",
            [pagamento.metadata?.plano || "basico", empresaId]
          );
        }
      }
    }

    // MP exige 200 rápido, senão reenvia o evento
    res.sendStatus(200);
  } catch (err) {
    console.error("💥 Webhook MP:", err);
    res.sendStatus(200); // responde 200 mesmo em erro pra evitar reenvios
  }
});

// ===================================================================
// =====  POST /api/pagamentos/empresas/:id/assinar  (ADMIN)  =======
// ===================================================================
router.post(
  "/empresas/:id/assinar",
  autenticar,
  exigirAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { valor, plano } = req.body;

      const empresa = await get("SELECT nome FROM empresas WHERE id = ?", [id]);
      if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: [
            {
              id: `plano-${plano}`,
              title: `Assinatura Nervus Iris - Plano ${plano.toUpperCase()}`,
              quantity: 1,
              unit_price: Number(valor),
              currency_id: "BRL",
            },
          ],
          payer: { name: empresa.nome },
          external_reference: String(id), // <- usado pelo webhook para achar a empresa
          metadata: { plano },             // <- plano também vai pro webhook
          back_urls: {
            success: "https://nervusiris.netlify.app/admin.html?pagamento=sucesso",
            failure: "https://nervusiris.netlify.app/admin.html?pagamento=falha",
            pending: "https://nervusiris.netlify.app/admin.html?pagamento=pendente",
          },
          auto_return: "approved",
          notification_url:
            "https://nervusiris.onrender.com/api/pagamentos/webhook",
        },
      });

      res.json({ init_point: result.init_point });
    } catch (err) {
      console.error("💥 Erro Mercado Pago:", err);
      res.status(500).json({ erro: "Erro ao gerar pagamento" });
    }
  }
);

module.exports = router;