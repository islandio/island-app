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
  
  get icon() {
    switch (this.type) {
      case 'info':
        return '&nbsp;<span style="color: #d12b83; font-size: 12px">&hearts;</span>&nbsp;';
      case 'thanks':
        return '&nbsp;<span style="color: #d12b83; font-size: 12px">&#10004;</span>&nbsp;';
      case 'error':
        return '&nbsp;<span style="color: #d04c38; font-size: 12px">&#10008;</span>&nbsp;';
    }
  },
  
  get stateClass() {
    switch (this.type) {
      case 'info':
      case 'thanks':
        return 'is-highlight';
      case 'error':
        return 'is-error';
    }
  },

  toHTML: function() {
    return '<div class="flash">' +
           '<div class="' + this.stateClass + '">' +
           '<p>' + this.icon + ' ' + this.messages.join(', ') + '</p>' +
           '</div>' +
           '</div>';
  }
};

exports.dynamicHelpers = {
  flashMessages: function (req, res) {
    var html = '';
    ['info', 'thanks', 'error'].forEach(function (type) {
      var messages = req.flash(type);
      if (messages.length > 0)
        html += new FlashMessage(type, messages).toHTML();
    });
    return html;
  }
};
