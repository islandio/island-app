/*
 * Comment Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'rpc',
  'views/boiler/row',
  'text!../../../templates/rows/comment.html'
], function ($, _, mps, rpc, Row, template) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'comment'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click a.navigate': 'navigate',
      'click .info-delete': 'delete',
    },

    delete: function (e) {
      e.preventDefault();
      rpc.delete('/api/comments/' + this.model.id, {});
      this.parentView._remove({id: this.model.id});
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
