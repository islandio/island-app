var crypto = require('crypto')
  , Media
  , Member
  , LoginToken;

function defineModels(mongoose, fn) {
  var Schema = mongoose.Schema
    , ObjectId = Schema.ObjectId;



  /**
   * Transform text into a URL slug: spaces turned into dashes, remove non alnum
   * @param string text
   */
  function slugify(text) {
  	text = text.replace(/[^-a-zA-Z0-9,&\s]+/ig, '');
  	text = text.replace(/-/gi, "_");
  	text = text.replace(/\s/gi, "-");
  	return text.toLowerCase();
  }



  /**
    * Model: Member
    */
  function validatePresenceOf(value) {
    return value && value.length;
  }

  Member = new Schema({
      email             : { type: String, validate: [validatePresenceOf, 'an email is required'], index: { unique: true } }
    , hashed_password   : String
    , salt              : String
    , name              : {
                    first   : String
                  , last    : String
                }
    , twitter           : String
    , role              : { type: String, enum: ['contributor', 'guest'], default: 'guest' }
    , joined            : { type: Date, default: Date.now }
    , slug              : { type: String, index: { unique: true } }
  });

  Member.index({ 'name.last': 1, 'name.first': 1 });

  Member.virtual('id')
    .get(function() {
      return this._id.toHexString();
    });

  Member.virtual('password')
    .set(function(password) {
      this._password = password;
      this.salt = this.makeSalt();
      this.hashed_password = this.encryptPassword(password);
    })
    .get(function() { return this._password; });

  Member.virtual('name.full')
    .get(function () {
      return this.name.first + ' ' + this.name.last;
    })
    .set(function (setFullNameTo) {
      var split = setFullNameTo.split(' ')
        , firstName = split[0], lastName = split[1];
      this.set('name.first', firstName);
      this.set('name.last', lastName);
    });

  Member.method('authenticate', function(plainText) {
    return this.encryptPassword(plainText) === this.hashed_password;
  });

  Member.method('makeSalt', function() {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  Member.method('encryptPassword', function(password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
  });

  Member.pre('save', function(next) {
    if (this.isNew) {
      if (!validatePresenceOf(this.password)) {
        next(new Error('Invalid password'));
      } else {
        // Automatically create the slugs
        this.slug = slugify(this.name.first + ' ' + this.name.last);
        next();
      }
    } else {
      next();
    }
  });



  /**
    * Model: Comments
    */    
  var Comment = new Schema({
      body      : String
    , comments  : [Comment]
    , added     : { type: Date, default: Date.now }
    , meta      : {
            likes     : { type: Number, default: 0 }
        }
    , member_id : ObjectId
  });



  /**
    * Model: Media
    */
  Media = new Schema({
      title       : String
    , body        : String
    , comments    : [Comment]
    , type        : { type: String, index: true }
    , added       : { type: Date, default: Date.now }
    , meta        : {
              featured  : Boolean
            , tags      : { type: Array, index: true }  
            , hits      : Number
            , likes     : { type: Number, default: 0 }
          }
    , member_id   : ObjectId
    , attached    : {}
  });

  Media.pre('save', function(next) {
    // parse the tags
    var tags = this.meta.tags[0].trim().split(',');
    for (t in tags)
      tags[t] = tags[t].trim().toLowerCase();
    this.meta.tags = tags;
    next();
  });

  Media.virtual('id')
    .get(function() {
      return this._id.toHexString();
    });



  /**
    * Model: LoginToken
    *
    * Used for session persistence.
    */
  LoginToken = new Schema({
      email   : { type: String, index: true }
    , series  : { type: String, index: true }
    , token   : { type: String, index: true }
  });

  LoginToken.method('randomToken', function() {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  LoginToken.pre('save', function(next) {
    // Automatically create the tokens
    this.token = this.randomToken();

    if (this.isNew)
      this.series = this.randomToken();

    next();
  });

  LoginToken.virtual('id')
    .get(function() {
      return this._id.toHexString();
    });

  LoginToken.virtual('cookieValue')
    .get(function() {
      return JSON.stringify({ email: this.email, token: this.token, series: this.series });
    });


  mongoose.model('Member', Member);
  mongoose.model('Comment', Comment);
  mongoose.model('Media', Media);
  mongoose.model('LoginToken', LoginToken);

  fn();
}

exports.defineModels = defineModels; 

