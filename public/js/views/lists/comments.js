/*
 * Comments List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'lib/textarea-caret-position/index',
  'text!../../../templates/lists/comments.html',
  'collections/comments',
  'views/rows/comment',
  'views/lists/hangtens',
  'views/lists/choices'
], function ($, _, List, mps, rest, util, Caret, template, Collection,
    Row, Hangtens, Choices) {
  return List.extend({
    
    el: '.comments',

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection();
      this.options = options;
      this.type = options.type;
      this.Row = Row;

      List.prototype.initialize.call(this, app, options);

      this.subscriptions = [];

      if (!this.options.hangtenOnly) {
        _.bindAll(this, 'collect', '_remove');
        this.app.rpc.socket.on('comment.new', this.collect);
        this.app.rpc.socket.on('comment.removed', this._remove);
      }

      var list = this.parentView.model.get('comments') || [];
      var cnt = this.parentView.model.get('comments_cnt') || 0;
      this.collection.older = cnt - list.length;
      this.collection.reset(list);
    },

    setup: function () {
      this.footer = this.$('.list-footer');
      this.inputWrap = this.$('#comment_input .comment');
      // a bit of a hack... we use the event page search wrapper to deal
      // with Z-indexing issues. In standalone comment pages, we use
      // a local wrapper
      this.commentBody = this.$('textarea[name="body"]')

      if (!this.options.hangtenOnly) {

        // Autogrow the write comment box.
        this.$('textarea[name="body"]').autogrow();

        // Show other elements.
        this.$('.comments-older.comment').show();
        if (!this.options.hideInput) {
          this.inputWrap.show();
          if (!this.choices) this.createChooser();
        } else {
          this.parentView.$('.toggle-comment-input').click(_.bind(function (e) {
            e.preventDefault();
            if (this.inputWrap.is(':visible')) {
              this.inputWrap.hide();
              this.choices.destroy();
            } else {
              this.inputWrap.show();
              this.$('textarea.comment-input').focus();
              if (!this.choices) this.createChooser();
            }
          }, this));
        }
      }

      this.hangtens = new Hangtens(this.app, {parentView: this});

      return List.prototype.setup.call(this);
    },

    createChooser: function() {
      var html = ''
        + '<div class="comment-input-search inline-search">'
        +  '<div class="search-display"><div class="list-header"></div></div>'
        + '</div>';
      $('body').append(html);
      this.commentSearch = $('.comment-input-search');
      this.choices = new Choices(this.app, {
        reverse: true,
        el: this.commentSearch,
        choose: true,
        onChoose: _.bind(this.choose, this),
        types: ['members']
      });

    },

    keydown: function(e) {
      var re = /\B@(\S*?)$/
      var res = re.exec(this.commentBody.val())
      if (res && this.choices && this.choices.count() !== 0) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13)) {
          this.choices.chooseExternal();
          return false;
        } else if (!e.shiftKey && (e.keyCode === 38 || e.which === 38)) {
          this.choices.up();
          return false;
        } else if (!e.shiftKey && (e.keyCode === 40 || e.which === 40)) {
          this.choices.down();
          return false;
        }
      } else {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13)) {
          this.write();
          return false;
        }
      }
    },

    keyup: function(e) {
      return false;
    },

    input: function(e) {
      // Test for @ pattern ending in the text area
      var re = /\B@(\S*?)$/
      var res = re.exec(this.commentBody.val())
      if (res) {
        var caretCoord = window.getCaretCoordinates(this.commentBody[0], res.index);
        var searchTop = (this.commentBody.offset().top
            - this.commentSearch.parent().offset().top
            + caretCoord.top + 20) + 'px';
        var searchLeft = (this.commentBody.offset().left
            - this.commentSearch.parent().offset().left
            + caretCoord.left) + 'px';
        this.commentSearch.css({top: searchTop, left: searchLeft});
        this.commentSearch.show();
        this.choices.search(null, res[1]);
      } else {
        this.commentSearch.hide();
        this.choices.hide();
      }
    },

    choose: function(model) {
      var username = model.get('username')
      var re = /\B@(\S*?)$/
      var res = re.exec(this.commentBody.val())
      if (res) {
        var text = this.commentBody.val().substr(0, res.index);
        this.commentBody.val(text + '@' + username + ' ');
      }
    },

    blur: function (e) {
      this.commentSearch.hide();
      this.choices.hide();
    },


    destroy: function () {
      this.app.rpc.socket.removeListener('comment.new', this.collect);
      this.app.rpc.socket.removeListener('comment.removed', this._remove);
      if (this.choices)
        this.choices.destroy();
      return List.prototype.destroy.call(this);
    },

    events: {
      'click .comments-signin': 'signin',
      'click .comments-older': 'older',
      'blur textarea[name="body"].comment-input': 'blur',
      'keydown textarea[name="body"].comment-input': 'keydown',
      'keyup textarea[name="body"].comment-input': 'keyup',
      'input textarea[name="body"].comment-input': 'input'
    },

    collect: function (data) {
      if (data.parent_id === this.parentView.model.id &&
          !this.collection.get(-1)) {
        this.collection.push(data);
      }
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        view._remove(_.bind(function () {
          this.collection.remove(view.model);
        }, this));
      }
    },

    write: function (e) {
      if (e) e.preventDefault();

      var form = $('form.comment-input-form', this.el);
      var input = this.$('textarea.comment-input');
      input.val(util.sanitize(input.val()));
      if (input.val().trim() === '') return;

      var payload = form.serializeObject();
      payload.body = util.sanitize(payload.body);

      var data = {
        id: -1,
        author: this.app.profile.member,
        body: payload.body,
        created: new Date().toISOString()
      };

      payload.parent_id = this.parentView.model.id;

      this.collection.push(data);
      input.val('').keyup();

      rest.post('/api/comments/' + this.type, payload,
          _.bind(function (err, data) {
        if (err) {
          this.collection.pop();
          return console.log(err);
        }

        var comment = this.collection.get(-1);
        comment.set('id', data.id);
        this.$('#-1').attr('id', data.id);

        if (this.options.hideInput) {
          // this.inputWrap.hide();
        }

      }, this));

      return false;
    },

    older: function (e) {

      var limit = this.collection.older;
      this.collection.older = 0;

      rest.post('/api/comments/list', {
        skip: this.collection.length,
        limit: limit,
        parent_id: this.parentView.model.id,
      }, _.bind(function (err, data) {
        if (err) return console.log(err);

        var ids = _.pluck(this.collection.models, 'id');
        this.collection.options.reverse = true;
        var i = 0;
        _.each(data.comments.items, _.bind(function (c) {
          if (!_.contains(ids, c.id)) {
            this.collection.unshift(c);
            ++i;
          }
        }, this));
        this.collection.options.reverse = false;

        this.$('.comments-older.comment').hide();
      }, this));

    },

    signin: function (e) {
      e.preventDefault();
      mps.publish('member/signin/open');
    }

  });
});
