const axios = require('axios');

/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

var client_id = 'ef33b86f6f6847b89281232374f72ec8'; // Your client id
var client_secret = 'e537348df7a04ba090f5ea1b750c76f8'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser())
  .use(session({
    secret: "asdfasdf",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
    }
  }));

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };



    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          // console.log(body);
        });
        console.log(access_token);

        // we can also pass the token to the browser to make requests from there
        // window.location.href = 'http://localhost:8077';
        var params = {
          access_token: access_token,
          data: null,
        }

        var user = {
          
        }
        axios.get('https://api.spotify.com/v1/me', {
          params: {
            access_token: access_token,
          },
        })
          .then(response => {
            params.data = response.data;
            req.session.user = params;
            // res.json(JSON.stringify(response.data));
            // console.log(object);
            // var obj = JSON.stringify(params);
            // res.cookie('user', obj);
            // req.session.save(function() {
            //   res.redirect('http://localhost:8080');
            // })
            return params;
          })
          .then(obj => {
            // console.log(obj);
            // console.log(obj.access_token);
            user = obj;
            // res.cookie('user', JSON.stringify(obj));
            return data = {
              accessToken: obj.access_token,
              id: obj.data.id,
              displayName: obj.data.display_name,
              email: obj.data.email,
            }
          })
          .then(data => {
            return axios.post("http://localhost:8077/user/login", data, {
              headers: {
                "Content-Type": `application/json`,
              },
            });
          })
          .then(response => {
            user.data.member_id = response.data.member_id;
            res.cookie('user', JSON.stringify(user));
          })
          .finally(() => {
            res.redirect("http://localhost:8080");;
          });
          

        // res.redirect('/#' +
        //   querystring.stringify({
        //     access_token: access_token,
        //     refresh_token: refresh_token
        //   }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

var SpotifyWebApi = require('spotify-web-api-node');

// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uri,
});

app.get('/search', function (req, res) {
  spotifyApi.setAccessToken(req.query.access_token);
  spotifyApi.searchTracks(req.query.track)
    .then(function (data) {
      console.log('Search by ' + req.query.track, data.body);
      res.send({
        track: data.body,
      });
    }, function (err) {
      console.error(err);
    });
});

console.log('Listening on 8888');
app.listen(8888);
