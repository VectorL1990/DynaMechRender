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

  createResource: function (filename, data, must_register) {
    
  },
}