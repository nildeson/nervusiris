const bcrypt = require("bcrypt");
const { run, get } = require("./db");

async function resetar() {
  const usuario = "visao.prime"; // O nome de usuário que você achou
  const novaSenha = "visao.prime@"; // 👈 TROQUE PELA SENHA QUE VOCÊ QUER

  const existente = await get("SELECT id, empresaId FROM usuarios WHERE usuario = ?", [usuario]);

  if (!existente) {
    console.log("❌ Usuário não encontrado no banco!");
    process.exit(1);
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  
  // Atualiza a senha e garante que o usuário está ativo
  await run("UPDATE usuarios SET senha = ?, ativo = 1 WHERE usuario = ?", [hash, usuario]);

  console.log("✅ Senha atualizada com sucesso!");
  console.log("   Usuário:", usuario);
  console.log("   Nova Senha:", novaSenha);
  
  process.exit(0);
}

resetar().catch(err => {
  console.error("💥 Erro:", err);
  process.exit(1);
});