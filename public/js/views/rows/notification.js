/*
 * Notification Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'rpc',
  'mps',
  'text!../../../templates/rows/notification.html'
], function ($, _, Row, rpc, mps, template) {
  return Row.extend({

    attributes: function () {
      var cls = this.model.get('read') ? 'notification': 'notification unread'; 
      return _.defaults({ class: cls },
                        Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      this.updater = mps.subscribe('notification/update',
          _.bind(this.updateAsRead, this, null));
      this.remover = mps.subscribe('notification/remove',
          _.bind(this._remove, this, null));
      Row.prototype.initialize.call(this, options);
    },

    events: {
      // 'hover': 'markAsRead',
      // 'click': 'navigate',
      // 'click .notification-delete': 'delete',
    },

    markAsRead: function (e) {
      e.preventDefault();
      if (!this.$el.hasClass('unread')) return;
      if ($(e.target).hasClass('icon-cancel')) return;
      mps.unsubscribe(this.updater);
      rpc.execute('/service/notify.mark_read', { id: this.model.id });
      this.updateAsRead.call(this, e);
    },

    updateAsRead: function (e, topic, data) {
      if (!this.model) return;
      if (e || this.model.id === data.id) {
        this.$el.removeClass('unread');
        mps.publish('notification/change', []);
      }
    },

    delete: function (e) {
      e.preventDefault();
      mps.unsubscribe(this.updater);
      mps.unsubscribe(this.remover);
      rpc.execute('/service/notify.delete', { id: this.model.id });
      this._remove.call(this, e);
    },

    navigate: function (e) {

      // Route to the idea/campaign:
      var path = this.model.get('shell_id');
      mps.publish('navigate', [path]);

      return false;
    },

  });
});
