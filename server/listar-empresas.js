require("dotenv").config();
const { all } = require("./db");

all("SELECT id, nome, slug, ativo, plano FROM empresas ORDER BY id")
  .then(empresas => {
    console.table(empresas);
    process.exit(0);
  });