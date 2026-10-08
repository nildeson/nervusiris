// ===================================================================
// =====================  TELA DE LOGIN  =============================
// ===================================================================

const formLogin = document.getElementById("formLogin");
const campoUsuario = document.getElementById("usuario");
const campoSenha = document.getElementById("senha");
const btnEntrar = document.getElementById("btnEntrar");
const boxErro = document.getElementById("loginErro");

// ===== Se já estiver logado, redireciona direto =====
const tokenExistente = localStorage.getItem("token");
if (tokenExistente) {
  window.location.href = "index.html";
}

// ===== Mostrar erro =====
function mostrarErro(msg) {
  boxErro.textContent = msg;
  boxErro.classList.add("visivel");
}

function limparErro() {
  boxErro.textContent = "";
  boxErro.classList.remove("visivel");
}

// ===== Submit =====
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErro();

  const usuario = campoUsuario.value.trim();
  const senha = campoSenha.value;

  if (!usuario || !senha) {
    mostrarErro("Preencha usuário e senha.");
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = "Entrando...";

  try {
    const resp = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, senha })
    });

    const dados = await resp.json();

    if (!resp.ok) {
      mostrarErro(dados.erro || "Falha ao entrar.");
      btnEntrar.disabled = false;
      btnEntrar.textContent = "Entrar";
      return;
    }

    // Salva token e dados do usuário
    localStorage.setItem("token", dados.token);
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));

    // Redireciona
    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    mostrarErro(
      "Não foi possível conectar ao servidor.\n" +
      "Verifique se o backend está rodando (node server.js)."
    );
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
  }
});