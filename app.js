const express = require( "express");
const { webhookCallback } = require("grammy");
const { bot } = require("./bot.js");
const {BOT_TOKEN, PORT, URL} = require('./constants');

const app = express();

app.use(express.json());
app.use(webhookCallback(bot, "express"));


app.listen(PORT, async () => {
  // Make sure it is `https` not `http`!
  await bot.api.setWebhook(URL + '/' + BOT_TOKEN);
});
