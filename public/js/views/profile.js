/*
 * Profile config view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'models/person',
  'config',
  'balanced'
], function ($, _, Backbone, mps, util, Person, config, balanced) {
  return Backbone.View.extend({
    
    initialize: function (options) {
      this.options = options || {};
      balanced.init(config.getMarketplace());
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.setElement($('.profile'));
      this.trigger('rendered');
      return this;
    },

    events: {
      'click .save-button': 'save',
      'click #add_card': 'toggleCardCapture',
      'click #add_account': 'toggleAccountCapture',
      'click .change-card': 'toggleCardCapture',
      'click .change-account': 'toggleAccountCapture'
    },

    setup: function () {
      var balanced = config.getBalanced();
      var buyer = balanced ? {
        card_uri: balanced.card_uri,
        card_meta: balanced.card_meta,
        bank_account_uri: balanced.bank_account_uri,
        bank_account_meta: balanced.bank_account_meta
      } : {};
      this.$('#cc_data_capture').hide();
      this.$('#cc_data_capture input').attr('disabled', true);
      if (buyer.card_uri) {
        this.$('#card_on_file span')
            .html('<strong>'
                  + buyer.card_meta.brand
                  + ' ************'
                  + buyer.card_meta.last_four + '</strong>.');
        this.$('#add_card').hide();
        this.$('#card_on_file').show();
      }
      this.$('#ba_data_capture').hide();
      this.$('#ba_data_capture input').attr('disabled', true);
      if (buyer.bank_account_uri) {
        this.$('#ba_on_file span')
            .html('<strong>'
                  + buyer.bank_account_meta.bank_name
                  + '</strong> ending in <strong>'
                  + buyer.bank_account_meta.last_four + '</strong>.');
        this.$('#add_account').hide();
        this.$('#ba_on_file').show();
      }
      this.$('.modal-inner').show();
      util.initForm(this.$('form'));
    },

    toggleCardCapture: function (e) {
      e.preventDefault();
      var add = this.$('#add_card');
      var current = this.$('#card_on_file')
      var capture = this.$('#cc_data_capture') 
      if (current.is(':visible') || add.is(':visible')) {
        current.hide();
        add.hide();
        $('input', capture).attr('disabled', false);
        capture.show();
        this.$('[name="card_number"]').focus();
      } else {
        if (config.getBalanced().card_uri)
          current.show();
        else add.show();
        capture.hide();
        $('input', capture).attr('disabled', true);
      }
      return false;
    },

    toggleAccountCapture: function (e) {
      var add = this.$('#add_account');
      var current = this.$('#ba_on_file')
      var capture = this.$('#ba_data_capture') 
      if (current.is(':visible') || add.is(':visible')) {
        current.hide();
        add.hide();
        $('input', capture).attr('disabled', false);
        capture.show();
        $('[name="ba_name"]').focus();
      } else {
        if (config.getBalanced().bank_account_uri)
          current.show();
        else add.show();
        capture.hide();
        $('input', capture).attr('disabled', true);
      }
      return false;
    },

    save: function (e) {
      e.preventDefault();
      var self = this;
      var form = this.$('form');
      var button = this.$('.save-button');
      if (!util.validate(form))
        return false;
      var formData = util.cleanObject(form.serializeObject());
      if (_.isEmpty(formData)) return false; 
      button.attr('disabled', true).addClass('disabled');
      $('span', button).text('Saving ...');
      $('i', button).hide();
      $('input:visible, textarea:visible', form).attr('disabled', true);
      var cardData, accountData;
      var after = 0;
      var props = {};
      if (formData.card_number) {
        cardData = {
          card_number: formData.card_number,
          expiration_month: formData.expiration_month,
          expiration_year: formData.expiration_year,
          security_code: formData.security_code
        };
        after ++;
      }
      if (formData.account_number) {
        accountData = {
          name: formData.ba_name,
          account_number: formData.account_number,
          bank_code: formData.bank_code
        };
        after ++;
      }

      function balancedCb(type, res) {
        if (res.status !== 201) {
          var errors = res.error.extras || res.error;
          console.log(res.error)
          _.each(errors, function (msg) {
            if (msg.substr(-1) !== '.') msg += '.';
            var flash = { message: msg, level: 'error' };
            mps.publish('flash/new', [flash]);
          });
          button.attr('disabled', false).removeClass('disabled');
          $('span', button).text('Save');
          $('i', button).show();
          $('input:visible, textarea:visible', form).attr('disabled', false);
        } else {
          switch (type) {
            case 'card':
              props.card_uri = res.data.uri;
              props.card_meta = {
                brand: res.data.brand,
                last_four: res.data.last_four
              };
              break;
            case 'account':
              props.bank_account_uri = res.data.uri;
              props.bank_account_meta = {
                bank_name: res.data.bank_name,
                last_four: res.data.last_four
              };
              break;
          }
          _finish(props);
        }
      }

      function finish() {
        var merchant_data = {};
        $('input.merchant:visible', form).each(function () {
          merchant_data[$(this).attr('name')] = $(this).val().trim();
        });
        if (!_.isEmpty(merchant_data))
          props.merchant_data = merchant_data;
        config.getPerson().save({ props: props }, {
          success: function (data, model) {
            util.clear(form);
            button.attr('disabled', false).removeClass('disabled');
            $('span', button).text('Save');
            $('i', button).show();
            config.setPerson(model);
            self.setup();
          }
        });
      }
      
      var _finish = _.after(after, finish);
      if (cardData)
        balanced.card.create(cardData, _.bind(balancedCb, this, 'card'));
      if (accountData)
        balanced.bankAccount.create(accountData, _.bind(balancedCb, this, 'account'));
    },

  });
});
