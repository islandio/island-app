/*
 * Flash Message Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/flash.html',
  'views/build'
], function ($, _, mps, Row, template, Build) {
  return Row.extend({

    tagName: 'li',

    attributes: function () {
      return this.model ? _.defaults({ class: 'block-' + this.model.get('level') },
                                    Row.prototype.attributes.call(this)) : {};
    },

    initialize: function (options) {
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
      this.model.on('remove', _.bind(function () {
        this.$el.remove();
      }, this));
    },

    events: {
      'click .close-cancel-icon': 'destroy',
      'click #to_campaign': 'build'
    },

    render: function (single) {
      Row.prototype.render.call(this, single);
      // _.delay(_.bind(this.destroy, this), 20000);
    },

    destroy: function (e) {
      if (this.model.collection)
        this.model.collection.remove(this.model);
    },

    build: function (e) {
      e.preventDefault();

      // Open the build modal from the header.
      mps.publish('build/open', [true]);
    },

  });
});
