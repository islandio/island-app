/*
 * Notification Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/notification.html'
], function ($, _, Row, mps, rest, template) {
  return Row.extend({

    attributes: function () {
      var klass = 'notification';
      if (!this.model.get('read'))
        klass += ' unread';
      if (this.model.get('event').data.action.t === 'request')
        klass += ' request';
      return _.defaults({class: klass}, Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'hover': 'read',
      'click': 'navigate',
      'click .info-delete': 'delete',
      'click .info-accept': 'accept',
    },

    read: function (e) {
      e.preventDefault();
      if (!this.$el.hasClass('unread')) return;
      rest.put('/api/notifications/read/' + this.model.id, {});
      this.update();
    },

    update: function () {
      this.$el.removeClass('unread');
      this.model.set('read', true);
    },

    delete: function (e) {
      e.preventDefault();
      rest.delete('/api/notifications/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    accept: function (e) {
      e.preventDefault();
      rest.put('/api/members/' + this.model.get('subscription_id') + '/accept',
          {}, _.bind(function (err, data) {
        if (err) return console.log(err);
        rest.delete('/api/notifications/' + this.model.id, {});
      }, this));
      this.parentView._remove({id: this.model.id});
    },

    navigate: function (e) {
      e.preventDefault();
      if ($(e.target).hasClass('info-delete')
          || $(e.target).hasClass('info-accept')) return;
      var type = this.model.get('event').data.action.t;
      var path = type === 'request' || type === 'accept' || type === 'follow' ?
          this.model.get('event').data.action.s:
          this.model.get('event').data.target.s;
      if (path) mps.publish('navigate', [path]);
      return false;
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
