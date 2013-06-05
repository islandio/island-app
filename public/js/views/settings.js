/*
 * Settings view.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'models/member',
  'text!../../../templates/settings.html'
], function ($, _, Backbone, mps, rpc, util, Member, template) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    el: '#main',

    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;
      
      // Shell events:
      this.on('rendered', this.setup, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Use a model for the main content.
      this.model = new Member(this.app.profile.content.page);

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {},

    // Misc. setup.
    setup: function () {

      // Save refs
      this.form = this.$('#settings_form');
      this.button = this.$('#save_settings');

      this.$('textarea').autogrow();

      // Init form handling:
      util.initForm(this.$('form'));

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

  });
});

/*

// edit profile
var settingsForm = $('#settings-form');
var settingsButton = $('#save-settings');
var settingsButtonMask = $('#save-settings-mask');

var settingsName = $('input[name="member[displayName]"]');
var settingsUsername = $('input[name="member[username]"]');
var settingsEmail = $('input[name="member[primaryEmail]"]');
var settingsBanner = $('img.settings-banner');
var settingsBannerFile = $('input[name="my_banner"]');
var settingsBannerData = $('input[name="member[assembly]"]');
var settingsBannerLeft = $('input[name="member[bannerLeft]"]');
var settingsBannerTop = $('input[name="member[bannerTop]"]');
var settingsDescription = $('input[name="member[description]"]');
var settingsLocation = $('input[name="member[location]"]');
var settingsHometown = $('input[name="member[hometown]"]');
var settingsBirthday = $('input[name="member[birthday]"]');
var settingsGender = $('input[name="member[gender]"]');
var settingsWebsite = $('input[name="member[website]"]');
var settingsTwitter = $('input[name="member[twitter]"]');

var settingsNameLabel = $('label[for="member[displayName]"]');
var settingsUsernameLabel = $('label[for="member[username]"]');
var settingsEmailLabel = $('label[for="member[primaryEmail]"]');
var settingsBannerLabel = $('label[for="my_banner"]');
var settingsDescriptionLabel = $('label[for="member[description]"]');
var settingsLocationLabel = $('label[for="member[location]"]');
var settingsHometownLabel = $('label[for="member[hometown]"]');
var settingsBirthdayLabel = $('label[for="member[birthday]"]');
var settingsGenderLabel = $('label[for="member[gender]"]');
var settingsWebsiteLabel = $('label[for="member[website]"]');
var settingsTwitterLabel = $('label[for="member[twitter]"]');

var settingsUploading = false;

function exitSettingsButton() {
  settingsButtonMask.show();
  settingsButton.removeClass('is-button-alert');
  resetSettingsStyles();
}
function resetSettingsStyles() {
  settingsNameLabel.css('color', 'gray');
  settingsUsernameLabel.css('color', 'gray');
  settingsEmailLabel.css('color', 'gray');
  settingsBirthdayLabel.css('color', 'gray');
}

settingsButtonMask.each(function (i) {
  var w = settingsButton.outerWidth();
  var h = settingsButton.outerHeight();
  settingsButtonMask.css({ width: w, height: h });
});

settingsButtonMask.bind('mouseenter', function () {
  var name = settingsName.val().trim();
  var username = settingsUsername.val().trim();
  var email = settingsEmail.val().trim();
  if (name !== '' && username !== ''
      && email !== '' && !settingsUploading) {
    settingsButtonMask.css('bottom', 10000).hide();
    resetSettingsStyles();
  } else {
    settingsButton.addClass('is-button-alert');
    if (name === '') 
      settingsNameLabel.css('color', colors.orange);
    if (username === '')
      settingsUsernameLabel.css('color', colors.orange);
    if (email === '') 
      settingsEmailLabel.css('color', colors.orange);
  }
}).bind('mouseleave', exitSettingsButton);

settingsButton.bind('mouseleave', function () {
  settingsButtonMask.css('bottom', 0);
  exitSettingsButton();
});

settingsButton.bind('click', function (e) {
  e.preventDefault();
  if (settingsUploading) return;
  var data = settingsForm.serializeObject();
  delete data.params;
  data['member[config][notifications][comment][email]'] =
    data['member[config][notifications][comment][email]'] ? true : false;
  $.put('/save/settings', data, function (res) {
    if ('success' === res.status)
      return ui.notify('Edits saved.')
               .closable().hide(8000).effect('fade').fit();
    if ('error' === res.status && res.data.inUse) {
      switch (res.data.inUse) {
        case 'primaryEmail':
          ui.error('Email address is already in use.')
            .closable().hide(8000).effect('fade').fit();
          settingsEmail.focus();
          settingsEmailLabel.css('color', colors.orange);
          break;
        case 'username':
          ui.error('Username is already in use.')
            .closable().hide(8000).effect('fade').fit();
          settingsUsername.focus();
          settingsUsernameLabel.css('color', colors.orange);
          break;
      }
    } else if ('error' === res.status && res.data.invalid) {
      switch (res.data.invalid) {
        case 'birthday':
          ui.error('Birthday not a valid date.')
            .closable().hide(8000).effect('fade').fit();
          settingsBirthday.val('').focus();
          settingsBirthdayLabel.css('color', colors.orange);
          break;
      }
    }
  });
  return false;
});

settingsForm.transloadit({
  wait: true,
  autoSubmit: false,
  modal: false,
  processZeroFiles: false,
  onSuccess: function (assembly) {
    uploadSpin.stop();
    settingsBanner.show();
    if (assembly.ok !== 'ASSEMBLY_COMPLETED')
      return ui.error('Upload failed. Please try again.')
        .closable().hide(8000).effect('fade').fit();
    if ($.isEmpty(assembly.results) && settingsUploading)
      return ui.error('You must choose a file.')
        .closable().hide(8000).effect('fade').fit();
    if (settingsUploading) {
      var banner = assembly.results.image_thumb[0];
      var _w = 232, _h = 104;
      var w, h, o;
      w = _w;
      h = (banner.meta.height / banner.meta.width) * _w;
      if (h - _h >= 0) {
        o = 'top:' + (-(h - _h) / 2) + 'px;';
      } else {
        w = (banner.meta.width / banner.meta.height) * _h;
        h = _h;
        o = 'left:' + (-(w - _w) / 2) + 'px;';
      }
      settingsBanner.attr({
        src: banner.url,
        width: w,
        height: h,
        style: o,
      });
      settingsBannerData.val(JSON.stringify(assembly));
      settingsUploading = false;
      return;
    }
  },
});

settingsBannerFile.bind('change', function () {
  settingsUploading = true;
  settingsBanner.hide();
  uploadSpin.start();
  settingsForm.submit();
});

settingsBanner.bind('mousedown', function (e) {
  e.preventDefault();
  var w = { x: settingsBanner.width(),
            y: settingsBanner.height() };
  var m = { x: e.pageX, y: e.pageY };
  var p = { x: parseInt(settingsBanner.css('left')),
            y: parseInt(settingsBanner.css('top'))};
  var move = function (e) {
    var d = { x: e.pageX - m.x,
              y: e.pageY - m.y };
    var top = d.y + p.y;
    var left = d.x + p.x;
    if (top <= 0 && w.y + top >= 104) {
      settingsBannerTop.val(top);
      settingsBanner.css({ top: top + 'px' });
    }
    if (left <= 0 && w.x + left >= 232) {
      settingsBannerLeft.val(left);
      settingsBanner.css({ left: left + 'px' });
    }
  };
  settingsBanner.bind('mousemove', move);
  settingsBanner.bind('mouseup', function (e) {
    settingsBanner.unbind('mousemove', move);
    settingsBanner.unbind('mouseup', arguments.callee);
  });
});

*/
