require("dotenv").config();
const { Telegraf }= require('telegraf');
const axios = require('axios');
var https = require('https');
var fs = require('fs');

const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');

const speechToText = new SpeechToTextV1({
  version: '2021-08-11'
});

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PORT = process.env.PORT || 8000;
const URL = process.env.URL || 'https://bot-filmchecker.herokuapp.com';

const bot = new Telegraf(BOT_TOKEN);

function download(url, dest, callback) {
  var file = fs.createWriteStream(dest);
  var request = https.get(url, function (response) {
    response.pipe(file);
    file.on('finish', function () {
      file.close(callback); // close() is async, call callback after close completes.
    });
    file.on('error', function (err) {
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      if (callback)
        callback(err.message);
    });
  });
}

const constructFilmMessage = (film) =>{
  let message = {photo:null, message:''};
  let imgUrl = 'https://image.tmdb.org/t/p/w300'
  if(film.poster_path) message.photo = imgUrl + film.poster_path
  else if (film.backdrop_path) message.photo = imgUrl + film.backdrop_path

  message.message = `*Title:*  ${film.title}`

  return message;
}


const myCommands = [
  {command:'help', description: 'Lista comandi'},
];


//On voice message download audio file, send it to IBM Cloud to get speechToText result, delete audio file and send first 3 film found.
bot.on('voice', ctx => {
  ctx.telegram.getFileLink(ctx.update.message.voice.file_id).then((url) => {
    const localFile = __dirname + '/temp/voices/'+ctx.update.message.voice.file_id+'.oga'
    download(url.href, localFile, (err) => {
      if (err) console.log(err);
      const params = {
        contentType: 'audio/ogg',
        audio: fs.createReadStream(localFile),
        model:'it-IT_BroadbandModel'
        };
        speechToText.recognize(params)
        .then(response => {
          const titoloFilm = JSON.stringify(response.result.results[0].alternatives[0].transcript)

          ctx.reply('cercando i films corrispondenti a: ' + titoloFilm)

          axios.get('https://api-filmchecker.herokuapp.com/multi_search/'+titoloFilm+'/1')
          .then(res => {
            const films = res.data.results.slice(0, 3);

            films.map(film => {
              const message = constructFilmMessage(film)

              ctx.replyWithPhoto({url: message.photo}, {caption: message.message, parse_mode:'markdown'}, {});
            })
          }, err =>{
            console.log(err);
          })

          fs.unlink(localFile, (err) => {
          if (err) {
            console.error(err)
            return
          }})
        })
        .catch(err => {
          console.log(err);
        });

      });
    })

})

// bot.launch();

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
