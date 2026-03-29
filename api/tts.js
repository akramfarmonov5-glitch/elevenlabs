const { handleTextToSpeech, loadEnvFile } = require("../lib/elevenlabs");

loadEnvFile();

module.exports = async function handler(req, res) {
  return handleTextToSpeech(req, res);
};
