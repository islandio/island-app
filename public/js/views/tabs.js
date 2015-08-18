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
  'text!../../templates/confirm.html',
  'views/ascent.new',
  'views/session.new'
], function ($, _, Backbone, util, mps, rest, template, confirm, NewAscent,
      NewSession) {

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

      if (this.share) {
        delete this.share;
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
      'click .sharing-button': function () {
        mps.publish('modal/share/open');
      },
      'click .add-ascent': 'add',
      'click .log-session': 'log',
      'click .clean-button': 'cleanLogs'
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

    cleanLogs: function (e) {
      e.preventDefault();

      $.fancybox(_.template(confirm)({
        message: 'Delete duplicate sends?',
        confirmTxt: '<i class="icon-flash"></i> <span>Clean</span>'
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      var mid = $(e.target).closest('.clean-button').data('member-id');
      $('.modal-cancel').click(function (e) {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function (e) {
        rest.post('/api/ticks/' + mid + '/clean', {}, _.bind(function (err, data) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error', type: 'popup'},
              true]);
            return false;
          }

          mps.publish('flash/new', [{
            message: 'You deleted ' + util.addCommas(data.count) +
                ' duplicate ascent' + (data.count !== 1 ? 's': '') + '.',
            level: 'alert',
            sticky: true
          }, true]);

          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

  });
});
