"use strict";

const restify = require('restify');
const restifyErrors = require('restify-errors');
const phantom = require('phantom');
const path = require('path');
const lib = require('./lib.js');
const validator = require('validator');
const genericPool = require('generic-pool');
const bunyan = require('bunyan');
const binaryFormatter = require('restify/lib/formatters/binary.js');

const log = bunyan.createLogger({
  name: 'SiteImage',
  streams: [
    {
      level: 'info',
      stream: process.stdout
    },
    {
      level: 'error',
      path: path.join(__dirname, 'logs/error.log')
    }
  ]
});

const pool = genericPool.createPool({
  create: function() {
    return phantom.create(['--ignore-ssl-errors=true'], path.join(__dirname, 'node_modules/phantomjs-prebuilt/bin/'));
  },
  destroy: function(ph) {
    return ph.exit();
  }
}, {
  max: 10,
  idleTimeoutMillis: 30000,
  log: false
});

const server = restify.createServer({
  log: log,
  name: 'SiteImage',
  varsion: '0.0.1',
  formatters: {
    'image/png; q=0.9': binaryFormatter,
    'image/jpeg; q=0.9': binaryFormatter
  }
});

server.use(restify.plugins.bodyParser({ mapParams: false }));

// TODO Need better confugurable logging
/**
 * Setting up logging of exceptions. This will allow debugging.
 */
server.on('uncaughtException', function (req, res, route, err) {
    req.log.error(path, err);
});

/**
 * Respond with JSON encoded description of API (GET)
 */
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
          "viewportWidth": "Viewport width to set for capturable (optional), supports range 320 - 1024",
          "viewportHeight": "Viewport height to set for capturable (optional), support range 240 - 768",
          "imageFormat": "A format for the returned image (optional defaults to png), png or jpeg",
          "responseFormat": "A response format returned (optional defaults to base64), base64 or binary. Includes data:image/<format>;base64, string in the beginning"
        }
      }
    }
  });
  return next();
});

/**
 * Tries to capture the screenshot based on provided data. Uses meaningful
 * defaults. Error responses will be served as default application/json type
 * of response.
 * In case of binary the image will be delivered as binary data with correct
 * header being set.
 * For base64 encoded response an application/octet-stream will be set returning
 * the data (please note that data:image<format>;base64, will be prepended).
 */
server.post('/capture', function(req, res, next) {
  if (!req.body) {
    return next(new restifyErrors.MissingParameterError('pageUrl is required!'));
  }

  var pageUrl = req.body.pageUrl ? req.body.pageUrl : null,
  viewportWidth = req.body.viewportWidth ? parseInt(req.body.viewportWidth, 10) : 1024,
  viewportHeight = req.body.viewportHeight ? parseInt(req.body.viewportHeight, 10) : 768,
  imageFormat = req.body.imageFormat ? req.body.imageFormat.toLowerCase() : 'png',
  responseFormat = req.body.responseFormat? req.body.responseFormat.toLowerCase() : 'base64';

  if (!pageUrl) {
    return next(new restifyErrors.MissingParameterError('pageUrl is required!'));
  } else if (!validator.isURL(pageUrl, ['http', 'https'])) {
    return next(new restifyErrors.MissingParameterError('pageUrl value provided is not a valid URL!'));
  }

  viewportWidth = lib.applyIntegerBoundaries(320, 1024, viewportWidth);
  viewportHeight = lib.applyIntegerBoundaries(240, 768, viewportHeight);

  imageFormat = lib.getCheckedOption(['png', 'jpeg'], 'png', imageFormat);
  responseFormat = lib.getCheckedOption(['base64', 'binary'], 'base64', responseFormat);

  var timedOut = false;
  var timeoutId = setTimeout(function() {
    timedOut = true;
    return next(new restifyErrors.RequestTimeoutError('No free handlers available!'));
  }, 60000);

  (async function() {
    let ph, page, status, data;

    try {
      ph = await pool.acquire();
    } catch (err) {
      req.log.error(err);
      return next(new restifyErrors.InternalServerError('Could not acquire phantomjs instance!'));
    }

    // Return to pool if request has already timed out
    if (timedOut) {
      pool.release(ph);
      return;
    } else {
      clearTimeout(timeoutId);
    }

    try {
      page = await ph.createPage();
    } catch (err) {
      req.log.error(err);
      return next(new restifyErrors.ResourceNotFoundError('Provided pageUrl could not be opened!'));
    }

    page.property('viewportSize', { width: viewportWidth, height: viewportHeight });
    page.property('clipRect', { top: 0, left: 0, width: viewportWidth, height: viewportHeight });

    try {
      status = await page.open(pageUrl);
    } catch (err) {
      req.log.error(err);
      return next(new restifyErrors.ResourceNotFoundError('Provided pageUrl could not be opened!'));
    }

    if ('success' !== status) {
      page.close();
      pool.release(ph);
      return next(new restifyErrors.ResourceNotFoundError('Provided pageUrl could not be opened!'));
    }

    try {
      data = await page.renderBase64(imageFormat.toUpperCase());
    } catch(err) {
      req.log.error(err);
      return next(new restifyErrors.InternalServerError('Could not get image data!'));
    }

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
  })();
});

/**
 * Run the server, default to port 3000
 */
server.listen(process.env.PORT || 3000, function() {
  log.info('%s listening at %s', server.name, server.url);
});

/**
 * Sets up listener for process exit event.
 * Will make sure to destroy any PhantomJS instances in the pool
 */
process.on('exit', function() {
  pool.drain().then(function() {
    pool.clear();
  });
});
