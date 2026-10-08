// ===================================================================
// ============  SCRIPT: cria o usuário admin inicial  ===============
// ===================================================================
// Uso: node seed.js
// ===================================================================

const bcrypt = require("bcrypt");
const { get, run, inicializarBanco } = require("./db");

async function criarAdmin() {
  // Garante que as tabelas existem
  await inicializarBanco();

  const usuario = "admin";
  const senha = "admin123";
  const nome = "Administrador";
  const papel = "admin";

  // Verifica se já existe
  const existe = await get("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);

  if (existe) {
    console.log(`⚠️  Usuário "${usuario}" já existe. Nada foi criado.`);
    console.log(`   ID: ${existe.id}`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(senha, 10);

  const result = await run(
    `INSERT INTO usuarios (empresaId, usuario, senha, nome, papel)
     VALUES (?, ?, ?, ?, ?)`,
    [1, usuario, hash, nome, papel]
  );

  console.log("✅ Admin criado com sucesso!");
  console.log(`   ID:       ${result.lastInsertRowid}`);
  console.log(`   Usuário:  ${usuario}`);
  console.log(`   Senha:    ${senha}`);
  console.log("");
  console.log("⚠️  Troque essa senha no primeiro login!");
  process.exit(0);
}

criarAdmin().catch(err => {
  console.error("💥 Erro:", err);
  process.exit(1);
});