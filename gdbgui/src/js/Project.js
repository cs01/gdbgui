
const project = {

    name : null,
    home : null,
    
    setHome: function (absolutePath) {
        absolutePath = this.sanitizePath(absolutePath);
        if (absolutePath === "") absolutePath = "/";
        this.home = absolutePath;
        if (this.name === null) {
            var parts = absolutePath.split("/");
            var lastPart = parts[parts.length-1];
            this.setName(this.capitalizeFirstLetter(lastPart));
        }
    },
    setName: function (name) {
        this.name = name;
    },
    
    capitalizeFirstLetter: function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    /** remove
            multiple slash from path
            trailing slash
            convert backslash to slash
    */
    sanitizePath: function (path) {
        // .replace(/^(\/|.+)\/+$/, "")
        path = path.replace(/\\/g, "/");
        path = path.replace(/([^:]\/)\/+/g, "$1");
        path = path.replace(/^(\/|.+)\/+$/, "$1");
        return path;
	}

}

module.exports = {
    project: project
}

