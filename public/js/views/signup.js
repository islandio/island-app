/*
 * Signup view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/signup.html'
], function ($, _, Backbone, mps, rest, util, Spin, template) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | Sign Up');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Init the load indicators.
      this.$('.button-spin').each(function (el) {
        var opts = {
          color: '#3f3f3f',
          lines: 13,
          length: 3,
          width: 2,
          radius: 6,
        };
        if ($(this).hasClass('button-spin-white')) {
          opts.color = '#fff';
        }
        $(this).data('spin', new Spin($(this), opts));
      });

      // Show the spinner when connecting.
      this.$('.signin-strategy-btn').click(_.bind(function (e) {
        $('.button-spin', $(e.target).parent()).data().spin.start();
        $(e.target).addClass('loading');
      }, this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .signup-submit': 'signup'
    },

    setup: function () {

      // Save refs.
      this.signupButton = this.$('.signup-submit');

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Handle username.
      this.$('.signup-username').bind('keydown', function (e) {
        if (_.contains([32], e.which)) {
          return false;
        }
      }).bind('keyup', function (e) {
        if (!_.contains([37,38,39,40,9,91,16], e.which)) {
          $(this).val(util.toUsername($(this).val()));
        }
      });

      // Focus cursor initial.
      _.delay(_.bind(function () { this.focus(); }, this), 1);

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) {
          $(i).focus();
        }
        return empty;
      });
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

    signup: function () {

      // Sanitize.
      this.$('input[type!="submit"]:visible').each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      // Grab the form data.
      var payload = {
        username: this.$('.signup-username').val().trim(),
        email: this.$('.signup-email').val().trim(),
        password: this.$('.signup-password').val().trim()
      };

      // Client-side form check.
      var spin = this.$('.button-spin').data().spin;
      var check = util.ensure(payload, ['username', 'email', 'password']);
      
      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('input[name="' + m + '"]');
        field.val('').addClass('input-error');
        if (i === 0) {
          field.focus();
        }
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required';
        mps.publish('flash/new', [{err: {message: msg},
            level: 'error', sticky: true}, true]);

        return false;
      }
      if (!util.isEmail(payload.email)) {

        // Set the error display.
        this.$('.signup-email').val('').addClass('input-error').focus();
        var msg = 'Use a valid email address';
        mps.publish('flash/new', [{err: {message: msg},
            level: 'error', sticky: true}, true]);

        return false;
      }
      if (payload.username.length < 4) {

        // Set the error display.
        this.$('.signup-username').val('').addClass('input-error').focus();
        var msg = 'Username must be > 3 characters';
        mps.publish('flash/new', [{err: {message: msg},
            level: 'error', sticky: true}, true]);

        return false;
      }
      if (payload.password.length < 7) {

        // Set the error display.
        $('.signup-password').val('').addClass('input-error').focus();
        var msg = 'Password must be > 6 characters';
        mps.publish('flash/new', [{err: {message: msg},
            level: 'error', sticky: true}, true]);

        return false;
      }

      // All good, show spinner.
      this.signupButton.addClass('loading');
      spin.start();

      // Do the API request.
      rest.post('/api/members', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          spin.stop();
          this.signupButton.removeClass('loading');

          // Set the error display.
          mps.publish('flash/new', [{err: err, level: 'error', sticky: true}, true]);

          // Clear fields.
          if (err.message === 'Username exists') {
            this.$('.signup-username').val('').addClass('input-error').focus();
          } else if (err.message === 'Email address exists') {
            this.$('.signup-email').val('').addClass('input-error').focus();
          } else {
            this.$('input[type="text"], input[type="password"]').val('')
                .addClass('input-error');
            this.focus();
          }
          
          return;
        }

        // Reload the current page.
        this.refresh();
      }, this));

      return false;
    },

    refresh: function () {
      var frag = Backbone.history.fragment;
      Backbone.history.fragment = null;
      window.location.href = '/';
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
