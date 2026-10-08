// ===================================================================
// ==================  ROTAS DE CONSULTAS  ===========================
// ===================================================================

const express = require("express");
const router = express.Router();
const { all, get, run } = require("../db");
const { autenticar } = require("../middleware/auth");
const { enviarEmailConfirmacao } = require("../mailer");

// ===== Helper: transforma a linha do banco em objeto com JSON =====
function parseConsulta(row) {
  if (!row) return null;
  return {
    ...row,
    triagem: row.triagem ? JSON.parse(row.triagem) : null,
    lgpd: row.lgpd ? JSON.parse(row.lgpd) : null
  };
}

// ===== Helper: descobre se o usuário é admin =====
function ehAdmin(usuario) {
  return usuario && usuario.papel === "admin";
}

// ===================================================================
// ============  GET /api/consultas — lista (filtrada)  ==============
// ===================================================================
router.get("/", autenticar, async (req, res) => {
  try {
    const empresaId = req.usuario.empresaId || 1;
    let rows;

    if (ehAdmin(req.usuario)) {
      rows = await all(
        "SELECT * FROM consultas WHERE empresaId = ? ORDER BY data, hora",
        [empresaId]
      );
    } else {
      rows = await all(
        "SELECT * FROM consultas WHERE empresaId = ? AND profissionalId = ? ORDER BY data, hora",
        [empresaId, req.usuario.profissionalId]
      );
    }

    res.json(rows.map(parseConsulta));
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar consultas" });
  }
});

