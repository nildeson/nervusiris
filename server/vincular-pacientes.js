// ===================================================================
// =====  Script: vincula consultas antigas a pacientes  =============
// ===================================================================
// Uso: node vincular-pacientes.js
// Roda UMA VEZ (ou quando quiser re-vincular)
// ===================================================================

const { all, get, run, inicializarBanco } = require("./db");

async function vincular() {
  await inicializarBanco();
  console.log("🔄 Iniciando vinculação...\n");

  // Busca todas as consultas sem pacienteId
  const consultas = await all(
    "SELECT * FROM consultas WHERE pacienteId IS NULL"
  );

  console.log(`📋 Total de consultas sem vínculo: ${consultas.length}\n`);

  let vinculadas = 0;
  let criados = 0;

  for (const c of consultas) {
    const empresaId = c.empresaId || 1;
    let pacienteId = null;

    // 1. Busca por CPF
    if (c.cpf) {
      const p = await get(
        "SELECT id FROM pacientes WHERE cpf = ? AND empresaId = ? AND ativo = 1",
        [c.cpf, empresaId]
      );
      if (p) pacienteId = p.id;
    }

    // 2. Busca por telefone (se não achou)
    if (!pacienteId && c.telefone) {
      const p = await get(
        "SELECT id FROM pacientes WHERE telefone = ? AND empresaId = ? AND ativo = 1",
        [c.telefone, empresaId]
      );
      if (p) pacienteId = p.id;
    }

    // 3. Busca por nome exato (se não achou)
    if (!pacienteId && c.nome) {
      const p = await get(
        "SELECT id FROM pacientes WHERE nome = ? AND empresaId = ? AND ativo = 1",
        [c.nome, empresaId]
      );
      if (p) pacienteId = p.id;
    }

    // 4. Se não achou, cria paciente novo
    if (!pacienteId) {
      const result = await run(
        `INSERT INTO pacientes
          (empresaId, nome, cpf, telefone, email, nascimento)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          empresaId,
          c.nome,
          c.cpf || null,
          c.telefone || null,
          c.email || null,
          c.nascimento || null
        ]
      );
      pacienteId = result.lastInsertRowid;
      criados++;
      console.log(`  ➕ Paciente criado: ${c.nome} (id ${pacienteId})`);
    }

    // 5. Vincula a consulta ao paciente
    await run("UPDATE consultas SET pacienteId = ? WHERE id = ?", [
      pacienteId,
      c.id
    ]);
    vinculadas++;
  }

  console.log("\n=====================================");
  console.log(`✅ Vinculação concluída!`);
  console.log(`   Consultas processadas: ${consultas.length}`);
  console.log(`   Consultas vinculadas:  ${vinculadas}`);
  console.log(`   Pacientes criados:     ${criados}`);
  console.log("=====================================\n");
  process.exit(0);
}

vincular().catch(err => {
  console.error("💥 Erro:", err);
  process.exit(1);
});