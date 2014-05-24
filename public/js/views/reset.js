/*
 * Reset password view.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'text!../../templates/reset.html'
], function ($, _, Backbone, mps, rest, util, template) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | Password Reset');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .reset-submit': 'reset',
      'click .forgot-password': 'forgot',
    },

    setup: function () {

      // Save refs.
      this.oldPassword = this.$('input[name="oldpassword"]');
      this.newPassword = this.$('input[name="newpassword"]');
      this.cnewPassword = this.$('input[name="cnewpassword"]');

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Remove the old password field if token exists.
      this.token = util.getParameterByName('t');
      if (this.token) {
        this.oldPassword.closest('tr').remove();
        this.$('label[for="oldpassword"]').closest('tr').remove();
      }

      // Focus cursor initial.
      _.delay(_.bind(function () { this.focus(); }, this), 1);

      return this;
    },

    focus: function (e) {
      _.find(this.$('input[type!="submit"]'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) $(i).focus();
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

    reset: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = this.$('form').serializeObject();

      // Client-side form check.
      var fields = ['newpassword', 'cnewpassword'];
      if (!this.token) fields.push('oldpassword');
      var check = util.ensure(payload, fields);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('input[name="' + m + '"]');
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        mps.publish('flash/new', [{err: {message: 'All fields are required.'},
            level: 'error', sticky: true}, true]);

        return false;
      }

      // Add token.
      if (this.token) {
        payload.token = this.token;
      }

      // Now do the update.
      rest.post('/api/members/reset', payload, _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          mps.publish('flash/new', [{err: err, level: 'error', sticky: true}, true]);

          // Clear fields.
          this.$('input[type="password"]').val('').addClass('input-error');
          this.focus();

          return;
        }

        // Clear fields.
        this.$('input[type="password"]').val('');
        this.focus();

        // Inform user.
        mps.publish('flash/new', [{
          message: 'Your password has been reset.',
          level: 'alert',
        }, true]);

        this.app.router.navigate('/', true);
      }, this));

      return false;
    },

    forgot: function (e) {
      e.preventDefault();
      mps.publish('modal/forgot/open');
    },

  });
});
