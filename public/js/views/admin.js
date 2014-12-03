 /*
 * Admin panel
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/admin.html'
], function ($, _, Backbone, mps, rest, util, Spin, template) {

  return Backbone.View.extend({

    el: '.main',
    uploading: false,

    initialize: function (app) {
      this.app = app;
      this.on('rendered', this.setup, this);
    },

    render: function () {

      this.app.title('The Island | ' + this.app.profile.member.displayName
          + ' - Admin');
      this.template = _.template(template);
      this.$el.html(this.template.call(this, {util: util} ));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .signup-table button': 'invite',
      'click .signup-new': 'inviteEmail'
    },

    setup: function () {
      this.emailInput = $('.admin input[type="email"]');
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

    inviteEmail: function () {
      this.emailInput.removeClass('input-error');
      var payload = {email: this.emailInput.val().trim()};
      if (util.isEmail(payload.email)) {
        rest.put('/api/signups', payload, _.bind(function (err, res) {
          this.emailInput.val('');
        }, this));
      } else {
        this.emailInput.val('').addClass('input-error')
            .attr('placeholder', 'Invalid email')
            .focus();
      }
    },

    invite: function (e) {
      var col = $(e.target).index();
      var $tr = $(e.target).closest('tr');
      var row = $tr.index();

      var payload = {email: this.app.profile.content.signups[row].email};
      rest.put('/api/signups', payload, function (err, res) {
        if (!err) $(e.target).replaceWith('Invited');
      });
    }

  });
});
