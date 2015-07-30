var express          = require('express'),
    compression      = require('compression'),
    expressValidator = require('express-validator'),
    path             = require('path'),
    fs               = require('fs');
    favicon          = require('serve-favicon'),
    logger           = require('morgan'),
    cookieParser     = require('cookie-parser'),
    bodyParser       = require('body-parser'),
    util             = require('util'),
    LRU              = require('lru-cache'),
    uuid             = require('uuid'),
    hljs             = require(path.join(__dirname,'node_modules','highlight.js','lib','index.js'));

var storage_type   = process.env.NODE_NOPASTE_STORAGE_TYPE   || 'memory';
var redis_hash_key = process.env.NODE_NOPASTE_REDIS_HASH_KEY || "node-nopaste-storage";
var lru_max_age    = process.env.NODE_NOPASTE_LRU_MAX_AGE    || 60 * 60 * 24;

var app = express();

var cache = LRU({ maxAge: lru_max_age });

var highlightjs_path    = path.join(__dirname,'node_modules','highlight.js','lib','highlight.js');
var highlightjs_css_dir = path.join(__dirname,'node_modules','highlight.js','styles');

var ghlightjs_css_files = {};
var ghlightjs_image_files = {};
fs.readdirSync(highlightjs_css_dir).filter(function(file){
    return /^.+\.(css|png|jpg)$/.test(file);
}).forEach(function(file){
    var match = file.match(/^(.+)\.(.+)$/);
    switch( match[2] ) {
        case "css":
            ghlightjs_css_files[match[1]] = file;
            break;
        case 'jpg':
            ghlightjs_image_files[file] = 'image/jpag';
            break;
        default:
            ghlightjs_image_files[file] = 'image/' + match[2];
            break;
    }
});

var storage = (function(){
    var Storage;
    if( storage_type == 'memory' ) {
        Storage = function(){
            this.data = {};
        };
        Storage.prototype.set = function(uuid,data) {
            this.data[uuid] = data;
        };
        Storage.prototype.get = function(uuid,callback) {
            callback(null,this.data[uuid]);
        };
        return new Storage();
    } else if( storage_type == 'redis'  ) {
        Storage = function(){
            var redis   = require("redis");
            this.client = redis.createClient();
            this.redis_hash_key = redis_hash_key;
        };
        Storage.prototype.set = function(uuid,data) {
            this.client.hset(this.redis_hash_key, uuid, data);
        };
        Storage.prototype.get = function(uuid,callback) {
            this.client.hget(this.redis_hash_key,uuid,callback);
        };
        return new Storage();
    }
}())

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(expressValidator());

app.use(function (req, res, next) {
    res.locals = {
        title: 'No Paste',
        ghlightjs_css_files: ghlightjs_css_files
    };
    next();
});

app.get('/css/:style',function(req,res,next) {
    var style = req.params.style;

    var file;
    var content_type;
    if( ghlightjs_css_files[style]) {
        file         = ghlightjs_css_files[style];
        content_type = 'text/css';
    }
    else if ( ghlightjs_image_files[style] ) {
        file         = style;
        content_type = ghlightjs_image_files[style];
    }
    else {
        res.status(404).send('Unexpected style: ' + style);
        return;
    }

    res.append('Content-Type',content_type);
    res.sendFile(path.join(highlightjs_css_dir,file));
});

app.get('/', function(req, res, next) {
  res.render('index');
});

app.post('/add',function(req, res, next) {
    req.checkBody('data', 'Invalid data').notEmpty();

    var errors = req.validationErrors();
    if (errors) {
        res.status(400).send('There have been validation errors: ' + util.inspect(errors));
        return;
    }

    var uuid_v1 = uuid.v1();
    storage.set(uuid_v1,req.body['data']);

    res.redirect('/show?uuid=' + uuid_v1);
});

app.get('/show',function(req, res, next) {
    req.checkQuery('uuid', 'Invalid uuid').notEmpty();

    var errors = req.validationErrors();
    if (errors) {
        res.status(400).send('There have been validation errors: ' + util.inspect(errors));
        return;
    }

    var style   = req.cookies['style'] || 'default';

    // To turn off after installation version number for backwards compatibility.
    style = style.replace(/\.css/,'');

    var results = cache.get(req.query['uuid']);
    if( results ) {
        return res.render('show',
            { value: results['value'], language: results['language'] ,style: style });
    }

    storage.get(req.query['uuid'],function(err,data){
        if(err || !data) {
            res.status(400).send('Unexpected uuid: ' + (req.query['uuid'] || ''));
            return;
        }
        var results = hljs.highlightAuto(data);
        cache.set(req.query['uuid'],results);
        res.render('show', { value: results['value'], language: results['language'] ,style: style });
    });
});

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
