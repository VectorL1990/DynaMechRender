/**
 * Material may have various textures like color, normal, metalic
 * We use term "channel" to regconize textures' types
 * There also maybe confusion about term "sampler"
 * It actually refers to a "table" which contains all informations
 * including texture itself, but also sampler rules like
 * nearest point, bidirect, monodirect methods and so on
 */


function Material() {
  
}

Material.prototype.fillUniforms = function () {
  var uniforms = {};
  
  uniforms.u_material_color;
  uniforms.u_ambient_color;
  uniforms.u_texture_matrix;
  uniforms.u_specular;
  uniforms.u_reflection;
}

Material.prototype.setTexture = function (channel, texture, sampler_options) {
  if (!channel) {
    throw ("channel must be specified, setTexture falied");
  }

  if (!texture) {
    delete this.textures[channel];
    return;
  }

  var sampler = this.samplers[channel];
  if (!sampler) {
    this.samplers[channel] = sampler = {
      texture: texture,
      uvs: 0,
      wrap: 0,
      minFilter: 0,
      magFilter: 0,
      missing: "white"
    };
  } else {
    sampler.texture = texture;
  }

  if (sampler_options) {
    for (var i in sampler_options) {
      sampler[i] = sampler_options[i];
    }
  }
}
