(function(a){a.tweet=function(b){function d(a){var b=Date.parse(a),c=arguments.length>1?arguments[1]:new Date,d=parseInt((c.getTime()-b)/1e3);return d<5?"just now":d<15?"just a moment ago":d<30?"just a few moments ago":d<60?"less than a minute ago":d<120?"about a minute ago":d<2700?parseInt(d/60).toString()+" minutes ago":d<5400?"about an hour ago":d<86400?"about "+parseInt(d/3600).toString()+" hours ago":d<172800?"about a day ago":parseInt(d/86400).toString()+" days ago"}var c={username:null,count:10,auto_join_text_default:"<br />said,",auto_join_text_ed:"<br />",auto_join_text_ing:"<br />was",auto_join_text_reply:"<br />replied to",auto_join_text_url:"<br />was looking at",query:null,tweets:new Array,callback:function(){}};b&&a.extend(c,b),a.fn.extend({linkUrl:function(){var b=[],c=/((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi;return this.each(function(){b.push(this.replace(c,"<a target='_blank' href=\"$1\">$1</a>"))}),a(b)},linkUser:function(){var b=[],c=/[\@]+([A-Za-z0-9-_]+)/gi;return this.each(function(){b.push(this.replace(c,"<a target='_blank' href=\"http://twitter.com/#!/$1\">@$1</a>"))}),a(b)},linkHash:function(){var b=[],c=/ [\#]+([A-Za-z0-9-_]+)/gi;return this.each(function(){b.push(this.replace(c,' <a target="_blank" href="http://twitter.com/#!/search?q=%23$1">#$1</a>'))}),a(b)},capAwesome:function(){var b=[];return this.each(function(){b.push(this.replace(/(a|A)wesome/gi,"AWESOME"))}),a(b)},capEpic:function(){var b=[];return this.each(function(){b.push(this.replace(/(e|E)pic/gi,"EPIC"))}),a(b)},makeHeart:function(){var b=[];return this.each(function(){b.push(this.replace(/(&lt;)+[3]/gi,"<tt class='heart'>&#x2665;</tt>"))}),a(b)}}),typeof c.username=="string"&&(c.username=[c.username]);var e="";c.query&&(e+="q="+c.query),e+="&q=from:"+c.username.join("%20OR%20from:");var f="http://search.twitter.com/search.json?&"+e+"&rpp="+c.count+"&callback=?";a.getJSON(f,function(b){a.each(b.results,function(b,e){if(e.text.match(/^(@([A-Za-z0-9-_]+)) .*/i))var f=c.auto_join_text_reply;else if(e.text.match(/(^\w+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&\?\/.=]+) .*/i))var f=c.auto_join_text_url;else if(e.text.match(/^((\w+ed)|just) .*/im))var f=c.auto_join_text_ed;else if(e.text.match(/^(\w*ing) .*/i))var f=c.auto_join_text_ing;else var f=c.auto_join_text_default;var g='<a target="_blank" href="http://twitter.com/#!/'+e.from_user+"/status/"+e.id_str+'" title="view tweet on twitter">'+c.username+" ("+d(e.created_at)+")</a>",h='<span class="tweet_join"> '+f+" </span>",i='<span class="tweet_text">'+a([e.text]).linkUrl().linkUser().linkHash().makeHeart().capAwesome().capEpic()[0]+"</span>";c.tweets.push("<p>"+g+h+i+"</p>")}),c.callback(c.tweets)})}})(jQuery);