const bcrypt = require("bcrypt");
const { run, get } = require("./db");

async function resetar() {
  const usuario = "superadmin";
  const novaSenha = "JUj9dQxCVtbXr4DeoxsDNQ==";  // ← preencher!

  const existente = await get(
    "SELECT id, usuario, papel, ativo FROM usuarios WHERE usuario = ?",
    [usuario]
  );

  console.log("Estado atual:", existente);

  const hash = await bcrypt.hash("JUj9dQxCVtbXr4DeoxsDNQ==", 10);

  if (!existente) {
    const r = await run(
      "INSERT INTO usuarios (empresaId, usuario, senha, nome, papel, ativo) VALUES (?, ?, ?, ?, ?, ?)",
      [null, usuario, hash, "Dono do Sistema", "super", 1]
    );
    console.log("✅ CRIADO. ID:", r.lastInsertRowid);
  } else {
    const r = await run(
      "UPDATE usuarios SET senha = ?, papel = ?, ativo = ? WHERE usuario = ?",
      [hash, "super", 1, usuario]
    );
    console.log("✅ ATUALIZADO. Linhas:", r.changes);
  }

  console.log("   Usuário:", usuario);
  console.log("   Senha:  ", "JUj9dQxCVtbXr4DeoxsDNQ==");
  process.exit(0);
}

resetar().catch(err => {
  console.error("💥", err);
  process.exit(1);
});