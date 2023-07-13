function Shader(vertSrc, fragSrc, macros) {
  if (!vertSrc || !fragSrc) {
    throw ("vs and fs must not be null, create shader failed");
  }

  this.gl = global.gl;

  var extra_code = Shader.expandMacros(macros);
  var final_vertSrc = Shader.injectCode(extra_code, vertSrc, gl);
  var final_fragSrc = Shader.injectCode(extra_code, fragSrc, gl);

  this.program = gl.createProgram();
  var vs = Shader.compileSource(gl.VERTEX_SHADER, final_vertSrc);
  var fs = Shader.compileSource(gl.FRAGMENT_SHADER, final_fragSrc);

  this.gl.attachShader(this.program, vs, gl);
  this.gl.attachShader(this.program, fs, gl);
  this.gl.linkProgram(this.program);
  if (!this.gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
    throw 'link error: ' + this.gl.getProgramInfoLog(this.program);
  }

  this.vs = vs;
  this.fs = fs;




}

// === variables ===


// === shaders ===



// === Static methods ===

Shader.expandMacros = function (macros) {

}

Shader.injectCode = function (inject_code, code, gl) {
  
}

Shader.compileSource = function (type, src, gl, shader) {

}

Shader.getUploadUniformMethod = function (data) {
  var method = null;
  switch (data.type) {
    case GL.FLOAT:
      if (data.size == 1) {
        method = gl.uniform1f;
      } else {
        method = gl.uniform1fv;
      }
      break;
    case GL.FLOAT_MAT2:
      method = gl.uniformMatrix2fv;
      break;
    case GL.FLOAT_MAT3:
      method = gl.uniformMatrix3fv;
      break;
    case GL.FLOAT_MAT4:
      method = gl.uniformMatrix4fv;
      break;
    case GL.FLOAT_VEC2:
      method = gl.uniform2fv;
      break;
    case GL.FLOAT_VEC3:
      method = gl.uniform3fv;
      break;
    case GL.FLOAT_VEC4:
      method = gl.uniform4fv;
      break;
    case GL.UNSIGNED_INT:
    case GL.INT:
      if (data.size == 1) {
        method = gl.uniform1i;
      } else {
        method = gl.uniform1iv;
      }
      break;
    case GL.INT_VEC2:
      method = gl.uniform2iv;
      break;
    case GL.INT_VEC3:
      method = gl.uniform3iv;
      break;
    case GL.INT_VEC4:
      method = gl.uniform4iv;
      break;
    case GL.SAMPLER_2D:
		case GL.SAMPLER_3D:
		case GL.SAMPLER_CUBE:
		case GL.INT_SAMPLER_2D:
		case GL.INT_SAMPLER_3D:
		case GL.INT_SAMPLER_CUBE:
		case GL.UNSIGNED_INT_SAMPLER_2D:
		case GL.UNSIGNED_INT_SAMPLER_3D:
		case GL.UNSIGNED_INT_SAMPLER_CUBE:
      method = gl.uniform1i;
      break;
    default:
      method = gl.uniform1f;
      break;
  }
  return method;
}

Shader.fromURL = function (vs_path, fs_path) {

}

Shader.replaceCodeUsingContext = function (code_template, replace_content_collection) {

}

Shader.getScreenShader = function (gl) {

}

Shader.getFlatScreenShader = function (gl) {

}

Shader.getQuadShader = function (gl) {

}

Shader.getBlendShader = function (gl) {

}

Shader.getCopyDepthShader = function (gl) {

}

Shader.getCubemapShowShader = function (gl) {

}

// === prototype methods ===

Shader.prototype.updateShader = function (vertSrc, fragSrc, macros) {

}

Shader.prototype.setUniformNoBinding = function (name, value) {
  var info = this.uniformInfo[name];
  if (!info) {
    return;
  }

  if (info.loc === null) {
    // which means it's an attribute or nothing
    return;
  }

  if (value == null) {
    return;
  }

  if (info.is_matrix) {
    info.method.call(this.gl, info.loc, false, value);
  } else {
    info.method.call(this.gl, info.loc, value);
  }
}

Shader.prototype.setUniform = function (name, value) {
  if (this.gl.current_shader != this) {
    this.bind();
  }
  var info = this.uniformInfo[name];
  if (!info) {
    return;
  }

  if (info.loc === null) {
    // which means it's an attribute or nothing
    return;
  }

  if (value == null) {
    return;
  }

  if (info.is_matrix) {
    info.method.call(this.gl, info.loc, false, value);
  } else {
    info.method.call(this.gl, info.loc, value);
  }
}

