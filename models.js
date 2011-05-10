var crypto = require('crypto')
  , Member
  , Comment
  , Rating
  , Media
  , LoginToken
;

function defineModels(mongoose, fn) {
  var Schema = mongoose.Schema
    , ObjectId = Schema.ObjectId;



  /**
   * Make a random string
   * @param int l
   */

  function makeKey(l) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < l; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
  }



  /**
   * Transform text array of searchable terms
   * @param string text
   */
  function makeTerms(text) {
    text = text.replace(/[~|!|@|#|$|%|^|&|*|(|)|_|+|`|-|=|[|{|;|'|:|"|\/|\\|?|>|.|<|,|}|]|]+/gi, "");
    text = text.replace(/\s{2,}/g, ' ');
    return text.toLowerCase().trim().split(' ');
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
          first         : String
        , last          : String
      }
    , twitter           : String
    , role              : { type: String, enum: ['contributor', 'guest'], default: 'contributor' }
    , joined            : { type: Date, default: Date.now }
    , confirmed         : { type: Boolean, default: false }
    , meta              : {
          logins        : { type: Number, default: 0 }
      }
  });

  Member.index({ 'name.last': 1, 'name.first': 1 });

  Member.virtual('id')
    .get(function () {
      return this._id.toHexString();
    });

  Member.virtual('password')
    .set(function (password) {
      this._password = password;
      this.salt = this.makeSalt();
      this.hashed_password = this.encryptPassword(password);
    })
    .get(function () { return this._password; });

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

  Member.method('authenticate', function (plainText) {
    return this.encryptPassword(plainText) === this.hashed_password;
  });

  Member.method('makeSalt', function () {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  Member.method('encryptPassword', function (password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
  });

  Member.pre('save', function (next) {
    if (this.isNew) {
      if (!validatePresenceOf(this.password)) {
        next(new Error('Invalid password'));
      } else {
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
    , comments  : [ObjectId]
    , added     : { type: Date, default: Date.now, index: true }
    , likes     : { type: Number, default: 0 }
    , member_id : { type: ObjectId, index: true }
    , parent_id : ObjectId
  });

  Comment.virtual('id')
    .get(function () {
      return this._id.toHexString();
    });



  /**
    * Model: Rating
    */    
  var Rating = new Schema({
      member_id : ObjectId
    , hearts    : { type: Number, default: 0 }
  });

  Rating.virtual('mid')
    .get(function () {
      return this.member_id.toHexString();
    });



  /**
    * Model: Media
    */
  Media = new Schema({
      key         : { type: String, index: true }
    , title       : String
    , terms       : { type: Array, index: true }
    , body        : String
    , comments    : [ObjectId]
    , type        : { type: String, index: true }
    , added       : { type: Date, default: Date.now }
    , meta        : {
          tags    : { type: Array, index: true }
        , hits    : { type: Number, default: 0 }
        , hearts  : { type: Number, default: 0 }
        , ratings : [Rating]
      }
    , member_id   : ObjectId
    , attached    : {}
  });

  Media.pre('save', function (next) {
    // TMP fix tags
    if (!this.isNew && this.meta.tags) {
      var newTags = [];
      for (var i=0; i < this.meta.tags.length; i++) {
        if (this.meta.tags[i].indexOf(' ') != -1) {
          var ts = makeTerms(this.meta.tags[i]);
          newTags = newTags.concat(ts);
        } else {
          newTags.push(this.meta.tags[i]);
        }
      }
      this.meta.tags = newTags;
    }
    
    if (this.isNew) {
      // make key
      this.key = makeKey(8);
      // parse title for search terms
      this.terms = makeTerms(this.title);
      // parse the tags
      var tags = this.meta.tags[0].trim();
      if (tags != '') {
        this.meta.tags = this.meta.tags;//makeTerms(tags);
      }
    }
    // count hearts
    if (this.meta.ratings) {
      var hearts = 0;
      for (var i=0; i < this.meta.ratings.length; i++) {
        hearts += this.meta.ratings[i].hearts;
      }
      this.meta.hearts = hearts;
    }
    next();
  });

  Media.virtual('id')
    .get(function () {
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

  LoginToken.method('randomToken', function () {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  LoginToken.pre('save', function (next) {
    // Automatically create the tokens
    this.token = this.randomToken();

    if (this.isNew)
      this.series = this.randomToken();

    next();
  });

  LoginToken.virtual('id')
    .get(function () {
      return this._id.toHexString();
    });

  LoginToken.virtual('cookieValue')
    .get(function () {
      return JSON.stringify({ email: this.email, token: this.token, series: this.series });
    });


  mongoose.model('Member', Member);
  mongoose.model('Comment', Comment);
  mongoose.model('Rating', Rating);
  mongoose.model('Media', Media);
  mongoose.model('LoginToken', LoginToken);

  fn();
}

exports.defineModels = defineModels; 

