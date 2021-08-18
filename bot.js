require("dotenv").config();

const { Bot, session, SessionFlavor} = require('grammy');
const { Router } = require("@grammyjs/router");

const fs = require('fs');
const {download, searchFilms} = require('./functions.js')


const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const {
  IamAuthenticator
} = require('ibm-watson/auth');

const speechToText = new SpeechToTextV1({
  authenticator: new IamAuthenticator({
    apikey: process.env.SPEECH_TO_TEXT_APIKEY
  }),
  version: '2021-08-12'
});
speechToText.setServiceUrl(process.env.SPEECH_TO_TEXT_URL);

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PORT = process.env.PORT || 8000;
const URL = process.env.URL || 'https://bot-filmchecker.herokuapp.com';

// const bot = new Telegraf(BOT_TOKEN);
if (process.env.BOT_TOKEN == null) throw Error("BOT_TOKEN is missing.");
const bot = new Bot(`${process.env.BOT_TOKEN}`,{
  botInfo: {
    id: 1939345611,
    is_bot: true,
    first_name: "Dove Guardarlo?",
    username: "filmchecker_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  },});
// Use session
bot.use(session({ initial: () => ({ step: "idle" }) }));

const myCommands = [
  {command: 'help', description: 'Lista comandi'},
  {command: 'cerca', description: 'Cerca un film usando il titolo, restituisce i primi 3 film trovati'},
 ];

bot.api.setMyCommands(myCommands);

const replyWithHelp = async (ctx) =>{
  try {
    const commands = await ctx.api.getMyCommands()
    let message='Puoi inviare un messaggio vocale con il titolo del film da cercare\n\noppure uno dei seguenti comandi: \n\n';
    commands.map(command => {
      message += '/' + command.command + ' ' + command.description + "\n";
    });
    ctx.reply(message);
  } catch (err){
    console.log(err);
  }
}

bot.command('help', ctx => replyWithHelp(ctx));

bot.command('start', async ctx => {
  ctx.reply('Benvenuto! ');
  replyWithHelp(ctx);
})

bot.command('status', ctx => {
  ctx.reply('Sono vivo');
})


//On voice message download audio file, send it to IBM Cloud to get speechToText result, delete audio file and send first 3 film found.
bot.on('message:voice', async ctx => {
  try {
    const file = await   ctx.api.getFile(ctx.msg.voice.file_id);
    const localFile = ctx.msg.voice.file_id + '.oga';
    download(file.file_path, localFile, async (err) => {
      if (err) console.log(err);
      const params = {
        contentType: 'audio/ogg',
        audio: fs.createReadStream(localFile),
        model: 'it-IT_BroadbandModel'
      };
      const response = await speechToText.recognize(params);
      fs.unlink(localFile, (err) => {
        if (err) {
          console.error(err)
          return
        }
      })
      const titoloFilm = JSON.stringify(response.result.results[0].alternatives[0].transcript)
      ctx.reply('cercando i films corrispondenti a: ' + titoloFilm);
      const messages = await searchFilms(titoloFilm);
      messages?.length>0 ? messages.map(message => {
        ctx.replyWithPhoto(message.photo, {caption:message.message, parse_mode:message.parse_mode});
      }) : ctx.reply('Nessun film trovato per '+ titoloFilm);
    })
  } catch(e){
    console.log(e);
  }
  //
})


/*SCENA PER CERCARE UN FILM VIA TESTO*/
bot.command('cerca', async ctx =>{
  const titoloFilm = ctx.session.title;

  if (titoloFilm !== undefined) {
   // Information already provided!
   const messages = await searchFilms(titoloFilm);
   messages?.length>0 ? messages.map(message => {
    ctx.replyWithPhoto(message.photo, {caption:message.message, parse_mode:message.parse_mode});
   }) : ctx.reply('Nessun film trovato per '+ titoloFilm);
 } else {
   // Missing information, enter router-based form
   ctx.session.step = "text";
   await ctx.reply("Qual è il film che cerchi?");
 }
});

// Use router
const router = new Router((ctx) => ctx.session.step);

router.route('text', async (ctx, next) => {
  const titoloFilm = ctx.msg?.text ?? "";
  if (titoloFilm === '') {
    await ctx.reply("Titolo non valido");
    return;
  }
  ctx.session.title = titoloFilm;
  const messages = await searchFilms(titoloFilm);
  messages?.length>0 ? messages.map(message => {
   ctx.replyWithPhoto(message.photo, {caption:message.message, parse_mode:message.parse_mode});
 }) : ctx.reply('Nessun film trovato per '+ titoloFilm);
  ctx.session.step = "idle";
  ctx.session.title = undefined;
});

bot.use(router);

bot.catch(err => console.log(err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

exports.bot = bot;
