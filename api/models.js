const { handleModels, loadEnvFile } = require("../lib/elevenlabs");

loadEnvFile();

module.exports = async function handler(req, res) {
  return handleModels(req, res);
};
