/*
 * Choice Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/choice.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    tagName: 'a',

    attributes: function () {
      return _.defaults({class: 'choice'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    events: {
      'click': 'choose',
    },

    choose: function (e) {
      e.preventDefault();

      console.log(this.model.attributes);
      // this.app.router.navigate(path, {trigger: true});

    }

  });
});
