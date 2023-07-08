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
  
  var pixel_data = options.pixel_data;
  if (!pixel_data && !pixel_data.buffer) {
    if (this.texture_type == GL.TEXTURE_CUBE_MAP) {
      if (pixel_data[0].constructor === Number) {
        pixel_data = toTypedArray(pixel_data);
        pixel_data = [pixel_data, pixel_data, pixel_data, pixel_data, pixel_data, pixel_data];
      } else {
        for (var i = 0; i < pixel_data.length; ++i) {
          pixel_data[i] = toTypedArray(pixel_data[i]);
        }
      }
    } else {
      pixel_data = toTypedArray(pixel_data);
    }
    this.data = pixel_data;
  }
  
  function toTypedArray(data) {
    if (data.constructor !== Array) {
      return data;
    } else if (this.type == GL.FLOAT) {
      return new Float32Array(data);
    } else if (this.type == GL.HALF_FLOAT_OES) {
      return new Uint16Array(data);
    } else {
      return new Uint8Array(data);
    }
  }

  Texture.setUploadOptions(options);

  if (this.texture_type == GL.TEXTURE_2D) {
    gl.texImage2D(GL.TEXTURE_2D,
      0,
      this.detail_format,
      width,
      height,
      0,
      this.format,
      this.type,
    )
  } else if (this.texture_type == GL.TEXTURE_CUBE_MAP) {
    // if format is rgba, 4 bytes required, otherwise 3 bytes is
    // enough for rgb
    var facesize = width * width * (this.format == GL.RGBA ? 4 : 3);
    for (var i = 0; i < 6; ++i) {
      var cubemap_data = pixel_data;
      if (cubemap_data) {
        if (cubemap_data.constructor === Array) {
          cubemap_data = cubemap_data[i];
        } else {
          cubemap_data.subarray(facesize * i, facesize * (i + 1));
        }
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
          0,
          this.detail_format,
          this.width,
          this.height,
          0,
          this.format,
          this.type,
          cubemap_data || null);
      }
    }
  } else if (this.texture_type == GL.TEXTURE_3D) {
    if (this.gl.webgl_version == 1) {
      throw ("TEXTURE_3D not supported in webgl 1");
    }
    if (!options.depth) {
      throw ("3d texture depth can not be null");
    }
    // 3d texture doesn't support this attribute, premul alpha must be false
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage3D(GL.TEXTURE_3D,
      0,
      this.detail_format,
      this.width,
      this.height,
      options.depth,
      0,
      this.format,
      this.type,
      pixel_data || null);
  }
  gl.bindTexture(this.texture_type, null);
  gl.activeTexture(gl.TEXTURE0);
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
  gl.deleteTexture(this.handler);
  this.handler = null;
}

Texture.prototype.getProperties = function () {
  return {
    width: this.width,
    height: this.height,
    type: this.type,
    format: this.format,
    texture_type: this.texture_type,
    magFilter: this.magFilter,
    minFilter: this.minFilter,
    wrapS: this.wrapS,
    wrapT: this.wrapT
  };
}

Texture.prototype.bind = function (unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(this.texture_type, this.handler);
}

Texture.prototype.unbind = function (unit) {
  if (unit === undefined) {
    unit = 0;
  }
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(this.texture_type, null);
}

Texture.prototype.setParameter = function (param, value) {
  this.bind(0);
  this.gl.texParameteri(this.texture_type, param, value);
  switch (param) {
    case this.gl.TEXTURE_MAG_FILTER:
      this.magFilter = value;
      break;
    case this.gl.TEXTURE_MIN_FILTER:
      this.minFilter = value;
      break;
    case this.gl.TEXTURE_WRAP_S:
      this.wrapS = value;
      break;
    case this.gl.TEXTURE_WRAP_T:
      this.wrapT = value;
      break;
  }
}

Texture.prototype.setUploadOptions = function (options, gl) {
  
}