// ===================================================================
// ============  GET /api/consultas/:id — busca uma  =================
// ===================================================================
router.get("/:id", autenticar, async (req, res) => {
  try {
    const row = await get("SELECT * FROM consultas WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ erro: "Consulta não encontrada" });

    // Verifica empresa
    if (Number(row.empresaId) !== Number(req.usuario.empresaId)) {
      return res.status(403).json({ erro: "Sem permissão" });
    }

    // Profissional só pode ver a própria
    if (!ehAdmin(req.usuario) && row.profissionalId !== req.usuario.profissionalId) {
      return res.status(403).json({ erro: "Sem permissão para ver esta consulta" });
    }

    res.json(parseConsulta(row));
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao buscar consulta" });
  }
});

// ===================================================================
// ============  POST /api/consultas — cria nova  ====================
// ===================================================================
router.post("/", autenticar, async (req, res) => {
  try {
    const c = req.body;

    // Se for profissional, força o profissionalId dele
    if (!ehAdmin(req.usuario)) {
      c.profissionalId = req.usuario.profissionalId;
    }

    // Validação básica
    if (!c.nome || !c.especialidade || !c.profissionalId || !c.salaId || !c.data || !c.hora) {
      return res.status(400).json({ erro: "Campos obrigatórios faltando" });
    }

    const empresaId = req.usuario.empresaId || 1;

    // 🆕 Busca ou cria paciente automaticamente
    let pacienteId = c.pacienteId || null;

    if (!pacienteId && c.nome) {
      let existente = null;

      // Busca por CPF
      if (c.cpf) {
        existente = await get(
          "SELECT id FROM pacientes WHERE cpf = ? AND empresaId = ? AND ativo = 1",
          [c.cpf, empresaId]
        );
      }

      // Busca por telefone
      if (!existente && c.telefone) {
        existente = await get(
          "SELECT id FROM pacientes WHERE telefone = ? AND empresaId = ? AND ativo = 1",
          [c.telefone, empresaId]
        );
      }

      if (existente) {
        pacienteId = existente.id;
      } else {
        // Cria paciente novo
        const resultPac = await run(
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
        pacienteId = resultPac.lastInsertRowid;
        console.log(`👤 Paciente criado automaticamente: ${c.nome} (id ${pacienteId})`);
      }
    }

    // 🆕 INSERT com pacienteId
    const result = await run(
      `INSERT INTO consultas
         (empresaId, pacienteId, nome, telefone, email, nascimento, cpf, especialidade,
          profissionalId, salaId, data, hora, duracao, obs,
          triagem, lgpd, status, origem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        pacienteId,                    // 🆕
        c.nome,
        c.telefone || null,
        c.email || null,
        c.nascimento || null,
        c.cpf || null,
        c.especialidade,
        c.profissionalId,
        c.salaId,
        c.data,
        c.hora,
        c.duracao || 30,
        c.obs || null,
        c.triagem ? JSON.stringify(c.triagem) : null,
        c.lgpd ? JSON.stringify(c.lgpd) : null,
        c.status || "confirmada",
        c.origem || "presencial"
      ]
    );

    // Busca a consulta criada
    const nova = await get("SELECT * FROM consultas WHERE id = ?", [result.lastInsertRowid]);

    // Responde PRIMEIRO (rápido)
    res.status(201).json(parseConsulta(nova));

    // Depois dispara o e-mail em background
    enviarEmailConfirmacao(nova).catch(err =>
      console.error("⚠️ Falha ao enviar e-mail:", err.message)
    );
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao criar consulta" });
  }
});

// ===================================================================
// ============  PUT /api/consultas/:id — atualiza  ==================
// ===================================================================
router.put("/:id", autenticar, async (req, res) => {
  try {
    const c = req.body;
    const existente = await get("SELECT * FROM consultas WHERE id = ?", [req.params.id]);
    if (!existente) return res.status(404).json({ erro: "Consulta não encontrada" });

    // Verifica empresa
    if (Number(existente.empresaId) !== Number(req.usuario.empresaId)) {
      return res.status(403).json({ erro: "Sem permissão" });
    }

    // Profissional só pode editar as próprias
    if (!ehAdmin(req.usuario) && existente.profissionalId !== req.usuario.profissionalId) {
      return res.status(403).json({ erro: "Sem permissão para editar esta consulta" });
    }

    // Se for profissional, não pode trocar o profissionalId
    if (!ehAdmin(req.usuario)) {
      c.profissionalId = req.usuario.profissionalId;
    }

   // 🆕 Busca ou cria paciente (se não veio)
let pacienteId = c.pacienteId || existente.pacienteId || null;
const empresaId = req.usuario.empresaId || 1;

if (!pacienteId && c.nome) {
  let encontrado = null;

  if (c.cpf) {
    encontrado = await get(
      "SELECT id FROM pacientes WHERE cpf = ? AND empresaId = ? AND ativo = 1",
      [c.cpf, empresaId]
    );
  }
  if (!encontrado && c.telefone) {
    encontrado = await get(
      "SELECT id FROM pacientes WHERE telefone = ? AND empresaId = ? AND ativo = 1",
      [c.telefone, empresaId]
    );
  }

  if (encontrado) {
    pacienteId = encontrado.id;
  } else {
    const resultPac = await run(
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
    pacienteId = resultPac.lastInsertRowid;
  }
}

await run(
  `UPDATE consultas SET
     pacienteId = ?,
     nome = ?, telefone = ?, email = ?, nascimento = ?, cpf = ?,
     especialidade = ?, profissionalId = ?, salaId = ?,
     data = ?, hora = ?, duracao = ?, obs = ?,
     triagem = ?, lgpd = ?, status = ?, origem = ?
   WHERE id = ?`,
  [
    pacienteId,                      // 🆕
    c.nome,
    c.telefone || null,
    c.email || null,
    c.nascimento || null,
    c.cpf || null,
    c.especialidade,
    c.profissionalId,
    c.salaId,
    c.data,
    c.hora,
    c.duracao || 30,
    c.obs || null,
    c.triagem ? JSON.stringify(c.triagem) : null,
    c.lgpd ? JSON.stringify(c.lgpd) : null,
    c.status || "confirmada",
    c.origem || "presencial",
    req.params.id
  ]
);

    const atualizada = await get("SELECT * FROM consultas WHERE id = ?", [req.params.id]);

    // Responde PRIMEIRO
    res.json(parseConsulta(atualizada));

    // Depois envia e-mail (se mudou data/hora)
    if (existente.data !== atualizada.data || existente.hora !== atualizada.hora) {
      enviarEmailConfirmacao(atualizada).catch(err =>
        console.error("⚠️ Falha ao enviar e-mail de alteração:", err.message)
      );
    }
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao atualizar consulta" });
  }
});

// ===================================================================
// ============  DELETE /api/consultas/:id — remove  =================
// ===================================================================
router.delete("/:id", autenticar, async (req, res) => {
  try {
    const existente = await get("SELECT * FROM consultas WHERE id = ?", [req.params.id]);
    if (!existente) return res.status(404).json({ erro: "Consulta não encontrada" });

    // Verifica empresa
    if (Number(existente.empresaId) !== Number(req.usuario.empresaId)) {
      return res.status(403).json({ erro: "Sem permissão" });
    }

    // Profissional só pode deletar as próprias
    if (!ehAdmin(req.usuario) && existente.profissionalId !== req.usuario.profissionalId) {
      return res.status(403).json({ erro: "Sem permissão para remover esta consulta" });
    }

    await run("DELETE FROM consultas WHERE id = ?", [req.params.id]);
    res.json({ ok: true, removida: Number(req.params.id) });
  } catch (err) {
    console.error("💥", err);
    res.status(500).json({ erro: "Erro ao remover consulta" });
  }
});

module.exports = router;