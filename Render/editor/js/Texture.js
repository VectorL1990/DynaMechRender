Texture.DEFAULT_TYPE = GL.UNSIGNED_BYTE;
Texture.DEFAULT_FORMAT = GL.RGBA;
Texture.DEFAULT_MAG_FILTER = GL.LINEAR;
Texture.DEFAULT_MIN_FILTER = GL.LINEAR;
Texture.DEFAULT_WRAP_S = GL.CLAMP_TO_EDGE;
Texture.DEFAULT_WRAP_T = GL.CLAMP_TO_EDGE;
Texture.EXTENSION = "png";

function Texture(width, height, options, gl) {
  if (!gl) {
    throw ("gl is empty, create texture failed");
  }

  // init all variables contained
  this.width = parseInt(width);
  this.height = parseInt(height);
  // which means the handler points to this texture
  this.handler = gl.createTexture();
  // which could be CUBE_MAP, TEXTURE_2D
  this.texture_type = options.texture_type || gl.TEXTURE_2D;
  // which could be DEPTH_COMPONENT, RGBA
  this.format = options.format || Texture.DEFAULT_TYPE;
  // which is equal to internalFormat in webglstudio
  // it could be RGBA32F, RGBA16F, HALF_FLOAT_OES, HALF_FLOAT, DEPTH_COMPONENT16 and so on
  this.detail_format = options.detail_format;
  this.has_mipmaps = false;

  // setup static variable in this place
  // gl restricts max texture slots to bind
  if (!Texture.MAX_TEXTURE_IMAGE_UNITS) {
    Texture.MAX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  }
  
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

  if ((!isPowerOfTwo(this.width) || !isPowerOfTwo(this.height)) &&
      ((this.minFilter != gl.NEAREST && this.minFilter != gl.LINEAR) ||
      this.wrapS != gl.CLAMP_TO_EDGE || 
      this.wrapT != gl.CLAMP_TO_EDGE)) {
    if (!options.ignore_pot) {
      // which means it requires to match requirements that
      // texture size should be power of 2
      // pot = power-of-two
      throw ("texture size must be pot");
    } else {
      this.minFilter = this.magFilter = gl.LINEAR;
      this.wrapS = this.wrapT = gl.CLAMP_TO_EDGE;
    }
  }

  if (!width || !height) {
    throw("texture width or height must not be null");
  }

  if (!this.detail_format) {
    this.computeInternalFormat();
  }

  // in case we bind texture to wrong slot
  gl.activeTexture(gl.TEXTURE0 + Texture.MAX_TEXTURE_IMAGE_UNITS - 1);
  gl.bindTexture(this.texture_type, this.handler);
  gl.texParameter(this.texture_type, gl.TEXTURE_MAG_FILTER, this.magFilter);
  gl.texParameter(this.texture_type, gl.TEXTURE_MIN_FILTER, this.minFilter);
  gl.texParameter(this.texture_type, gl.TEXTURE_WRAP_S, this.wrapS);
  gl.texParameter(this.texture_type, gl.TEXTURE_WRAP_T, this.wrapT);

  if (options.anisotropic && gl.extensions["EXT_texture_filter_anisotropic"]) {
    gl.texParameter(GL.TEXTURE_2D, gl.extensions["EXT_texture_filter_anisotropic"].TEXTURE_MAX_ANISOTROPY_EXT, options.anisotropic);
  }
  
  function toTypedArray(data) {

  }
}

/**
 * 
 * setup variables of texture
 */



Texture.prototype.computeInternalFormat = function (args) {
  if (this.format == GL.DEPTH_COMPONENT) {
    this.minFilter = GL.NEAREST;
    if (args.gl.webgl_version == 2) {
      if (this.type == GL.UNSIGNED_SHORT) {
        this.detail_format = GL.DEPTH_COMPONENT16;
      } else if (this.type == GL.UNSIGNED_INT) {
        this.detail_format = GL.DEPTH_COMPONENT24;
      } else if (this.type == GL.FLOAT) {
        this.detail_format = GL.DEPTH_COMPONENT32F;
      } else {
        throw ("unsupported type for a depth texture");
      }
    } else if (gl.webgl_version == 1) {
      if (this.type == GL.FLOAT) {
        throw("webgl 1.0 doesn't support float depth textures");
      }
      this.detail_format = GL.DEPTH_COMPONENT;
    }
  } else if (this.format == gl.RGBA) {
    if (gl.webgl_version == 2) {
      if (this.type == GL.FLOAT) {
        this.detail_format = GL.RGBA32F;
      } else if (this.type == GL.HALF_FLOAT) {
        this.detail_format = GL.RGBA16F;
      } else if (this.type == GL.HALF_FLOAT_OES) {
        console.warn("webgl 2 doesn't use HALF_FLOAT_OES, please use HALF_FLOAT");
        this.type = GL.HALF_FLOAT;
        this.detail_format = GL.RGBA16F;
      }
    } else if (gl.webgl_version == 1) {
      if (this.type == GL.HALF_FLOAT) {
        console.warn("webgl 1 doesn't support HALF_FLOAT, use HALF_FLOAT_OES");
        this.type = GL.HALF_FLOAT_OES;
      }
    }
  }
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

Texture.setUploadOptions = function (options, gl) {
  if (options) {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, )
  }
}

/**
 * cubemap contains serious functions
 * TODO:
 */
