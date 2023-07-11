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

Shader.getUniformFunc = function (data) {

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

Shader.prototype.extractShaderInfo = function () {

}

Shader.prototype.bind = function () {

}

Shader.prototype.getLocation = function (name) {

}

Shader.prototype.uniforms = function (uniforms) {

}

Shader.prototype.uniformArray = function (array) {

}

Shader.prototype.setUniform = function () {

}

Shader.prototype.draw = function (mesh, mode, index_buffer_name) {

}

Shader.prototype.drawRange = function (mesh, 
  mode, 
  start, 
  length, 
  index_buffer_name) {

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
