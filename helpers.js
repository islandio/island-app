exports.helpers = {
  appName: 'Island-IO',
  version: '0.1',

  nameAndVersion: function (name, version) {
    return name + ' v' + version;
  }
};

function FlashMessage(type, messages) {
  this.type = type;
  this.messages = typeof messages === 'string' ? [messages] : messages;
}

FlashMessage.prototype = {
  // get icon() {
  //   switch (this.type) {
  //     case 'info':
  //       return 'is-info';
  //     case 'error':
  //       return 'is-alert';
  //   }
  // },

  get stateClass() {
    switch (this.type) {
      case 'info':
        return 'is-highlight';
      case 'error':
        return 'is-error';
    }
  },

  toHTML: function() {
    return '<div class="flash">' +
           '<div class="' + this.stateClass + '">' +
           '<p>' + this.messages.join(', ') + '</p>' +
           '</div>' +
           '</div>';
  }
};

exports.dynamicHelpers = {
  flashMessages: function (req, res) {
    var html = '';
    ['error', 'info'].forEach(function (type) {
      var messages = req.flash(type);
      if (messages.length > 0) {
        html += new FlashMessage(type, messages).toHTML();
      }
    });
    return html;
  }
};
