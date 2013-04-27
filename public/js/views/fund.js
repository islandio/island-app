/*
 * Fund view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'views/checkout',
], function ($, _, Backbone, mps, Checkout) {
  return Backbone.View.extend({
    
    selector: 'div.wrap',
    
    initialize: function () {
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.setElement($(this.selector));
      this.checkout = new Checkout({}).render();
      this.trigger('rendered');
      return this;
    },

    events: {
      //
    },

    setup: function () {
      return this;
    }

  });
});
