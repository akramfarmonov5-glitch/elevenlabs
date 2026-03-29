const { handleVoices, loadEnvFile } = require("../lib/elevenlabs");

loadEnvFile();

module.exports = async function handler(req, res) {
  return handleVoices(req, res);
};
