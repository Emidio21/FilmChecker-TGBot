require("dotenv").config();

const { Bot, session, SessionFlavor, InlineKeyboard} = require('grammy');
const { Router } = require("@grammyjs/router");

const fs = require('fs');
const axios = require('axios');
const {download, searchFilms} = require('./functions.js')

const {flag, name} = require('country-emoji');


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

const replyWithFilms = async (ctx, titoloFilm) => {
  const messages = await searchFilms(titoloFilm);
  messages?.length>0 ? messages.map(message => {
    const inlineKeyboard = new InlineKeyboard().text('🌐 Nel resto del mondo?', message.id+' '+message.type+' '+ctx.msg.chat.id).row().url('ℹ️ Più info','www.doveguardarlo.it');
    ctx.replyWithPhoto(message.photo, {caption:message.message, parse_mode:message.parse_mode, reply_markup: inlineKeyboard});
  }) : ctx.reply('Nessun film trovato per '+ titoloFilm);
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
      replyWithFilms(ctx, titoloFilm)
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
   replyWithFilms(ctx, titoloFilm)
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
  replyWithFilms(ctx, titoloFilm)

  ctx.session.step = "idle";
  ctx.session.title = undefined;
});

bot.use(router);

// CALLBACK QUERY
bot.on("callback_query:data", async (ctx) => {
  const id = ctx.callbackQuery.data.split(' ')[0];
  const type = ctx.callbackQuery.data.split(' ')[1];
  const msgId = ctx.callbackQuery.data.split(' ')[2];

  const res = await axios.get('https://api-filmchecker.herokuapp.com/provider/'+ type +'/' + id);
  const providers = Object.entries(res.data.results)
  const otherCountry = providers && providers.filter(c => c[0]!=='IT')
  let newMessage = ctx.update.callback_query.message.caption + '\n'
  newMessage += otherCountry ? '\n🌐 Nel resto del mondo: 🌐\n' : '🌐 Non disponibile nel resto del mondo: 🌐\n'
  otherCountry.map(country => {
    (country[1]?.flatrate || country[1]?.ads) ? newMessage += '\n\n' + flag(country[0]) + name(country[0]) + ': \n' : '\n'
    country[1]?.flatrate ? newMessage += '💰: ' : '';
    country[1]?.flatrate && country[1].flatrate.map(provider =>{ newMessage +=  '*' + provider.provider_name+'* | '});
    country[1]?.ads ? newMessage += '\n🆓: ' : '';
    country[1]?.ads && country[1].ads.map(provider =>{newMessage += '*' + provider.provider_name+'* | '});
  });
  newMessage = newMessage.substr(0,1020)+'...'
  const inlineKeyboard = new InlineKeyboard().url('ℹ️ Più info','www.doveguardarlo.it');
  await ctx.api.raw.editMessageCaption({chat_id:msgId, message_id:ctx.update.callback_query.message.message_id ,caption:newMessage,parse_mode:'markdown', reply_markup:inlineKeyboard})
  await ctx.answerCallbackQuery(); // remove loading animation
});

bot.catch(err => console.log(err));

if (process.env.DEV) {
  bot.start();
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

exports.bot = bot;