Shader.prototype.extractShaderInfo = function () {
  var uniformNb = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);

  for (var i=0; i<uniformNb; ++i) {
    var uniform = gl.getActiveUniform(this.program, i);
    if (!uniform) {
      break;
    }

    var uniformName = uniform.name;
    if (uniformName.indexOf("[") != -1 && uniformName.indexOf("].")) {
      // which means name of this uniform is some kind of array which contains []
      var pos = uniformName.indexOf("[");
      uniformName = uniformName.substr(0, pos);
    }

    if (uniform.type == GL.SAMPLER_2D ||
      uniform.type == GL.SAMPLER_CUBE ||
      uniform.type == GL.SAMPLER_3D ||
      uniform.type == GL.INT_SAMPLER_2D ||
      uniform.type == GL.INT_SAMPLER_CUBE ||
      uniform.type == GL.INT_SAMPLER_3D ||
      uniform.type == GL.UNSIGNED_INT_SAMPLER_2D ||
      uniform.type == GL.UNSIGNED_INT_SAMPLER_CUBE ||
      uniform.type == GL.UNSIGNED_INT_SAMPLER_3D) {
      this.samplers[uniformName] = data.type;
    }
    var method = Shader.getUploadUniformMethod(data);
    var is_matrix = false;
    if (data.type == this.gl.FLOAT_MAT2 ||
      data.type == this.gl.FLOAT_MAT3 ||
      data.type == this.gl.FLOAT_MAT4) {
      is_matrix = true;
    }
    var type_length = GL.TYPE_LENGTH[data.type] || 1;
    this.uniformInfo[uniformName] = {
      type: data.type,
      method: method,
      size: data.size,
      type_length: type_length,
      is_matrix: is_matrix,
      loc: this.gl.getUniformLocation(this.program, uniformName),
      data: new Float32Array(type_length*data.size)
    };
  }

  var dataNb = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
  for (var i=0; i<dataNb; ++i) {
    var data = gl.getActiveAttrib(this.program, i);
    if (!data) {
      break;
    }
    var method = Shader.getUploadUniformMethod(data);
    var type_length = GL.TYPE_LENGTH[data.type] || 1;
    this.uniformInfo[data.name] = {
      type: data.type,
      method: method,
      type_length: type_length,
      size: data.size,
      loc: null
    };
    this.attributes[data.name] = gl.getAttribLocation(this.program, data.name);
  }
}

Shader.prototype.bind = function () {
  this.gl.useProgram(this.program);
  this.gl.current_shader = this;
}

Shader.prototype.uniforms = function (uniformNames) {
  this.gl.useProgram(this.program);
  this.current_shader = this;

  for (var name in uniformNames) {
    var info = this.uniformInfo[name];
    if (!info) {
      continue;
    }
    this.setUniform(name, uniforms[name]);
  }

  return this;
}

Shader.prototype.uniformArray = function (array) {
  this.gl.useProgram(this.program);
  this.gl.current_shader = this;
  
  for (var i=0; i<array.length; ++i) {
    var uniforms = array[i];
    for (var uniformName in uniforms) {
      this.setUniform(uniformName, uniforms[uniformName]);
    }
  }

  return this;
}

Shader.prototype.draw = function (mesh, mode, index_buffer_name) {

}

Shader.prototype.drawRange = function (mesh, 
  mode, 
  start, 
  length, 
  index_buffer_name) {
  if (index_buffer_name === undefined) {
    if (mode == this.gl.LINES) {
      index_buffer_name = 'lines';
    } else {
      index_buffer_name = 'triangles';
    }
  }
  this.drawBuffers(mesh.vertexBuffers,
    mesh.indexBuffers[index_buffer_name],
    mode);
}

/**
 * 
 * @param {*} vertexBuffers 
 * @param {*} indexBuffer 
 * @param {*} mode 
 * @param {*} range_start 
 * @param {*} range_length 
 */
Shader.prototype.drawBuffers = function(vertexBuffers, 
  indexBuffer,
  mode,
  range_start,
  range_length) {
  this.gl.useProgram(this.program);
  
}

Shader.prototype.drawInstanced = function (mesh, 
  primitive,
  indices,
  instanced_uniforms,
  range_start,
  range_length,
  num_instances) {

}

Shader.prototype.toViewport = function (uniforms) {

}
