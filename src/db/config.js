const { getDb } = require('./schema');

async function setConfigValue(key, value) {
  const db = await getDb();
  await db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [key, value.toString()]);
  
}

async function getConfigValue(key, defaultValue = null) {
  const db = await getDb();
  const result = await db.get(`SELECT value FROM config WHERE key = ?`, key);
  return result ? result.value : defaultValue;
}

module.exports = { setConfigValue, getConfigValue };


