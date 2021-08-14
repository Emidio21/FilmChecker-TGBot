require("dotenv").config();
const {
  Telegraf,
  Scenes,
  session
} = require('telegraf');

const https = require('https');
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

const bot = new Telegraf(BOT_TOKEN);


const myCommands = [{
  command: 'help',
  description: 'Lista comandi'
}, ];

bot.command('status', ctx => {
  ctx.reply('Sono vivo');
})


//On voice message download audio file, send it to IBM Cloud to get speechToText result, delete audio file and send first 3 film found.
bot.on('voice', ctx => {
  ctx.telegram.getFileLink(ctx.update.message.voice.file_id).then((url) => {
    const localFile = ctx.update.message.voice.file_id + '.oga'
    download(url.href, localFile, (err) => {
      if (err) console.log(err);
      const params = {
        contentType: 'audio/ogg',
        audio: fs.createReadStream(localFile),
        model: 'it-IT_BroadbandModel'
      };
      speechToText.recognize(params)
        .then(response => {
          const titoloFilm = JSON.stringify(response.result.results[0].alternatives[0].transcript)

          ctx.reply('cercando i films corrispondenti a: ' + titoloFilm);
          searchFilms(titoloFilm).then(messages => {
            console.log(messages);
            messages.map(message => {
              ctx.replyWithPhoto({
                url: message.photo
              }, {
                caption: message.message,
                parse_mode: message.parse_mode
              }, {});
            })

          fs.unlink(localFile, (err) => {
            if (err) {
              console.error(err)
              return
            }
          })
        })
      });
    })
  })
})


/*SCENA PER CERCARE UN FILM VIA TESTO*/
const searchScene = new Scenes.BaseScene('SEARCH_SCENE');

searchScene.enter((ctx) => {
  ctx.reply('Qual è il film che cerchi?');
});
searchScene.leave((ctx) => ctx.reply(ctx.session.myData.setted ? 'Cerco' : 'Errore'));
searchScene.command('cancel', ctx => ctx.scene.leave());
searchScene.on('text', (ctx) => {
  const titoloFilm = ctx.message.text;

  searchFilms(titoloFilm).then(messages => {
    messages.map(message => {
      ctx.replyWithPhoto({
        url: message.photo
      }, {
        caption: message.message,
        parse_mode: 'markdown'
      }, {});
    })

    ctx.session.myData.setted = true;
    ctx.scene.leave();
  })
});
searchScene.on('voice', (ctx) => ctx.reply('Mandami il titolo testuale per favore'));

const stage = new Scenes.Stage([searchScene]);
bot.use(session());
bot.use(stage.middleware());

bot.command('search', (ctx) => {
  ctx.session.myData = {setted:false};
  ctx.scene.enter('SEARCH_SCENE');
})

if(process.env.DEV) bot.launch();
else
  // Start webhook via launch method (preferred)
  bot.launch({
    webhook: {
      domain: URL,
      port: PORT,
    }
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
