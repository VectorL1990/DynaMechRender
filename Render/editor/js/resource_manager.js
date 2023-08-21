var ResourceManager = {

  format_parsers = {},

  loadResources: function (resources, options) {

  },

  load: function (url, options, on_complete, on_error) {
    
  },
  

  /**
   * As it's still confused about the way to fetch resources from network or native
   * Let's finish the function processing loaded data first
   */
  processResource: function (data) {
    
  },

  processImage: function (filename, data, options, callback) {
    // we should define path which includes cases native and network
    var path = "";
    
    var image = new Image();
    image.img_filename = filename;
    image.onload = function () {
      var texture = this.processTexture(this.img_filename, this);
    }
    image.src = path;
  },

  processTexture: function (filename, img) {
    // TODO: cubemap requires extra process
    
  },

  registerResource: function (filename, resource) {

  },

  unregisterResource: function (filename) {

  },

  init_parsers: function () {
    var texture_parser = {
      "native": true,
      dataType: "arraybuffer",
    };
    this.add_parser();
  },

  // correspond to addSupportedFormat in webglstudio
  add_parser: function (extension, info) {
    
  },

  parse: function () {
    // get corresponding format parser from format_parsers
    // then trigger corresponding parse function
  },

  parseMESH: function (data, options) {
  },

  parseTexture: function () {
    
  },

  getResource: function (url, constructor) {

  },

  getResourcesData: function (resource_names, allow_files) {
    
  },

  getExtension: function (fullpath, complex_extension) {
    if (!fullpath) {
      return "";
    }
    var question_mark = fullpath.indexOf("?");
    if (question_mark != -1) {
      fullpath = fullpath.substr(0, question_mark);
    }

    var point_mark = complex_extension ? fullpath.indexOf(".") : fullpath.lastIndexOf(".");
    if (point_mark == -1) {
      return "";
    }
    return fullpath.substr(point_mark + 1).toLowerCase().trim();
  },

  getFilename: function (fullpath) {
    if (!fullpath) {
      return "";
    }
    var slash_mark = fullpath.lastIndexOf("/");
    var question_mark = fullpath.lastIndexOf("?");
    var path_length = question_mark ? fullpath.length : (question_mark - 1) - slash_mark;
    return fullpath.substr(slash_mark + 1, path_length);
  },

  getBaseName: function (fullpath) {
    if (!fullpath) {
      return "";
    }

    var name = this.getFilename(fullpath);
    var dot_mark = name.indexOf(".");
    if (dot_mark == -1) {
      return name;
    }
    return name.substr(0, dot_mark);
  },

  createResource: function (filename, data, must_register) {
    
  },
}