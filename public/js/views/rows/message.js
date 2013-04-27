/*
 * Message Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'text!../../../templates/rows/message.html',
  'config'
], function ($, _, Views, template, config) {
  return Row.extend({

    attributes: function () {
      var classes = 'shell-chat-message';
      var person = config.getPerson();
      if (person && person.get('username') === this.model.get('person_key').username)
        classes += ' me';
      return _.defaults({ class: classes },
                        Row.prototype.attributes.call(this));
    },

    initialize: function (options) {
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    }

  });
});
