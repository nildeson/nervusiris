// ===================================================================
// ==================  RECUPERAÇÃO DE SENHA  =========================
// ===================================================================

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
const emailUrl = urlParams.get("email");

const formPedir = document.getElementById("formPedirEmail");
const formNova = document.getElementById("formNovaSenha");
const titulo = document.getElementById("tituloTela");
const subtitulo = document.getElementById("subtituloTela");

// Se tem token na URL, mostra a tela de nova senha
if (token && emailUrl) {
  formPedir.classList.add("escondido");
  formNova.classList.remove("escondido");
  titulo.textContent = "Nova Senha";
  subtitulo.textContent = `Para a conta: ${emailUrl}`;
}

// --- AÇÃO 1: PEDIR O E-MAIL ---
formPedir.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("recEmail").value;
  const btn = formPedir.querySelector("button");
  const erroBox = document.getElementById("msgErro1");

  btn.textContent = "Enviando...";
  btn.disabled = true;
  erroBox.classList.remove("visivel");

  try {
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    
    // Sucesso
    alert("📧 Se o e-mail estiver cadastrado, enviamos um link de recuperação. Verifique sua caixa de entrada.");
    window.location.href = "login.html"; // Volta pro login
  } catch (err) {
    erroBox.textContent = "Erro: " + err.message;
    erroBox.classList.add("visivel");
  } finally {
    btn.textContent = "Enviar Link";
    btn.disabled = false;
  }
});

// --- AÇÃO 2: SALVAR A NOVA SENHA ---
formNova.addEventListener("submit", async (e) => {
  e.preventDefault();
  const novaSenha = document.getElementById("recNovaSenha").value;
  const btn = formNova.querySelector("button");
  const erroBox = document.getElementById("msgErro2");

  btn.textContent = "Salvando...";
  btn.disabled = true;
  erroBox.classList.remove("visivel");

  try {
    await apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email: emailUrl, token, novaSenha })
    });
    
    alert("✅ Senha alterada com sucesso! Faça login com a nova senha.");
    window.location.href = "login.html";
  } catch (err) {
    erroBox.textContent = err.message;
    erroBox.classList.add("visivel");
  } finally {
    btn.textContent = "Salvar Nova Senha";
    btn.disabled = false;
  }
});