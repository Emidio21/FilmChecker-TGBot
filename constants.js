require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PORT = process.env.PORT || 8000;
const URL = process.env.URL;
const API_URL = process.env.API_URL;

module.exports={BOT_TOKEN, PORT, URL, API_URL}