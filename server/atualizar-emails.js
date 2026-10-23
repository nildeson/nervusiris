require('dotenv').config();
const { run } = require('./db');

(async () => {
  try { 
    await run('ALTER TABLE usuarios ADD COLUMN email TEXT'); 
  } catch(e) {
    // Coluna já existe, ignora
  }
  
  await run('UPDATE usuarios SET email = ? WHERE usuario = ?', ['nildeson.roo@gmail.com', 'superadmin']);
  await run('UPDATE usuarios SET email = ? WHERE usuario = ?', ['nildeson@wdsinfo.com.br', 'visao.prime']);
  
  console.log('✅ E-mails atualizados no banco');
  process.exit(0);
})();