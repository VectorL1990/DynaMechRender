Texture.DEFAULT_TYPE = GL.

function Texture(width, height, options, gl) {
  if (!gl) {
    throw ("gl is empty, create texture failed");
  }

  // all variables contained
  this.width = parseInt(width);
  this.height = parseInt(height);
  this.handler = gl.createTexture();
  this.format = options.format || Texture.DEFAULT_TYPE;
  
  if (this.format == gl.DEPTH_COMPONENT &&
    gl.webgl_version == 1 &&
    !gl.extensions["WEBGL_depth_texture"]) {
    throw ("depth texture not supported");
  }

  if (this.type == gl.FLOAT &&
    gl.webgl_version == 1 &&
    !gl.extensions["OES_texture_float"]) {
    throw ("Float texture not supported");
  }

  if (this.type == gl.HALF_FLOAT_OES) {
    if (!gl.extensions["OES_texture_half_float"] &&
      gl.webgl_version == 1) {
      throw ("half float texture extentsion not supported");
    } else if (gl.webgl_version > 1) {
      console.warn("using HALF_FLOAT_OES in WebGL2 is deprecated, suing HALF_FLOAT instead");
			this.type = this.format == gl.RGB ? gl.RGB16F : gl.RGBA16F;
    }
  }

  



  
}

/**
 * 
 * setup variables of texture
 */



Texture.prototype.computeInternalFormat = function () {

}

Texture.prototype.delete = function () {

}

Texture.prototype.getProperties = function () {

}

Texture.prototype.bind = function (unit) {

}

Texture.prototype.unbind = function (unit) {

}

Texture.prototype.setParameter = function (param, value) {

}

Texture.prototype.setUploadOptions = function (options, gl) {
  
}

Texture.prototype.uploadImage = function (img, options) {

}

Texture.prototype.uploadData = function (data, options, skip_mipmaps) {

}

Texture.prototype.drawTo = function (callback, params) {

}

Texture.prototype.copyTo = function (target, shader, uniforms) {

}

Texture.prototype.blit = function (target, shader, uniforms) {

}

Texture.prototype.toViewport = function (shader, uniforms) {
  
}

Texture.fromURL = function (url, options, on_complete, gl) {

}

Texture.createFromImage = function (img, options) {
  var texture = new GL.Texture(img.width, img.height, )
}

Texture.fromMemory = function (w, h, pixels, options) {

}

Texture.fromShader = function (w, h, shader, options) {

}

/**
 * cubemap contains serious functions
 * TODO:
 */
