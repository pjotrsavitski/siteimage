var restify = require('restify');
var phantom = require('phantom');
var path = require('path');
var lib = require('./lib.js');
var validator = require('validator');
var genericpool = require('generic-pool');

var pool = genericpool.Pool({
  name: 'phantomjs',
  create: function(callback) {
    // TODO Need to set different ports
    // XXX This is important
    phantom.create(function(ph) {
      callback(null, ph);
    }, {
      path: path.join(__dirname, 'node_modules/phantomjs/bin/'),
      parameters:{ 'ignore-ssl-errors':'yes' }
      }
    );
  },
  destroy: function(ph) { ph.exit(); },
  max: 10,
  //min: 2,
  idleTimeoutMillis: 30000,
  log: false
});

var server = restify.createServer();

server.use(restify.bodyParser({ mapParams: false }));

// TODO Need better confugurable logging
server.on('uncaughtException', function (req, res, route, err) {
    console.log('uncaughtException', err.stack);
});

server.get('/', function(req, res, next) {
  res.json(200, {
    "api": {
      "/": {
        "type" : "GET",
        "decription": "Shows this message"
      },
      "/capture/": {
        "type": "POST",
        "description": "Captures provided address",
        "body": {
          "pageUrl": "URL of the page to capture (required)",
          "viewportWidth": "Viewport width to set for capturable (optional)",
          "viewportHeight": "Viewport height to set for capturable (optional)",
          "imageFormat": "A format for the returned image (optional defaults to png), png or jpeg",
          "responseFormat": "A response format returned (optional defaults to base64), base64 or binary"
        }
      }
    }
  });
  return next();
});

server.post('/capture', function(req, res, next) {
  if (!req.body) {
    return next(new restify.MissingParameterError('pageUrl is required!'));
  }

  var pageUrl = req.body.pageUrl ? req.body.pageUrl : null,
  viewportWidth = req.body.viewportWidth ? parseInt(req.body.viewportWidth, 10) : 1024,
  viewportHeight = req.body.viewportHeight ? parseInt(req.body.viewportHeight, 10) : 768,
  imageFormat = req.body.imageFormat ? req.body.imageFormat.toLowerCase() : 'png',
  responseFormat = req.body.responseFormat? req.body.responseFormat.toLowerCase() : 'base64';

  if (!pageUrl) {
    return next(new restify.MissingParameterError('pageUrl is required!'));
  } else if (!validator.isURL(pageUrl, ['http', 'https'])) {
    return next(new restify.MissingParameterError('pageUrl value provided is not a valid URL!'));
  }

  viewportWidth = lib.applyIntegerBoundaries(320, 1024, viewportWidth);
  viewportHeight = lib.applyIntegerBoundaries(240, 768, viewportHeight);

  if (['png', 'jpeg'].indexOf(imageFormat) === -1) {
    imageFormat = 'png';
  }

  if (['base64', 'binary'].indexOf(responseFormat) === -1) {
    responseFormat = 'base64';
  }

  pool.acquire(function(err, ph) {
    if (err) {
      return next(new restify.TooManyRequestsError('No free handlers available!'));
    }
    ph.createPage(function(page) {
      page.set('viewportSize', { width: viewportWidth, height: viewportHeight });
      page.open(pageUrl, function(status) {

        if ('success' !== status) {
          page.close();
          pool.release(ph);
          return next(new restify.ResourceNotFoundError('Provided pageUrl could not be opened!'));
        }

        page.renderBase64(imageFormat.toUpperCase(), function(data) {
          if ('binary' === responseFormat) {
            var buf = new Buffer(data, 'base64');
            res.setHeader('content-type', 'image/' + imageFormat);
            res.setHeader('content-length', buf.length);
            res.send(buf);
          } else if ('base64' === responseFormat) {
            res.set('content-type', 'application/octet-stream');
            res.send('data:image/' + imageFormat + ';base64,' + data);
          }
          page.close();
          pool.release(ph);
          return next();
          });
        });
    });
  }, {
    path: path.join(__dirname, 'node_modules/phantomjs/bin/'),
    parameters:{ 'ignore-ssl-errors':'yes' }
    }
  );
});

server.listen(process.env.PORT || 3000, function() {
  console.log('%s listening at %s', server.name, server.url);
});

process.on('exit', function() {
  pool.drain(function() {
    pool.destroyAllNow();
  });
});
