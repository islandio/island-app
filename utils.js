
/**
 * Determines if an object is empty of enumerable properties
 * @param object
 */
function isEmpty(obj) {
	for(var prop in obj) {
		if(obj.hasOwnProperty(prop))
			return false;
	}
	return true;
}



/**
 * Determines if an object is empty of enumerable properties
 * @param object
 */

function randStr(l) {
    var s = ''
      , rc = function () {
        var n = Math.floor(Math.random() * 62);
        if (n < 10) return n; //1-10
        if (n < 36) return String.fromCharCode(n + 55); //A-Z
        return String.fromCharCode(n + 61); //a-z
    }
    while (s.length < l) s += rc();
    return s;
}

exports.randStr = randStr;
exports.isEmpty = isEmpty;