const express = require( "express");
const { webhookCallback } = require("grammy");
const { bot } = require("./bot.js");

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PORT = process.env.PORT || 8000;
const URL = process.env.URL || 'https://bot-filmchecker.herokuapp.com';

const app = express();

app.use(express.json());
app.use('/'+BOT_TOKEN, webhookCallback(bot, "express"));


app.listen(PORT, async () => {
  // Make sure it is `https` not `http`!
  await bot.api.setWebhook('https://'+ URL + '/' + BOT_TOKEN);
});
