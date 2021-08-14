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

const constructFilmMessage = (film, providers) => {
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

${(film.overview.length > 300) ? film.overview.substr(0, 300) + '...' : film.overview}

In Italia disponibile su: ${providers && providers.filter(c => c[0]==='IT').map(p =>  p[1].flatrate && Object.values(p[1].flatrate).map(provider =>{return provider.provider_name +' |'}))}
  `

  return message;
}

const searchFilms = async (titoloFilm) => {
  try {
    const res = await axios.get('https://api-filmchecker.herokuapp.com/multi_search/' + titoloFilm + '/1');
    const films = res.data.results.slice(0, 3);
    var messages = []

    const promises = films.map(async film =>  {
      try {
        const res = await axios.get('https://api-filmchecker.herokuapp.com/provider/'+ film.media_type +'/' + film.id);
        const providers = Object.entries(res.data.results)
        const message = await constructFilmMessage(film, providers);
         return message
      } catch(e){
        console.log(e);
      }
    })
    messages = await Promise.all(promises);
    return messages;
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
download,
searchFilms
};
