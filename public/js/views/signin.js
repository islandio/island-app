/*
 * Login view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rpc',
  'util',
  'text!../../templates/signin.html',
  'Spin',
  'swfobject'
], function ($, _, Backbone, Modernizr, mps, rpc, util, template, Spin) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'signin',

    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Add placeholder shim if need to.
      if (!Modernizr.input.placeholder)
        this.$('input').placeholder();

      // Init the load indicator.
      this.spin = new Spin(this.$('#signin_spin'), {
        lines: 17,
        length: 12,
        width: 4,
        radius: 18,
        color: '#4d4d4d'
      });

      // Embed the background video.
      swfobject.embedSWF(
          __s + '/swf/roll.swf', 'roll', '100%', '100%', 10,
          '', {}, {menu: 'false', wmode: 'opaque'}, {});

      // Show the spinner when connecting.
      this.$('.signin-strategy-btn').click(_.bind(function (e) {
        this.$('.signin-inner').empty();
        this.spin.start();
      }, this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #signin': 'signin',
      'click #signup': 'signup',
      'click a.navigate': 'navigate',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.signinForm = $('#signin_form');
      this.signupForm = $('#signup_form');

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Switch highlighted region.
      this.$('input[type="text"], input[type="password"]').focus(
          _.bind(function (e) {
        var form = $(e.target).closest('form');
        if (!form.hasClass('highlight')) {
          this.$('.signin-forms form').removeClass('highlight');
          form.addClass('highlight');
        }
      }, this));

      // Focus cursor initial.
      _.delay(_.bind(function () { this.focus(); }, this), 1);
      

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('form.highlight input[type!="submit"]:visible'),
          function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) $(i).focus();
        return empty;
      });
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    signin: function (e) {
      e.preventDefault();

      // Sanitize.
      this.$('input[type!="submit"]:visible').each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      // Grab the form data.
      var payload = this.signinForm.serializeObject();

      // Client-side form check.
      var errorMsg = $('.signin-error', this.signinForm);
      var check = util.ensure(payload, ['username', 'password']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = $('input[name="' + m + '"]', this.signinForm);
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        errorMsg.text(msg);

        return;
      }

      // All good, show spinner.
      this.$('.signin-inner > div').hide();
      this.spin.start();

      // Do the API request.
      rpc.post('/api/members/auth', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          this.spin.stop();
          this.$('.signin-inner > div').show();

          // Set the error display.
          errorMsg.text(err.message);

          // Clear fields.
          $('input[type="text"], input[type="password"]',
              this.signinForm).val('').addClass('input-error');
          this.focus();
          
          return;
        }

        // TODO: Use the router.
        window.location.reload(true);

      }, this));

      return false;
    },

    signup: function (e) {
      e.preventDefault();

      // Sanitize.
      this.$('input[type!="submit"]:visible').each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      // Grab the form data.
      var payload = this.signupForm.serializeObject();

      // Client-side form check.
      var errorMsg = $('.signin-error', this.signupForm);
      var check = util.ensure(payload, ['newusername', 'newemail',
          'newpassword']);
      
      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = $('input[name="' + m + '"]', this.signupForm);
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        errorMsg.text(msg);

        return;
      }
      if (!util.isEmail(payload.newemail)) {

        // Set the error display.
        $('input[name="newemail"]', this.signupForm)
            .val('').addClass('input-error').focus();
        var msg = 'Please use a valid email address.';
        errorMsg.text(msg);

        return;
      }
      if (payload.newusername.length < 4) {

        // Set the error display.
        $('input[name="newusername"]', this.signupForm)
            .val('').addClass('input-error').focus();
        var msg = 'Username must be > 3 characters.';
        errorMsg.text(msg);

        return;
      }
      if (payload.newpassword.length < 7) {

        // Set the error display.
        $('input[name="newpassword"]', this.signupForm)
            .val('').addClass('input-error').focus();
        var msg = 'Password must be > 6 characters.';
        errorMsg.text(msg);

        return;
      }

      // All good, show spinner.
      this.$('.signin-inner > div').hide();
      this.spin.start();

      // Do the API request.
      rpc.post('/api/members', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          this.spin.stop();
          this.$('.signin-inner > div').show();

          // Set the error display.
          errorMsg.text(err.message);

          // Clear fields.
          if (err === 'Username exists')
            $('input[name="newusername"]', this.signupForm)
                .val('').addClass('input-error').focus();
          else {
            $('input[type="text"], input[type="password"]',
                this.signupForm).val('').addClass('input-error');
            this.focus();
          }
          
          return;
        }

        // TODO: Use the router.
        window.location.reload(true);

      }, this));

      return false;
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        $.fancybox.close();
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
