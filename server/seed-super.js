// ===================================================================
// ==========  SCRIPT: cria o usuário SUPER ADMIN  ===================
// ===================================================================
// Uso: node seed-super.js
// Roda apenas UMA VEZ (ou quando quiser resetar)
// ===================================================================

const bcrypt = require("bcrypt");
const { get, run, inicializarBanco } = require("./db");

async function criarSuperAdmin() {
  await inicializarBanco();

  const usuario = "superadmin";
  const senha = "w31d48s38";     // 🔑 Troque no primeiro login
  const nome = "Nildeson (Dono)";

  // Verifica se já existe
  const existe = await get("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);

  if (existe) {
    console.log(`⚠️  Super admin "${usuario}" já existe.`);
    console.log(`   Se quiser trocar a senha, rode o script de reset.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(senha, 10);

  // Super admin tem empresaId = NULL (não pertence a nenhuma clínica)
  const result = await run(
    `INSERT INTO usuarios (empresaId, usuario, senha, nome, papel)
     VALUES (?, ?, ?, ?, ?)`,
    [null, usuario, hash, nome, "super"]
  );

  console.log("✅ Super admin criado com sucesso!");
  console.log(`   ID:       ${result.lastInsertRowid}`);
  console.log(`   Usuário:  ${usuario}`);
  console.log(`   Senha:    ${senha}`);
  console.log("");
  console.log("👑 Acesse o painel em: http://127.0.0.1:5500/super.html");
  console.log("⚠️  TROQUE ESSA SENHA no primeiro login!");
  process.exit(0);
}

criarSuperAdmin().catch(err => {
  console.error("💥 Erro:", err);
  process.exit(1);
});