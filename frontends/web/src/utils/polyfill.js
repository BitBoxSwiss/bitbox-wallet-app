if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
        return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
}

if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(search, length) {
        if (length === undefined || length > this.length) {
            length = this.length;
        }
        return this.substring(length - search.length, length) === search;
    };
}
