
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

exports.isEmpty = isEmpty;