const { handleHealth, loadEnvFile } = require("../lib/elevenlabs");

loadEnvFile();

module.exports = async function handler(req, res) {
  return handleHealth(req, res);
};
