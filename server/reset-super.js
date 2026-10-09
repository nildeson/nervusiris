// ===================================================================
// ==========  Script: reseta senha do superadmin  ===================
// ===================================================================

const bcrypt = require("bcrypt");
const { run, get } = require("./db");

async function resetar() {
  const usuario = "superadmin";
  const novaSenha = "SuperAdmin#NervusIris2026!Segura";

  const existente = await get(
    "SELECT id, usuario, papel, ativo FROM usuarios WHERE usuario = ?",
    [usuario]
  );

  console.log("Estado atual:", existente);
  console.log("");

  const hash = await bcrypt.hash(novaSenha, 10);

  if (!existente) {
    const r = await run(
      "INSERT INTO usuarios (empresaId, usuario, senha, nome, papel, ativo) VALUES (?, ?, ?, ?, ?, ?)",
      [null, usuario, hash, "Dono do Sistema", "super", 1]
    );
    console.log("✅ Super admin CRIADO. ID:", r.lastInsertRowid);
  } else {
    const r = await run(
      "UPDATE usuarios SET senha = ?, papel = ?, ativo = ? WHERE usuario = ?",
      [hash, "super", 1, usuario]
    );
    console.log("✅ Super admin ATUALIZADO. Linhas afetadas:", r.changes);
  }

  console.log("");
  console.log("   Usuário: superadmin");
  console.log("   Senha:   SuperAdmin#NervusIris2026!Segura");
  console.log("");
  console.log("👉 Testa o login agora no Netlify!");

  process.exit(0);
}

resetar().catch(err => {
  console.error("💥 Erro:", err);
  process.exit(1);
});