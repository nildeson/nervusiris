// ===================================================================
// ======================  MÁSCARAS DE INPUT  ========================
// ===================================================================

// ===== Telefone: (00) 00000-0000 ou (00) 0000-0000 =====
function aplicarMascaraTelefone(input) {
  if (!input) return;

  input.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length === 0) {
      e.target.value = "";
    } else if (v.length <= 2) {
      e.target.value = `(${v}`;
    } else if (v.length <= 6) {
      e.target.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length <= 10) {
      e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    } else {
      e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    }
  });

  input.addEventListener("keypress", (e) => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });
}

// ===== CPF: 000.000.000-00 =====
function aplicarMascaraCpf(input) {
  if (!input) return;

  input.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length === 0) {
      e.target.value = "";
    } else if (v.length <= 3) {
      e.target.value = v;
    } else if (v.length <= 6) {
      e.target.value = `${v.slice(0, 3)}.${v.slice(3)}`;
    } else if (v.length <= 9) {
      e.target.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    } else {
      e.target.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    }
  });

  input.addEventListener("keypress", (e) => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });
}

// ===== Aplicar em massa por id =====
function aplicarMascaras() {
  // Telefone na tela do profissional
  aplicarMascaraTelefone(document.getElementById("telefone"));
  aplicarMascaraTelefone(document.getElementById("editTelefone"));

  // Telefone + CPF na tela pública
  aplicarMascaraTelefone(document.getElementById("pTelefone"));
  aplicarMascaraCpf(document.getElementById("pCpf"));
}