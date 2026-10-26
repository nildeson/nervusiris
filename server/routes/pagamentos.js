const { MercadoPagoConfig, Preference } = require('mercadopago');

// Configura o Mercado Pago com o Token do .env
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

// Rota para gerar o link de pagamento
router.post("/empresas/:id/assinar", async (req, res) => {
  try {
    const { id } = req.params;
    const { valor, plano } = req.body;

    const empresa = await get("SELECT nome FROM empresas WHERE id = ?", [id]);
    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

    // Cria a preferência de pagamento
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            id: `plano-${plano}`,
            title: `Assinatura Nervus Iris - Plano ${plano.toUpperCase()}`,
            quantity: 1,
            unit_price: Number(valor),
            currency_id: "BRL"
          }
        ],
        payer: {
          name: empresa.nome
        },
        back_urls: {
          success: "https://nervusiris.netlify.app/admin.html?pagamento=sucesso",
          failure: "https://nervusiris.netlify.app/admin.html?pagamento=falha",
          pending: "https://nervusiris.netlify.app/admin.html?pagamento=pendente"
        },
        auto_return: "approved",
        // O notification_url é onde o Mercado Pago avisa quando o pagamento for aprovado!
        notification_url: "https://nervusiris.onrender.com/api/pagamentos/webhook" 
      }
    });

    // Retorna o link de checkout para o frontend
    res.json({ init_point: result.init_point });
  } catch (err) {
    console.error("💥 Erro Mercado Pago:", err);
    res.status(500).json({ erro: "Erro ao gerar pagamento" });
  }
});