/*
 * App utility functions
 */

define([
  'jQuery',
  'Underscore'
], function ($, _) {

  var dateFormat = function () {
    var  token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
      timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
      timezoneClip = /[^-+\dA-Z]/g,
      pad = function (val, len) {
        val = String(val);
        len = len || 2;
        while (val.length < len) val = "0" + val;
        return val;
      };

    // Regexes and supporting functions are cached through closure
    return function (date, mask, utc) {
      var dF = dateFormat;

      // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
      if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
        mask = date;
        date = undefined;
      }

      // Passing date through Date applies Date.parse, if necessary
      date = date ? new Date(date): new Date();
      if (isNaN(date)) throw SyntaxError("invalid date");

      mask = String(dF.masks[mask] || mask || dF.masks["default"]);

      // Allow setting the utc argument via the mask
      if (mask.slice(0, 4) == "UTC:") {
        mask = mask.slice(4);
      }
      
      var  _ = utc ? "getUTC" : "get",
        d = date[_ + "Date"](),
        D = date[_ + "Day"](),
        m = date[_ + "Month"](),
        y = date[_ + "FullYear"](),
        H = date[_ + "Hours"](),
        M = date[_ + "Minutes"](),
        s = date[_ + "Seconds"](),
        L = date[_ + "Milliseconds"](),
        o = utc ? 0 : date.getTimezoneOffset(),
        flags = {
          d:    d,
          dd:   pad(d),
          ddd:  dF.i18n.dayNames[D],
          dddd: dF.i18n.dayNames[D + 7],
          m:    m + 1,
          mm:   pad(m + 1),
          mmm:  dF.i18n.monthNames[m],
          mmmm: dF.i18n.monthNames[m + 12],
          yy:   String(y).slice(2),
          yyyy: y,
          h:    H % 12 || 12,
          hh:   pad(H % 12 || 12),
          H:    H,
          HH:   pad(H),
          M:    M,
          MM:   pad(M),
          s:    s,
          ss:   pad(s),
          l:    pad(L, 3),
          L:    pad(L > 99 ? Math.round(L / 10) : L),
          t:    H < 12 ? "a"  : "p",
          tt:   H < 12 ? "am" : "pm",
          T:    H < 12 ? "A"  : "P",
          TT:   H < 12 ? "AM" : "PM",
          Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
          o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
          S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
        };

      return mask.replace(token, function ($0) {
        return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
      });
    };
  }();

  // Some common format strings
  dateFormat.masks = {
    "default":      "ddd mmm dd yyyy HH:MM:ss",
    shortDate:      "m/d/yy",
    mediumDate:     "mmm d, yyyy",
    longDate:       "mmmm d, yyyy",
    fullDate:       "dddd, mmmm d, yyyy",
    shortTime:      "h:MM TT",
    mediumTime:     "h:MM:ss TT",
    longTime:       "h:MM:ss TT Z",
    isoDate:        "yyyy-mm-dd",
    isoTime:        "HH:MM:ss",
    isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
    isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
  };

  // Internationalization strings
  dateFormat.i18n = {
    dayNames: [
      "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ],
    monthNames: [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
    ]
  };

  // For convenience...
  Date.prototype.format = function (mask, utc) {
    return dateFormat(this, mask, utc);
  };

  return {

    makeID: function (len) {
      if (!len) len = 5;
      var txt = '';
      var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
          'abcdefghijklmnopqrstuvwxyz0123456789';
      for (var i = 0; i < len; ++i)
        txt += possible.charAt(Math.floor(
              Math.random() * possible.length));
      return txt;
    },

    getRelativeTime: function (ts) {
      if ('number' === typeof ts)
        ts = Math.round(ts);
      var parsedDate = new Date(ts);
      var relativeDate = arguments.length > 1 ? arguments[1] : new Date();
      var delta;
      if ('string' === typeof ts && ts.indexOf('T') === -1)
        delta = (relativeDate.getTime() - (parsedDate.getTime() +
            (this.getTimeZone() * 60 * 60 * 1000))) / 1e3;
      else
        delta = (relativeDate.getTime() - parsedDate.getTime()) / 1e3;
      if (delta < 5) return 'just now';
      else if (delta < 15) return 'just a moment ago';
      else if (delta < 30) return 'just a few moments ago';
      else if (delta < 60) return 'less than a minute ago';
      else if (delta < 120) return 'about a minute ago';
      else if (delta < (45 * 60))
        return (parseInt(delta / 60, 10)).toString() + ' minutes ago';
      else if (delta < (90 * 60))
        return 'about an hour ago';
      else if (delta < (24 * 60 * 60)) {
        var h = (parseInt(delta / 3600, 10)).toString();
        if (h != '1') return 'about ' + h + ' hours ago';
        else return 'about an hour ago';
      }
      else if (delta < (2 * 24 * 60 * 60))
        return 'about a day ago';
      else if (delta < (10 * 24 * 60 * 60))
        return (parseInt(delta / 86400, 10)).toString() + ' days ago';
      else return this.toLocaleString(new Date(ts), 'm/d/yy');
    },

    getRelativeFutureTime: function (ts) {
      result = {};
      if ('number' === typeof ts)
        ts = Math.round(ts);
      var parsedDate = new Date(ts);
      var relativeDate = arguments.length > 1 ? arguments[1] : new Date();
      var delta;
      if ('string' === typeof ts && ts.indexOf('T') === -1)
        delta = (relativeDate.getTime() - (parsedDate.getTime() +
            (this.getTimeZone() * 60 * 60 * 1000))) / 1e3;
      else
        delta = (relativeDate.getTime() - parsedDate.getTime()) / 1e3;
      delta *= -1;
      if (delta > (2 * 24 * 60 * 60)) {
        result.value = (parseInt(delta / 86400, 10) + 1).toString();
        result.label = 'days';
        result.interval = 2 * 60 * 60 * 1e3;
      }
      else if (delta > (2 * 60 * 60)) {
        result.value = (parseInt(delta / 3600, 10) + 1).toString();
        result.label = 'hours';
        result.interval = 2 * 60 * 1e3;
      }
      else if (delta > (2 * 60)) {
        result.value = (parseInt(delta / 60, 10) + 1).toString();
        result.label = "minutes";
        result.interval = 1e3;
      }
      else if (delta > 0) {
        result.value = (parseInt(delta, 10)).toString();
        result.label = "seconds";
        result.interval = 1e3;
      }
      else {
        result.value = 0;
        result.label = "seconds";
        result.interval = -1;
      }
      return result;
    },

    getDuration: function (delta) {
      delta = parseFloat(delta) / 1e6;
      if (delta === 0)
        return 'n / a';
      if (delta < 1)
        return (delta * 1e3).toFixed(1) + ' milliseconds';
      else if (delta < 60)
        return delta.toFixed(1) + ' seconds';
      else if (delta < (45 * 60))
        return (delta / 60).toFixed(1) + ' minutes';
      else if (delta < (24 * 60 * 60))
        return (delta / 3600).toFixed(1) + ' hours';
      else
        return (delta / 86400).toFixed(1) + ' days';
    },

    toLocaleString: function (utcDate, mask) {
      var time = utcDate.getTime();
      var localDate = new Date(time);
      return localDate.format(mask);
    },

    getTimeZone: function () {
      var rightNow = new Date();
      var jan1 = new Date(rightNow.getFullYear(),
                          0, 1, 0, 0, 0, 0);
      var june1 = new Date(rightNow.getFullYear(),
                          6, 1, 0, 0, 0, 0);
      var temp = jan1.toGMTString();
      var jan2 = new Date(temp.substring(0,
                          temp.lastIndexOf(" ")-1));
      temp = june1.toGMTString();
      var june2 = new Date(temp.substring(0,
                          temp.lastIndexOf(" ")-1));
      var std_time_offset = (jan1 - jan2) / (1000 * 60 * 60);
      var daylight_time_offset = (june1 - june2) /
                                (1000 * 60 * 60);
      var dst;
      if (std_time_offset == daylight_time_offset) {
        // daylight savings time is NOT observed
        dst = false;
      } else {
        // positive is southern, negative is northern hemisphere
        var hemisphere = std_time_offset - daylight_time_offset;
        if (hemisphere >= 0)
          std_time_offset = daylight_time_offset;
        // daylight savings time is observed
        dst = true;
      }
      return dst ? std_time_offset + 1 : std_time_offset;
    },

    age: function (str) {
      var day = Number(str.substr(3,2));
      var month = Number(str.substr(0,2)) - 1;
      var year = Number(str.substr(6,4));
      var today = new Date();
      var age = today.getFullYear() - year;
      if (today.getMonth() < month ||
          (today.getMonth() == month && today.getDate() < day))
        age--;
      return age;
    },

    rid32: function () {
      return parseInt(Math.random() * 0x7fffffff, 10);
    },

    blurb: function (str, max) {
      if (typeof str === 'number')
        str = String(str);
      if (!str || str.length < max)
        return str;
      var blurb = '';
      var words = str.split(' ');
      var end = ' ...';
      var i = 0;
      max -= end.length;
      do {
        blurb = blurb.concat(words[i], ' ');
        ++i;
      } while (blurb.concat(words[i]).length - 1 < max);
      return blurb.substr(0, blurb.length - 1) + end;
    },

    formatText: function (str, breaks) {
      var link = /(?!src=")(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
      var parts = _.reject(str.split('\n'), function (s) {
        return s.trim() === '';
      });
      if (parts.length === 0) {
        return '';
      } else {
        parts = _.map(parts, function (p) {
          return p.replace(link, function (txt) {
            return ('<a href="' + txt + '" target="_blank">' + txt + '</a>');
          });
        });
        if (breaks) {
          return parts.join('<br /><br />');
        } else {
          return '<p>' + parts.join('</p><p>') + '</p>';
        }
      }
    },

    addCommas: function (str) {
      str += '';
      x = str.split('.');
      x1 = x[0];
      x2 = x.length > 1 ? '.' + x[1] : '';
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1))
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
      return x1 + x2;
    },

    sanitize: function(str) {
      str = str.replace(/\<script\>/ig, '');
      str = str.replace(/\<\/script\>/ig, '');
      str = $('<p>').html(str).text().trim();
      return str;
    },

    // From underscore string
    titleize: function(str){
      if (str === null) {
        return '';
      }
      str  = String(str).toLowerCase();
      return str.replace(/(?:^|\s|-)\S/g, function(c){ return c.toUpperCase(); });
    },

    getParameterByName: function (name) {
      name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
      var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
      var results = regex.exec(window.location.search);
      return results === null ? "":
          decodeURIComponent(results[1].replace(/\+/g, " "));
    },

    ensure: function (obj, keys) {
      var result = {valid: true, missing: []};
      _.each(keys, function (k) {
        if (!obj[k] || obj[k].trim() === '') {
          result.valid = false;
          result.missing.push(k);
        }
      });
      return result;
    },

    isEmail: function (str) {
      str = str.toLowerCase();
      return (/^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$/).test(str);
    },

    rawify: function (html) {
      if (!html) return '';
      html = html.replace(/"/ig, '');
      return $('<p>').html(html).text().trim();
    },

    https: function (str) {
      if (str.indexOf('http://') !== -1 && str.indexOf('https://') === -1)
        str = 'https://' + str.substr(str.indexOf('http://') + 7);
      return str;
    },

    getVideoLinks: function (str) {
      if (!str) return false;

      var tests = [
        {
          type: 'vimeo',
          rx: /vimeo.com\/(?:channels\/|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/ig,
          id: 3
        },
        {
          type: 'youtube',
          rx: /(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v)\/))([^\?&"'>\s]+)/ig,
          id: 5
        }
      ];
      var results = [];
      _.each(tests, function (test) {
        var match;
        while (match = test.rx.exec(str)) {
          results.push({id: match[test.id], type: test.type});
        }
      });
      
      results = _.uniq(results, function (r) {
        return r.id;
      });

      results = _.map(results, function (r) {
        switch (r.type) {
          case 'vimeo':
            r.link = 'https://player.vimeo.com/video/' + r.id + '?api=1';
            break;
          case 'youtube':
            r.link = '//www.youtube.com/embed/' + r.id;
            break;
        }
        return r;
      });

      return results;
    },

    customSelects: function (ctx) {
      $('select', ctx).each(function() {
        var $this = $(this), numberOfOptions = $(this).children('option').length;

        $this.addClass('select-hidden');
        $this.wrap('<div class="select"></div>');
        $this.after('<div class="select-styled"></div>');

        var $styledSelect = $this.next('div.select-styled');
        $styledSelect.text($this.children('option').eq(0).text());
      
        var $list = $('<ul />', {
          'class': 'select-options',
          'style': $this.attr('style')
        }).insertAfter($styledSelect);

        for (var i = 0; i < numberOfOptions; i++) {
          $('<li />', {
            text: $this.children('option').eq(i).text(),
            rel: $this.children('option').eq(i).val()
          }).appendTo($list);
        }

        var $listItems = $list.children('li');

        $styledSelect.click(function(e) {
          e.stopPropagation();
          if ($styledSelect.hasClass('active')) {
            $styledSelect.removeClass('active');
            $list.hide();
          } else {
            $('div.select-styled.active').each(function(){
              $(this).removeClass('active').next('ul.select-options').hide();
            });
            $(this).toggleClass('active').next('ul.select-options').toggle();
          }
        });

        $listItems.click(function(e) {
          e.stopPropagation();
          $styledSelect.text($(this).text()).removeClass('active');
          $this.val($(this).attr('rel')).trigger('change');
          $list.hide();
        });

        $(document).click(function() {
          $styledSelect.removeClass('active');
          $list.hide();
        });

      });
    },

    numbersOnly: function (el) {
      el.keydown(function (e) {
        // Allow: backspace, delete, tab, escape, enter
        if ($.inArray(e.keyCode, [46,8,9,27,13]) !== -1 ||
          // Allow: Ctrl+A
          (e.keyCode == 65 && e.ctrlKey === true) ||
          // Allow: home, end, left, right
          (e.keyCode >= 35 && e.keyCode <= 39)) {
          // let it happen, don't do anything
          return;
        } else {
          // Ensure that it is a number and stop the keypress
          if (e.shiftKey || (e.keyCode < 48 || e.keyCode > 57) &&
              (e.keyCode < 96 || e.keyCode > 105 )) {
            e.preventDefault();
          }
        }
      });
    },

    toUsername: function(str, b) {
      if (str === null) {
        return '';
      }
      if (!b && b !== '') {
        b = '_';
      }

      var from  = "ąàáäâãåæăćęèéëêìíïîłńòóöôõøśșțùúüûñçżźĄÀÁÄÂÃÅÆĂĆĘÈÉËÊÌÍÏÎŁŃÒÓÖÔÕØŚȘȚÙÚÜÛÑÇŻŹ",
          to    = "aaaaaaaaaceeeeeiiiilnoooooosstuuuunczzAAAAAAAAACEEEEEIIIILNOOOOOOSSTUUUUNCZZ",
          regex = new RegExp('[' + from + ']', 'g');

      str = String(str).replace(regex, function (c) {
        var index = from.indexOf(c);
        return to.charAt(index) || b;
      });

      return str.replace(/[^\w^\.]/g, b).substr(0, 30);
    },

    // pass a function to insert into the DOM
    createImageMosaic: function (images, width, height, insertFunction, cb) {
      if (images.length === 0) {
        cb();
        return;
      }

      var W = width;
      var H = height;
      var P = 2;

      // handle the first item (the main img for this post)
      var data = images.shift();
      var ar = data.meta.width / data.meta.height;
      if (images.length === 0) {
        insertFunction({
          img: {
            width: W,
            height: W / ar,
            top: - (W / ar - H) / 2
          },
          div: {
            width: W,
            height: H,
            left: 0,
            top: 0
          },
          data: data,
          fist: true
        });
        cb();
        return;
      }

      // add the main image
      var img = ar < 1 ? {
        width: H,
        height: H / ar,
        top: - (H / ar - H) / 2
      }: {
        width: H * ar,
        height: H,
        left: - (H * ar - H) / 2
      };

      insertFunction({
        img: img,
        div: {
          width: H,
          height: H,
          left: 0,
          top: 0
        },
        data: data,
        first: true
      });

      var num = images.length;
      var mosaic = num > 3 ? _.groupBy(images, function (data, i) {
        return i < Math.ceil(num / 2) ? 1: 2;
      }): {1: images};
      width = (W - H) / _.size(mosaic);

      _.each(mosaic, function (images, i) {
        var column = {y: 0, items: []};

        // create the columns
        _.each(images, function (data, j) {
          var height = Math.round(width * data.meta.height / data.meta.width);
          column.items.push({
            img: {
              width: width,
              height: height
            },
            div: {
              width: width,
              height: height,
              left: H + (width * (i - 1)) + (i * P),
              top: column.y
            },
            data: data
          });
          column.y += height + P;
        });

        // determine the item heights
        var s = 0;
        var pad = column.items.length * P;
        while (Math.floor(column.y - pad) !== H && s < 1000) {
          ++s;
          _.each(column.items, function (item, i) {
            var delta = H - Math.floor(column.y - pad);
            var dir = Math.abs(delta) / (delta || 1);
            item.div.height += dir;
            for (var j=i+1; j < column.items.length; ++j)
              column.items[j].div.top += dir;
            column.y += dir;
          });
        }

        // expand, shrink, center items
        _.each(column.items, function (item) {
          var ar = item.img.width / item.img.height;
          if (item.img.height < item.div.height) {
            item.img.height = item.div.height;
            item.img.width = ar * item.img.height;
          }
          item.img.top = - (item.img.height - item.div.height) / 2;
          item.img.left = - (item.img.width - item.div.width) / 2;
        });

        // finally, size and show the elements
        _.each(column.items, function (item) {
          insertFunction(item);
        });

      });

      // All done.
      cb();
    }

  };
});
