/*
 * Page view for the about page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'util',
  'mps',
  'rest',
  'text!../../templates/tabs.html',
  'views/ascent.new',
  'views/session.new',
  'Share',
], function ($, _, Backbone, util, mps, rest, template, NewAscent,
      NewSession, Share) {

  return Backbone.View.extend({

    el: '.tabs',
    working: false,

    initialize: function (app, params) {
      this.app = app;
      this.params = params || {};
      this.on('rendered', this.setup, this);
      this.subscriptions = [
        mps.subscribe('ascent/add', _.bind(function (opts) {
          this.add(null, opts);
        }, this))
      ];
    },

    render: function () {
      if (!this.params.tabs) {
        this.params.tabs = [];
      }

      // Render or activate tabs.
      if (!this.params.tabs || this.params.tabs.length === 0) {
        this.empty();
      }
      var tabs = this.$('.tab');
      if (tabs.length === 0) {
        this.template = _.template(template);
        this.$el.html(this.template.call(this));
      } else {
        var i = -1;
        _.find(this.params.tabs, function (t) {
          ++i;
          return t.active;
        });
        tabs.removeClass('active');
        this.$('.tab:eq(' + i + ')').addClass('active');
      }

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .follow-button': 'follow',
      'click .unfollow-button': 'unfollow',
      'click .watch-button': 'watch',
      'click .unwatch-button': 'unwatch',
      'click .sharing-button': 'toggleShare',
      'click .add-ascent': 'add',
      'click .log-session': 'log'
    },

    setup: function () {
      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    follow: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        if (data.following === 'request') {
          btn.removeClass('follow-button').addClass('disabled')
              .html('<i class="icon-user"></i> Requested');
        } else {
          btn.removeClass('follow-button').addClass('unfollow-button')
              .html('<i class="icon-user-delete"></i> Unfollow');
        }
      });

      return false;
    },

    unfollow: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        btn.removeClass('unfollow-button').addClass('follow-button')
            .html('<i class="icon-user-add"></i> Follow');
      });

      return false;
    },

    watch: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        btn.removeClass('watch-button').addClass('unwatch-button')
            .html('<i class="icon-eye-off"></i> Unwatch');
      });

      return false;
    },

    unwatch: function (e) {
      var btn = $(e.target).closest('a');
      this.request.call(this, btn, function (data) {

        // Update button content.
        btn.removeClass('unwatch-button').addClass('watch-button')
            .html('<i class="icon-eye"></i> Watch');
      });

      return false;
    },

    request: function (target, cb) {

      // Prevent multiple requests.
      if (this.working || !this.app.profile.content.page) {
        return false;
      }
      this.working = true;

      // Make request.
      var path = target.data('path');
      rest.post(path, {}, _.bind(function (err, data) {

        // Clear.
        this.working = false;

        if (err) {

          // Show error.
          mps.publish('flash/new', [{err: err, level: 'error', sticky: true}]);
          return false;
        }

        // Swap paths.
        if (data.following === 'request')
          target.data('path', '').data('_path', '');
        else {
          target.data('path', target.data('_path'));
          target.data('_path', path);
        }

        cb(data);
      }, this));

      return false;
    },

    add: function (e, opts) {
      opts = opts || {};
      if (e) {
        e.preventDefault();
        opts.crag_id = $(e.target).closest('a').data('cid');
      }
      new NewAscent(this.app, opts).render();
    },

    log: function (e) {
      e.preventDefault();
      var aid = $(e.target).closest('a').data('aid');
      var cid = $(e.target).closest('a').data('cid');
      new NewSession(this.app, {crag_id: cid, ascent_id: aid}).render();
    },

    toggleShare: function (err) {
      if (this.share) {
        this.share.toggle();
        return;
      }

      rest.get(window.location.href + '?static=true',
          _.bind(function (err, body) {
        if (err) {
          return console.log(err);
        }

        var rx = /(<meta.*?>)/g;
        var metas = [];
        var match;
        while (match = rx.exec(body)) {
          metas.push(match[1]);
        }
        var head = $('head');
        $('meta', head).remove();
        for (var i = metas.length - 1; i >= 0; --i) {
          $(metas[i]).prependTo(head);
        }

        this.share = new Share('.share-button', {
          url: $('meta[property="og:url"]').attr('content'),
          // title:
          // description:
          // image:
          ui: {
            flyout: 'top right',
            button_font: false,
            button_text: '',
            // icon_font:
          },
          networks: {
            google_plus: {
              enabled: true,
              // url:
            },
            twitter: {
              enabled: true,
              // url:
              // description:
            },
            facebook: {
              enabled: true,
              load_sdk: true,
              // url: 
              app_id: this.app.facebook.clientId,
              // title:
              // caption:
              // description:
              // image:
            },
            pinterest: {
              enabled: false,
              // url:
              // image:
              // description:
            },
            email: {
              enabled: true,
              // title:
              // description:
            }
          }
        });

        this.share.open();
      }, this));
    }

  });
});
  
