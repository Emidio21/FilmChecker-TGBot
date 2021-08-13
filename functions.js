const axios = require('axios');
const https = require('https');
const fs = require('fs');

function download(url, dest, callback) {
  var file = fs.createWriteStream(dest);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(callback); // close() is async, call callback after close completes.
    });
    file.on('error', function(err) {
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      if (callback)
        callback(err.message);
    });
  });
}

const constructFilmMessage = (film) => {
  let message = {
    photo: null,
    message: '',
    parse_mode:'markdown'
  };
  let imgUrl = 'https://image.tmdb.org/t/p/w300'

  if (film.poster_path) message.photo = imgUrl + film.poster_path
  else if (film.backdrop_path) message.photo = imgUrl + film.backdrop_path

  message.message =
    `
  🎬 *${film.title || film.name}* (${film.release_date ? film.release_date.split('-')[0] : film.first_air_date.split('-')[0]})
  `

  return message;
}

const searchFilms = async (titoloFilm) => {
  try {
    const res = await axios.get('https://api-filmchecker.herokuapp.com/multi_search/' + titoloFilm + '/1');
    const films = res.data.results.slice(0, 3);
    let messages = []

    films.map(film =>  {
      messages.push(constructFilmMessage(film))
    })

    return messages;
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
download,
searchFilms
};