Texture.prototype.uploadImage = function (img, options) {
  this.bind();
  if (!img) {
    throw ("upload image must not be null");
  }

  Texture.setUploadOptions(options, gl);
  try {
    this.gl.texImage2D(gl.TEXTURE_2D,
      0,
      this.width,
      this.height,
      this.type,
      img
    );
  } catch (e) {
    throw (e);
  }

  if (this.minFilter &&
    this.minFilter != this.gl.NEAREST &&
    this.minFilter != this.gl.LINEAR) {
    this.gl.generateMipmap(this.texture_type);
    this.has_mipmaps = true;
  }

  this.gl.bindTexture(this.texture_type, null);
}

Texture.prototype.uploadData = function (data, options, skip_mipmaps) {
  if (!data) {
    throw ("texture data can not be null");
  }
  this.bind();
  Texture.setUploadOptions(options, gl);
  var mipmap_level = options.mipmap_level || 0;
  // move width bytes toward right
  // which divides texture size by 2^n
  var width = this.width >> mipmap_level;
  var height = this.height >> mipmap_level;

  if (this.texture_type == GL.TEXTURE_2D) {
    if (gl.webgl_version == 1) {
      if (data.buffer && data.buffer.constructor == ArrayBuffer) {
        gl.texImage2D(this.texture_type,
          mipmap_level,
          this.detail_format,
          this.width,
          this.height,
          0,
          this.format,
          this.type,
          data);
      } else {
        gl.texImage2D(this.texture_type,
          mipmap_level,
          this.detail_format,
          this.format,
          this.type,
          data);
      }
    } else if (gl.webgl_version == 2) {
      gl.texImage2D(this.texture_type,
        mipmap_level,
        this.detail_format,
        this.width,
        this.height,
        0,
        this.format,
        this.type,
        data
      );
    }
  } else if (this.texture_type == GL.TEXTURE_3D) {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage3D(this.texture_type,
      mipmap_level,
      this.detail_format,
      this.width,
      this.height,
      this.depth >> mipmap_level,
      0,
      this.format,
      this.type,
      data);
  } else if (this.texture_type == GL.TEXTURE_CUBE_MAP) {
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + (options.cubemap_face || 0),
      mipmap_level,
      this.detail_format,
      this.width,
      this.height,
      0,
      this.format,
      this.type,
      data);
  } else {
    throw ("unsupported upload data type");
  }

  this.data = data;
  
  if (!this.skip_mipmaps && 
    this.minFilter &&
    this.minFilter != gl.NEAREST &&
    this.minFilter != gl.LINEAR) {
    gl.generateMipmap(this.texture_type);
    this.has_mipmaps = true;
  }
  gl.bindTexture(this.texture_type, null);
}

Texture.prototype.drawTo = function (callback, params) {
  var viewport = gl.getViewport();
  var old_fbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  var fbo = gl.cur_fbo = gl.cur_fbo || gl.createFramebuffer();
  var rbo = null;
  if (Texture.use_renderbuffer_pool) {
    if (!gl.rbo_pool) {
      gl.rbo_pool = {};
    }

    // we can improve effictioncy by reusing same size unutilized rbo
    for (var i = 0; i < gl.rbo_pool.length; ++i) {
      // tell whether this texture is free
      if (!rbo_pool[i][0]) {
        continue;
      }
      // tell whether this texture's size is desireable
      var size_str = this.width.toString() + "/" + this.height.toString();
      if (rbo_pool[i][1] != size_str) {
        continue;
      }
      
      // which means we find a rbo available rbo for rendering
      rbo = gl.rbo_pool[i];
      gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
      gl.rbo_pool[i][0] = false;

      break;
    }
  } else {
    rbo = gl.createRenderBuffer();
    rbo.width = this.width;
    rbo.height = this.height;
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
  }

  if (this.format == gl.DEPTH_COMPONENT) {
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, this.width, this.height);
  } else {
    
  }
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
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!(options.premutiply_alpha));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !options.no_flip);
  } else {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
}

/**
 * cubemap contains serious functions
 * TODO:
 */
