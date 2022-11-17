/** FXStack
* Helps apply a stack of FXs to a texture with as fewer render calls as possible with low memory footprint
* Used by CameraFX and FrameFX but also available for any other use
* You can add new FX to the FX pool if you want.
* @class FXStack
*/
function FXStack( o )
{
	this.apply_fxaa = false;
	this.filter = true;
	this.fx = [];

	this._uniforms = { u_aspect: 1, u_viewport: vec2.create(), u_iviewport: vec2.create(), u_texture: 0, u_depth_texture: 1, u_random: vec2.create() };

	this._passes = null;
	this._must_update_passes = true;

	if(o)
		this.configure(o);
}

FXStack.available_fx = {
	"brightness_contrast": {
		name: "Brightness & Contrast",
		uniforms: {
			brightness: { name: "u_brightness", type: "float", value: 1, step: 0.01 },
			contrast: { name: "u_contrast", type: "float", value: 1, step: 0.01 }
		},
		code:"color.xyz = (color.xyz * u_brightness@ - vec3(0.5)) * u_contrast@ + vec3(0.5);"
	},
	"hue_saturation": {
		name: "Hue & Saturation",
		functions: ["HSV"],
		uniforms: {
			hue: { name: "u_hue", type: "float", value: 0, step: 0.01 },
			saturation: { name: "u_saturation", type: "float", value: 1, step: 0.01 },
			brightness: { name: "u_brightness", type: "float", value: 0, step: 0.01 }
		},
		code:"color.xyz = rgb2hsv(color.xyz); color.xz += vec2(u_hue@,u_brightness@); color.y *= u_saturation@; color.xyz = hsv2rgb(color.xyz);"
	},
	"invert": {
		name: "Invert color",
		code:"color.xyz = vec3(1.0) - color.xyz;"
	},
	"threshold": {
		name: "Threshold",
		uniforms: {
			threshold: { name: "u_threshold", type: "float", value: 0.5, min: 0, max: 2, step: 0.01 },
			threshold_width: { name: "u_threshold_width", type: "float", value: 0.01, min: 0, max: 1, step: 0.001 }
		},
		code:"color.xyz = vec3( smoothstep( u_threshold@ - u_threshold_width@ * 0.5, u_threshold@ + u_threshold_width@ * 0.5,  length(color.xyz) ));"
	},
	"colorize": {
		name: "Colorize",
		uniforms: {
			colorize: { name: "u_colorize", type: "color3", value: [1,1,1] },
			vibrance: { name: "u_vibrance", type: "float", value: 0.0, min: 0, max: 2, step: 0.01 }
		},
		code:"color.xyz = color.xyz * (u_colorize@ + vec3(u_vibrance@ * 0.1)) * (1.0 + u_vibrance@);"
	},
	"color_add": {
		name: "Color add",
		uniforms: {
			color_add: { name: "u_coloradd", type: "color3", value: [0.1,0.1,0.1] }
		},
		code:"color.xyz = color.xyz + u_coloradd@;"
	},
	"fog":{
		name:"fog",
		uniforms: {
			fog_color: { name: "u_fog_color", type: "color3", value: [0.1,0.1,0.1] },
			fog_start: { name: "u_fog_start", type: "float", value: 10 },
			fog_density: { name: "u_fog_density", type: "float", precision: 0.00001, value: 0.001, step: 0.00001 }
		},
		code:"float z_n@ = 2.0 * texture2D( u_depth_texture, v_coord).x - 1.0;" +
			"float cam_dist@ = 2.0 * u_depth_range.x * u_depth_range.y / (u_depth_range.y + u_depth_range.x - z_n@ * (u_depth_range.y - u_depth_range.x));" +
			"float fog_factor@ = 1. - 1.0 / exp(max(0.0,cam_dist@ - u_fog_start@) * u_fog_density@);" +
			"color.xyz = mix( color.xyz, u_fog_color@, fog_factor@ );"
	},
	"vigneting": {
		name: "Vigneting",
		uniforms: {
			radius: { name: "u_radius", type: "float", value: 1 },
			intensity: { name: "u_vigneting", type: "float", value: 1, min: 0, max: 2, step: 0.01 }
		},
		code:"color.xyz = mix( color.xyz * max( 1.0 - (dist_to_center * u_radius@ / 0.7071), 0.0), color.xyz, u_vigneting@);"
	},
	"aberration": {
		name: "Chromatic Aberration",
		break_pass: true,
		uniforms: {
			difraction: { name: "u_difraction", type: "float", value: 1 }
		},
		code: "color.x = texture2D(u_texture, uv - to_center * 0.001 * u_difraction@ ).x;" + 
			"color.z = texture2D(u_texture, uv + to_center * 0.001 * u_difraction@ ).z;"
	},
	"halftone": {
		name: "Halftone",
		uniforms: {
			"Halftone angle": { name: "u_halftone_angle", type: "float", value: 0, step: 0.01 },
			"Halftone size": { name: "u_halftone_size", type: "float", value: 1, step: 0.01 }
		},
		functions: ["pattern"],
		code:"color.x = ( (color.x * 10.0 - 5.0) + pattern( u_halftone_angle@, u_halftone_size@ ) );" + 
			"color.y = ( (color.y * 10.0 - 5.0) + pattern( u_halftone_angle@ + 0.167, u_halftone_size@ ) );" + 
			"color.z = ( (color.z * 10.0 - 5.0) + pattern( u_halftone_angle@ + 0.333, u_halftone_size@ ) );"
	},
	"halftoneBN": {
		name: "Halftone B/N",
		uniforms: {
			"Halftone angle": { name: "u_halftone_angle", type: "float", value: 0, step: 0.01 },
			"Halftone size": { name: "u_halftone_size", type: "float", value: 1, step: 0.01 }
		},
		functions: ["pattern"],
		code:"color.xyz = vec3( (length(color.xyz) * 10.0 - 5.0) + pattern( u_halftone_angle@, u_halftone_size@ ) );"
	},
	"lens": {
		name: "Lens Distortion",
		break_pass: true,
		uniforms: {
			lens_k: { name: "u_lens_k", type: "float", value: -0.15 },
			lens_kcube: { name: "u_lens_kcube", type: "float", value: 0.8 },
			lens_scale: { name: "u_lens_scale", type: "float", value: 1 }
		},
		uv_code:"float r2 = u_aspect * u_aspect * (uv.x-0.5) * (uv.x-0.5) + (uv.y-0.5) * (uv.y-0.5); float distort@ = 1. + r2 * (u_lens_k@ + u_lens_kcube@ * sqrt(r2)); uv = vec2( u_lens_scale@ * distort@ * (uv.x-0.5) + 0.5, u_lens_scale@  * distort@ * (uv.y-0.5) + 0.5 );"
	},
	"image": {
		name: "Image",
		uniforms: {
			image_texture: { name: "u_image_texture", type: "sampler2D", widget: "Texture", value: "" },
			image_alpha: { name: "u_image_alpha", type: "float", value: 1, step: 0.001 },
			image_scale: { name: "u_image_scale", type: "vec2", value: [1,1], step: 0.001 }
		},
		code:"vec4 image@ = texture2D( u_image_texture@, (uv - vec2(0.5)) * u_image_scale@ + vec2(0.5)); color.xyz = mix(color.xyz, image@.xyz, image@.a * u_image_alpha@ );"
	},
	"warp": {
		name: "Warp",
		break_pass: true,
		uniforms: {
			warp_amp: { name: "u_warp_amp", type: "float", value: 0.01, step: 0.001 },
			warp_offset: { name: "u_warp_offset", type: "vec2", value: [0,0], step: 0.001 },
			warp_scale: { name: "u_warp_scale", type: "vec2", value: [1,1], step: 0.001 },
			warp_texture: { name: "u_warp_texture", type: "sampler2D", widget: "Texture", value: "" }
		},
		uv_code:"uv = uv + u_warp_amp@ * (texture2D( u_warp_texture@, uv * u_warp_scale@ + u_warp_offset@ ).xy - vec2(0.5));"
	},
	"LUT": {
		name: "LUT",
		functions: ["LUT"],
		uniforms: {
			lut_intensity: { name: "u_lut_intensity", type: "float", value: 1, step: 0.01 },
			lut_texture: { name: "u_lut_texture", type: "sampler2D", filter: "nearest", wrap: "clamp", widget: "Texture", value: "" }
		},
		code:"color.xyz = mix(color.xyz, LUT( color.xyz, u_lut_texture@ ), u_lut_intensity@);"
	},
	"pixelate": {
		name: "Pixelate",
		uniforms: {
			width: { name: "u_width", type: "float", value: 256, step: 1, min: 1 },
			height: { name: "u_height", type: "float", value: 256, step: 1, min: 1 }
		},
		uv_code:"uv = vec2( floor(uv.x * u_width@) / u_width@, floor(uv.y * u_height@) / u_height@ );"
	},
	"quantize": {
		name: "Quantize",
		functions: ["dither"],
		uniforms: {
			levels: { name: "u_levels", type: "float", value: 8, step: 1, min: 1 },
			dither: { name: "u_dither", type: "float", value: 0.1, max: 1 }
		},
		code:"\n\
		if( u_dither@ > 0.0 )\n\
		{\n\
			vec3 qcolor@ = floor(color.xyz * u_levels@) / u_levels@;\n\
			vec3 diff@ = (color.xyz - qcolor@) * u_levels@ * u_dither@;\n\
			color.xyz = qcolor@ + vec3(dither(diff@.x),dither(diff@.y),dither(diff@.z)) / u_levels@;\n\
		}\n\
		else\n\
			color.xyz = floor(color.xyz * u_levels@) / u_levels@;\n"
	},
	"edges": {
		name: "Edges",
		break_pass: true,
		uniforms: {
			"Edges factor": { name: "u_edges_factor", type: "float", value: 1 }
		},
		code:"vec4 color@ = texture2D(u_texture, uv );\n\
				vec4 color_up@ = texture2D(u_texture, uv + vec2(0., u_iviewport.y));\n\
				vec4 color_right@ = texture2D(u_texture, uv + vec2(u_iviewport.x,0.));\n\
				vec4 color_down@ = texture2D(u_texture, uv + vec2(0., -u_iviewport.y));\n\
				vec4 color_left@ = texture2D(u_texture, uv + vec2(-u_iviewport.x,0.));\n\
				color = u_edges_factor@ * (abs(color@ - color_up@) + abs(color@ - color_down@) + abs(color@ - color_left@) + abs(color@ - color_right@));"
	},
	"depth": {
		name: "Depth",
		uniforms: {
			"near": { name: "u_near", type: "float", value: 0.01, step: 0.1 },
			"far": { name: "u_far", type: "float", value: 1000, step: 1 }
		},
		code:"color.xyz = vec3( (2.0 * u_near@) / (u_far@ + u_near@ - texture2D( u_depth_texture, uv ).x * (u_far@ - u_near@)) );"
	},
	"logarithmic": {
		name: "Logarithmic",
		uniforms: {
			"Log. A Factor": { name: "u_logfactor_a", type: "float", value: 2, step: 0.01 },
			"Log. B Factor": { name: "u_logfactor_b", type: "float", value: 2, step: 0.01 }
		},
		code:"color.xyz = log( color.xyz * u_logfactor_a@ ) * u_logfactor_b@;"
	},
	"ditherBN": {
		name: "dither B/N",
		functions: ["dither"],
		code:"color.xyz = vec3( dither( color.x ) );"
	},
	"dither": {
		name: "Dither",
		functions: ["dither"],
		code:"color.xyz = vec3( dither( color.x ), dither( color.y ), dither( color.z ) );"
	},
	"gamma": {
		name: "Gamma",
		uniforms: {
			"Gamma": { name: "u_gamma", type: "float", value: 2.2, step: 0.01 }
		},
		code:"color.xyz = pow( color.xyz, vec3( 1.0 / u_gamma@) );"
	},
	"noiseBN": {
		name: "Noise B&N",
		functions: ["noise"],
		uniforms: {
			"noise": { name: "u_noise", type: "float", value: 0.1, step: 0.01 }
		},
		code:"color.xyz += u_noise@ * vec3( noise( (u_random + v_coord) * u_viewport) );"
	}
	/*
	"blur": {
			name: "Blur",
			break_pass: true,
			uniforms: {
				"blur_intensity": { name: "u_blur_intensity", type: "float", value: 0.1, step: 0.01 }
			},
			local_callback: FXStack.applyBlur
		}
	}
	*/
	//median: https://github.com/patriciogonzalezvivo/flatLand/blob/master/bin/data/median.frag
};

//functions that could be used
FXStack.available_functions = {
	pattern: "float pattern(float angle, float size) {\n\
				float s = sin(angle * 3.1415), c = cos(angle * 3.1415);\n\
				vec2 tex = v_coord * u_viewport.xy;\n\
				vec2 point = vec2( c * tex.x - s * tex.y , s * tex.x + c * tex.y ) * size;\n\
				return (sin(point.x) * sin(point.y)) * 4.0;\n\
			}\n\
		",
	dither: "float dither(float v) {\n\
				vec2 pixel = v_coord * u_viewport;\n\
				int i = int(floor(clamp(v,0.0,1.0) * 16.0 + 0.5));\n\
				if(i < 1)\n\
					return 0.0;\n\
				if(i >= 15)\n\
					return 1.0;\n\
				float x = floor(pixel.x);\n\
				float y = floor(pixel.y);\n\
				bool xmod4 = mod(x, 4.0) == 0.0;\n\
				bool ymod4 = mod(y, 4.0) == 0.0;\n\
				bool xmod2 = mod(x, 2.0) == 0.0;\n\
				bool ymod2 = mod(y, 2.0) == 0.0;\n\
				bool xmod4_2 = mod(x + 2.0, 4.0) == 0.0;\n\
				bool ymod4_2 = mod(y + 2.0, 4.0) == 0.0;\n\
				bool xmod2_1 = mod(x + 1.0, 2.0) == 0.0;\n\
				bool ymod2_1 = mod(y + 1.0, 2.0) == 0.0;\n\
				bool xmod4_1 = mod(x + 1.0, 4.0) == 0.0;\n\
				bool ymod4_1 = mod(y + 1.0, 4.0) == 0.0;\n\
				bool xmod4_3 = mod(x + 3.0, 4.0) == 0.0;\n\
				bool ymod4_3 = mod(y + 3.0, 4.0) == 0.0;\n\
				\n\
				if(i < 9)\n\
				{\n\
					if(i >= 1 && xmod4 && ymod4 )\n\
						return 1.0;\n\
					if(i >= 2 && xmod4_2 && ymod4_2)\n\
						return 1.0;\n\
					if(i >= 3 && xmod4_2 && ymod2 )\n\
						return 1.0;\n\
					if(i >= 4 && xmod2 && ymod2 )\n\
						return 1.0;\n\
					if(i >= 5 && xmod4_1 && ymod4_1 )\n\
						return 1.0;\n\
					if(i >= 6 && xmod4_3 && ymod4_3 )\n\
						return 1.0;\n\
					if(i >= 7 && xmod4_1 && ymod4_3 )\n\
						return 1.0;\n\
					if(i >= 8 && xmod4_3 && ymod4_1 )\n\
						return 1.0;\n\
					return 0.0;\n\
				}\n\
				else\n\
				{\n\
					if(i < 15 && xmod4_1 && ymod4 )\n\
						return 0.0;\n\
					if(i < 14 && xmod4_3 && ymod4_2)\n\
						return 0.0;\n\
					if(i < 13 && xmod4_3 && ymod2 )\n\
						return 0.0;\n\
					if(i < 12 && xmod2_1 && ymod2 )\n\
						return 0.0;\n\
					if(i < 11 && xmod4_2 && ymod4_1 )\n\
						return 0.0;\n\
					if(i < 10 && xmod4 && ymod4_3 )\n\
						return 0.0;\n\
					return 1.0;\n\
				}\n\
			}\n\
		",
	//ugly but effective: https://github.com/hughsk/glsl-dither/blob/master/8x8.glsl
	dither8x8: "\n\
		float dither8x8(vec2 position, float brightness) {\n\
		  int x = int(mod(position.x, 8.0));\n\
		  int y = int(mod(position.y, 8.0));\n\
		  int index = x + y * 8;\n\
		  float limit = 0.0;\n\
		  if (x < 8) {\n\
			if (index == 0) limit = 0.015625;\n\
			else if (index == 1) limit = 0.515625;\n\
			else if (index == 2) limit = 0.140625;\n\
			else if (index == 3) limit = 0.640625;\n\
			else if (index == 4) limit = 0.046875;\n\
			else if (index == 5) limit = 0.546875;\n\
			else if (index == 6) limit = 0.171875;\n\
			else if (index == 7) limit = 0.671875;\n\
			else if (index == 8) limit = 0.765625;\n\
			else if (index == 9) limit = 0.265625;\n\
			else if (index == 10) limit = 0.890625;\n\
			else if (index == 11) limit = 0.390625;\n\
			else if (index == 12) limit = 0.796875;\n\
			else if (index == 13) limit = 0.296875;\n\
			else if (index == 14) limit = 0.921875;\n\
			else if (index == 15) limit = 0.421875;\n\
			else if (index == 16) limit = 0.203125;\n\
			else if (index == 17) limit = 0.703125;\n\
			else if (index == 18) limit = 0.078125;\n\
			else if (index == 19) limit = 0.578125;\n\
			else if (index == 20) limit = 0.234375;\n\
			else if (index == 21) limit = 0.734375;\n\
			else if (index == 22) limit = 0.109375;\n\
			else if (index == 23) limit = 0.609375;\n\
			else if (index == 24) limit = 0.953125;\n\
			else if (index == 25) limit = 0.453125;\n\
			else if (index == 26) limit = 0.828125;\n\
			else if (index == 27) limit = 0.328125;\n\
			else if (index == 28) limit = 0.984375;\n\
			else if (index == 29) limit = 0.484375;\n\
			else if (index == 30) limit = 0.859375;\n\
			else if (index == 31) limit = 0.359375;\n\
			else if (index == 32) limit = 0.0625;\n\
			else if (index == 33) limit = 0.5625;\n\
			else if (index == 34) limit = 0.1875;\n\
			else if (index == 35) limit = 0.6875;\n\
			else if (index == 36) limit = 0.03125;\n\
			else if (index == 37) limit = 0.53125;\n\
			else if (index == 38) limit = 0.15625;\n\
			else if (index == 39) limit = 0.65625;\n\
			else if (index == 40) limit = 0.8125;\n\
			else if (index == 41) limit = 0.3125;\n\
			else if (index == 42) limit = 0.9375;\n\
			else if (index == 43) limit = 0.4375;\n\
			else if (index == 44) limit = 0.78125;\n\
			else if (index == 45) limit = 0.28125;\n\
			else if (index == 46) limit = 0.90625;\n\
			else if (index == 47) limit = 0.40625;\n\
			else if (index == 48) limit = 0.25;\n\
			else if (index == 49) limit = 0.75;\n\
			else if (index == 50) limit = 0.125;\n\
			else if (index == 51) limit = 0.625;\n\
			else if (index == 52) limit = 0.21875;\n\
			else if (index == 53) limit = 0.71875;\n\
			else if (index == 54) limit = 0.09375;\n\
			else if (index == 55) limit = 0.59375;\n\
			else if (index == 56) limit = 1.0;\n\
			else if (index == 57) limit = 0.5;\n\
			else if (index == 58) limit = 0.875;\n\
			else if (index == 59) limit = 0.375;\n\
			else if (index == 60) limit = 0.96875;\n\
			else if (index == 61) limit = 0.46875;\n\
			else if (index == 62) limit = 0.84375;\n\
			else if (index == 63) limit = 0.34375;\n\
		  }\n\
		  return brightness < limit ? 0.0 : 1.0;\n\
		}\n",

	LUT:  "vec3 LUT(in vec3 color, in sampler2D textureB) {\n\
		 lowp vec3 textureColor = clamp( color, vec3(0.0), vec3(1.0) );\n\
		 mediump float blueColor = textureColor.b * 63.0;\n\
		 mediump vec2 quad1;\n\
		 quad1.y = floor(floor(blueColor) / 8.0);\n\
		 quad1.x = floor(blueColor) - (quad1.y * 8.0);\n\
		 mediump vec2 quad2;\n\
		 quad2.y = floor(ceil(blueColor) / 8.0);\n\
		 quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n\
		 highp vec2 texPos1;\n\
		 texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);\n\
		 texPos1.y = 1.0 - ((quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g));\n\
		 highp vec2 texPos2;\n\
		 texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);\n\
		 texPos2.y = 1.0 - ((quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g));\n\
		 lowp vec3 newColor1 = texture2D(textureB, texPos1).xyz;\n\
		 lowp vec3 newColor2 = texture2D(textureB, texPos2).xyz;\n\
		 lowp vec3 newColor = mix(newColor1, newColor2, fract(blueColor));\n\
		 return newColor.rgb;\n\
	 }",
	noise:  "\n\
		float hash(float n) { return fract(sin(n) * 1e4); }\n\
		float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }\n\
		float noise(float x) {\n\
			float i = floor(x);\n\
			float f = fract(x);\n\
			float u = f * f * (3.0 - 2.0 * f);\n\
			return mix(hash(i), hash(i + 1.0), u);\n\
		}\n\
		float noise(vec2 x) {\n\
			vec2 i = floor(x);\n\
			vec2 f = fract(x);\n\
			float a = hash(i);\n\
			float b = hash(i + vec2(1.0, 0.0));\n\
			float c = hash(i + vec2(0.0, 1.0));\n\
			float d = hash(i + vec2(1.0, 1.0));\n\
			vec2 u = f * f * (3.0 - 2.0 * f);\n\
			return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;\n\
		}\n\
	",
	HSV: "vec3 rgb2hsv(vec3 c)\n\
		{\n\
			vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\n\
			vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));\n\
			vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\n\
			\n\
			float d = q.x - min(q.w, q.y);\n\
			float e = 1.0e-10;\n\
			return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);\n\
		}\n\
		\n\
		vec3 hsv2rgb(vec3 c)\n\
		{\n\
			vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n\
			vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\n\
			return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n\
		}"
}

/**
* Returns the first component of this container that is of the same class
* @method configure
* @param {Object} o object with the configuration info from a previous serialization
*/
FXStack.prototype.configure = function(o)
{
	this.apply_fxaa = !!o.apply_fxaa;
	if(o.fx)
		this.fx = o.fx.concat();
	this._must_update_passes = true;
}

FXStack.prototype.serialize = FXStack.prototype.toJSON = function()
{
	return { 
		apply_fxaa: this.apply_fxaa,
		fx: this.fx.concat()
	};
}

FXStack.prototype.getResources = function(res)
{
	var fxs = this.fx;
	for(var i = 0; i < fxs.length; i++)
	{
		var fx = fxs[i];
		var fx_info = FXStack.available_fx[ fx.name ];
		if(!fx_info)
			continue;
		if(!fx_info.uniforms)
			continue;
		for(var j in fx_info.uniforms)
		{
			var uniform = fx_info.uniforms[j];
			if(uniform.type == "sampler2D" && fx[j])
				res[ fx[j] ] = GL.Texture;
		}
	}
	return res;
}

FXStack.prototype.onResourceRenamed = function(old_name, new_name, resource)
{
	var fxs = this.fx;
	for(var i = 0; i < fxs.length; i++)
	{
		var fx = fxs[i];
		var fx_info = FXStack.available_fx[ fx.name ];
		if(!fx_info)
			continue;
		if(!fx_info.uniforms)
			continue;
		for(var j in fx_info.uniforms)
		{
			var uniform = fx_info.uniforms[j];
			if(uniform.type == "sampler2D" && fx[j] == old_name )
				fx[j] = new_name;
		}
	}
}


//attach a new FX to the FX Stack
FXStack.prototype.addFX = function( name )
{
	if(!name)
		return;
	if( !FXStack.available_fx[ name ] )
	{
		console.warn( "FXStack not found: " + name );
		return;
	}
	this.fx.push({ name: name });
	this._must_update_passes = true;
}

//returns the Nth FX in the FX Stack
FXStack.prototype.getFX = function(index)
{
	return this.fx[ index ];
}

//rearranges an FX
FXStack.prototype.moveFX = function( fx, offset )
{
	offset = offset || -1;

	var index = this.fx.indexOf(fx);
	if( index == -1 )
		return;

	this.fx.splice(index,1);
	index += offset;


	if(index >= 0 && index < this.fx.length)
		this.fx.splice(index,0,fx);
	else
		this.fx.push(fx);
	this._must_update_passes = true;
}

//removes an FX from the FX stack
FXStack.prototype.removeFX = function( fx )
{
	for(var i = 0; i < this.fx.length; i++)
	{
		if(this.fx[i] !== fx)
			continue;

		this.fx.splice(i,1);
		this._must_update_passes = true;
		return;
	}
}

//extract the number of passes to do according to the fx enabled
FXStack.prototype.buildPasses = function()
{
	var fxs = this.fx;

	var passes = [];
	var current_pass = {
		fxs:[],
		uniforms:{},
		shader:null,
		first_fx_id: 0
	};

	var uv_code = "";
	var color_code = "";
	var uniforms_code = "";
	var included_functions = {};

	var is_first = true;

	var fx_id = 0;
	for(var i = 0; i < fxs.length; i++)
	{
		//the FX settings
		var fx = fxs[i];
		fx_id = i;

		//the FX definition
		var fx_info = FXStack.available_fx[ fx.name ];
		if(!fx_info)
			continue;

		//break this pass
		if( fx_info.break_pass && !is_first)
		{
			current_pass.uv_code = uv_code;
			current_pass.color_code = color_code;
			current_pass.uniforms_code = uniforms_code;
			current_pass.included_functions = included_functions;
			passes.push(current_pass);
			this.buildPassShader( current_pass );

			uv_code = "";
			color_code = "";
			uniforms_code = "";
			included_functions = {};

			current_pass = {
				fxs:[],
				uniforms:{},
				first_fx_id: fx_id
			};
			is_first = true;
		}
		else
			is_first = false;

		if(fx_info.functions)
			for(var z in fx_info.functions)
				included_functions[ fx_info.functions[z] ] = true;
		if( fx_info.code )
			color_code += fx_info.code.split("@").join( fx_id ) + ";\n";
		if( fx_info.uv_code )
			uv_code += fx_info.uv_code.split("@").join( fx_id ) + ";\n";

		if(fx_info.uniforms)
			for(var j in fx_info.uniforms)
			{
				var uniform = fx_info.uniforms[j];
				var varname = uniform.name + fx_id;
				uniforms_code += "uniform " + uniform.type + " " + varname + ";\n";
			}

		current_pass.fxs.push( fx );
	}

	if(!is_first)
	{
		current_pass.uv_code = uv_code;
		current_pass.color_code = color_code;
		current_pass.included_functions = included_functions;
		passes.push( current_pass );
		this.buildPassShader( current_pass );
	}

	this._passes = passes;
}

FXStack.prototype.buildPassShader = function( pass )
{
	var functions_code = "";
	for(var i in pass.included_functions)
	{
		var func = FXStack.available_functions[ i ];
		if(!func)
		{
			console.error("FXStack: Function not found: " + i);
			continue;
		}
		functions_code += func + "\n";
	}

	var fullcode = "\n\
		#extension GL_OES_standard_derivatives : enable\n\
		precision highp float;\n\
		#define color3 vec3\n\
		#define color4 vec4\n\
		uniform sampler2D u_texture;\n\
		uniform sampler2D u_depth_texture;\n\
		varying vec2 v_coord;\n\
		uniform vec2 u_viewport;\n\
		uniform vec2 u_iviewport;\n\
		uniform float u_aspect;\n\
		uniform vec2 u_depth_range;\n\
		uniform vec2 u_random;\n\
		vec2 uv;\n\
		" + pass.uniforms_code + "\n\
		" + functions_code + "\n\
		void main() {\n\
			uv = v_coord;\n\
			vec2 to_center = vec2(0.5) - uv;\n\
			float dist_to_center = length(to_center);\n\
			" + pass.uv_code + "\n\
			vec4 color = texture2D(u_texture, uv);\n\
			float temp = 0.0;\n\
			" + pass.color_code + "\n\
			gl_FragColor = color;\n\
		}\n\
		";

	this._must_update_passes = false;
	pass.shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, fullcode );
	return pass.shader;
}


FXStack.prototype.applyFX = function( input_texture, output_texture, options )
{
	var color_texture = input_texture;
	var depth_texture = options.depth_texture;

	var global_uniforms = this._uniforms;
	global_uniforms.u_viewport[0] = color_texture.width;
	global_uniforms.u_viewport[1] = color_texture.height;
	global_uniforms.u_iviewport[0] = 1 / color_texture.width;
	global_uniforms.u_iviewport[1] = 1 / color_texture.height;
	global_uniforms.u_aspect = color_texture.width / color_texture.height;
	global_uniforms.u_random[0] = Math.random();
	global_uniforms.u_random[1] = Math.random();

	if(!this._passes || this._must_update_passes )
		this.buildPasses();

	if(!this._passes.length)
	{
		if(output_texture)
			input_texture.copyTo( output_texture );
		else
		{
			var fxaa_shader = GL.Shader.getFXAAShader();
			fxaa_shader.setup();
			input_texture.toViewport( this.apply_fxaa ? fxaa_shader : null );
		}
		return;
	}

	var w = output_texture ? output_texture.width : input_texture.width;
	var h = output_texture ? output_texture.height : input_texture.height;

	var origin_texture = GL.Texture.getTemporary( w, h, { type: input_texture.type, format: input_texture.format } );
	var target_texture = GL.Texture.getTemporary( w, h, { type: input_texture.type, format: input_texture.format } );

	input_texture.copyTo( origin_texture );

	var fx_id = 0;
	for(var i = 0; i < this._passes.length; i++)
	{
		var pass = this._passes[i];
		var texture_slot = 2;
		var uniforms = pass.uniforms;

		//gather uniform values
		for(var j = 0; j < pass.fxs.length; ++j)
		{
			var fx = pass.fxs[j];
			fx_id = pass.first_fx_id + j;

			//the FX definition
			var fx_info = FXStack.available_fx[ fx.name ];
			if(!fx_info)
				continue;

			if(!fx_info.uniforms)
				continue;

			for(var k in fx_info.uniforms)
			{
				var uniform = fx_info.uniforms[k];
				var varname = uniform.name + fx_id;
				if(uniform.type == "sampler2D")
				{
					uniforms[ varname ] = texture_slot;
					var tex = this.getTexture( fx[k] );
					if(tex)
					{
						tex.bind( texture_slot );
						if(uniform.filter == "nearest")
						{
							gl.texParameteri( tex.texture_type, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
							gl.texParameteri( tex.texture_type, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
						}
						if(uniform.wrap == "clamp")
						{
							gl.texParameteri( tex.texture_type, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
							gl.texParameteri( tex.texture_type, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
						}
					}
					else
					{
						//bind something to avoid problems
						tex = LS.Renderer._missing_texture;
						if(tex)
							tex.bind( texture_slot );
					}
					texture_slot++;
				}
				else
					uniforms[ varname ] = fx[j] !== undefined ? fx[j] : uniform.value;
			}
		}

		//apply pass
		var shader = pass.shader;
		//error compiling shader
		if(!shader)
		{
			input_texture.toViewport(); //what about output_texture?
			break;
		}

		//set the depth texture for some FXs like fog or depth
		if(depth_texture && shader.hasUniform("u_depth_texture"))
		{
			depth_texture.bind(1);
			if(depth_texture.near_far_planes)
				uniforms.u_depth_range = depth_texture.near_far_planes;
		}

		//apply FX and accumulate in secondary texture ***************
		shader.uniforms( global_uniforms );
		origin_texture.copyTo( target_texture, shader, uniforms );

		//swap
		var tmp = origin_texture;
		origin_texture = target_texture;
		target_texture = tmp;
	}

	//to the screen or the output_texture
	var final_texture = target_texture;
	final_texture.setParameter( gl.TEXTURE_MAG_FILTER, this.filter ? gl.LINEAR : gl.NEAREST );
	final_texture.setParameter( gl.TEXTURE_MIN_FILTER, gl.LINEAR );

	gl.disable( gl.DEPTH_TEST );
	gl.disable( gl.BLEND );
	gl.disable( gl.CULL_FACE );

	//to screen
	if( this.apply_fxaa )
	{
		var fx_aa_shader = GL.Shader.getFXAAShader();
		fx_aa_shader.setup();
		if(!output_texture)
			final_texture.toViewport( fx_aa_shader );
		else
			final_texture.copyTo( output_texture, fx_aa_shader );
	}
	else
	{
		if(!output_texture)
			final_texture.toViewport();
		else
		{
			shader.uniforms( uniforms );
			final_texture.copyTo( output_texture, shader );
		}
	}

	//release textures back to the pool
	GL.Texture.releaseTemporary( origin_texture );
	GL.Texture.releaseTemporary( target_texture );
}


//executes the FX stack in the input texture and outputs the result in the output texture (or the screen)
FXStack.prototype.applyFX = function( input_texture, output_texture, options )
{
	var color_texture = input_texture;
	var depth_texture = options.depth_texture;

	var fxs = this.fx;

	var update_shader = this._must_update_passes;
	this._must_update_passes = false;

	var uniforms = this._uniforms;
	uniforms.u_viewport[0] = color_texture.width;
	uniforms.u_viewport[1] = color_texture.height;
	uniforms.u_iviewport[0] = 1 / color_texture.width;
	uniforms.u_iviewport[1] = 1 / color_texture.height;
	uniforms.u_aspect = color_texture.width / color_texture.height;
	uniforms.u_random[0] = Math.random();
	uniforms.u_random[1] = Math.random();

	var uv_code = "";
	var color_code = "";
	var included_functions = {};
	var uniforms_code = "";
	var texture_slot = 2;

	var fx_id = 0;
	for(var i = 0; i < fxs.length; i++)
	{
		//the FX settings
		var fx = fxs[i];
		fx_id = i;

		//the FX definition
		var fx_info = FXStack.available_fx[ fx.name ];
		if(!fx_info)
			continue;

		if(update_shader)
		{
			if(fx_info.functions)
				for(var z in fx_info.functions)
					included_functions[ fx_info.functions[z] ] = true;
			if( fx_info.code )
				color_code += fx_info.code.split("@").join( fx_id ) + ";\n";
			if( fx_info.uv_code )
				uv_code += fx_info.uv_code.split("@").join( fx_id ) + ";\n";
		}

		if(fx_info.uniforms)
			for(var j in fx_info.uniforms)
			{
				var uniform = fx_info.uniforms[j];
				var varname = uniform.name + fx_id;
				if(update_shader)
				{
					uniforms_code += "uniform " + uniform.type + " " + varname + ";\n";
				}

				if(uniform.type == "sampler2D")
				{
					uniforms[ varname ] = texture_slot;
					var tex = this.getTexture( fx[j] );
					if(tex)
					{
						tex.bind( texture_slot );
						if(uniform.filter == "nearest")
						{
							gl.texParameteri( tex.texture_type, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
							gl.texParameteri( tex.texture_type, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
						}
						if(uniform.wrap == "clamp")
						{
							gl.texParameteri( tex.texture_type, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
							gl.texParameteri( tex.texture_type, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
						}
					}
					else
					{
						//bind something to avoid problems
						tex = LS.Renderer._missing_texture;
						if(tex)
							tex.bind( texture_slot );
					}

					texture_slot++;
				}
				else
					uniforms[ varname ] = fx[j] !== undefined ? fx[j] : uniform.value;
			}
	}


	var shader = null;
	if(update_shader)
	{
		var functions_code = "";
		for(var i in included_functions)
		{
			var func = FXStack.available_functions[ i ];
			if(!func)
			{
				console.error("FXStack: Function not found: " + i);
				continue;
			}
			functions_code += func + "\n";
		}

		var fullcode = "\n\
			#extension GL_OES_standard_derivatives : enable\n\
			precision highp float;\n\
			#define color3 vec3\n\
			#define color4 vec4\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_depth_texture;\n\
			varying vec2 v_coord;\n\
			uniform vec2 u_viewport;\n\
			uniform vec2 u_iviewport;\n\
			uniform float u_aspect;\n\
			uniform vec2 u_depth_range;\n\
			uniform vec2 u_random;\n\
			vec2 uv;\n\
			" + uniforms_code + "\n\
			" + functions_code + "\n\
			void main() {\n\
				uv = v_coord;\n\
				vec2 to_center = vec2(0.5) - uv;\n\
				float dist_to_center = length(to_center);\n\
				" + uv_code + "\n\
				vec4 color = texture2D(u_texture, uv);\n\
				float temp = 0.0;\n\
				" + color_code + "\n\
				gl_FragColor = color;\n\
			}\n\
			";

		this._last_shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, fullcode );
	}

	shader = this._last_shader;

	gl.disable( gl.DEPTH_TEST );
	gl.disable( gl.BLEND );
	gl.disable( gl.CULL_FACE );

	//error compiling shader
	if(!shader)
	{
		input_texture.toViewport();
		return;
	}

	//set the depth texture for some FXs like fog or depth
	if(shader.hasUniform("u_depth_texture") && depth_texture )
	{
		depth_texture.bind(1);
		if(depth_texture.near_far_planes)
			uniforms.u_depth_range = depth_texture.near_far_planes;
	}

	color_texture.setParameter( gl.TEXTURE_MAG_FILTER, this.filter ? gl.LINEAR : gl.NEAREST );
	color_texture.setParameter( gl.TEXTURE_MIN_FILTER, gl.LINEAR );

	if( this.apply_fxaa )
	{
		if(!this.temp_tex || this.temp_tex.width != gl.viewport_data[2] || this.temp_tex.height != gl.viewport_data[3])
			this.temp_tex = new GL.Texture(gl.viewport_data[2],gl.viewport_data[3]);
		this.temp_tex.drawTo(function(){
			color_texture.toViewport( shader, uniforms );
		});
		var fx_aa_shader = GL.Shader.getFXAAShader();
		fx_aa_shader.setup();

		if(!output_texture)
			this.temp_tex.toViewport( fx_aa_shader );
		else
			this.temp_tex.copyTo( output_texture, fx_aa_shader );
	}
	else
	{
		this.temp_tex = null;
		if(!output_texture)
			color_texture.toViewport( shader, uniforms );
		else
		{
			shader.uniforms( uniforms );
			color_texture.copyTo( output_texture, shader );
		}
	}
}

FXStack.prototype.getTexture = function( name )
{
	return LS.ResourcesManager.getTexture( name );
}

FXStack.prototype.getPropertyInfoFromPath = function( path )
{
	if(path.length < 2)
		return null;

	var fx_num = parseInt( path[0] );

	//fx not active
	if(fx_num >= this.fx.length)
		return null;
	var fx = this.fx[ fx_num ];

	var fx_info = FXStack.available_fx[ fx.name ];
	if(!fx_info)
		return null;

	var varname = path[1];
	if(varname == "name")
		return null;

	var uniform = fx_info.uniforms[ varname ];
	if(!uniform)
		return null;

	var type = uniform.type;

	if(type == "float")
		type = "number";
	else if(type == "sampler2D")
		type = "texture";

	return {
		target: fx,
		name: varname,
		value: fx[ varname ],
		type: uniform.type || "number"
	};
}

FXStack.prototype.setPropertyValueFromPath = function( path, value, offset )
{
	offset = offset || 0;

	if( path.length < (offset+1) )
		return null;

	var fx_num = parseInt( path[offset] );
	if(fx_num >= this.fx.length)
		return null;
	var fx = this.fx[ fx_num ];
	if(!fx)
		return null;
	
	var varname = path[offset+1];
	if (fx[ varname ] === undefined )
		return null;

	//to avoid incompatible types
	if( fx[ varname ] !== undefined && value !== undefined && fx[ varname ].constructor === value.constructor )
		fx[ varname ] = value;
}

//static method to register new FX in the system
FXStack.registerFX = function( name, fx_info )
{
	if( !fx_info.name )
		fx_info.name = name;
	if( fx_info.code === undefined )
		throw("FXStack must have a code");
	if( fx_info.uniforms && Object.keys( fx_info.uniforms ) && fx_info.code && fx_info.code.indexOf("@") == -1 )
		console.warn("FXStack using uniforms must use the character '@' at the end of every use to avoid collisions with other variables with the same name.");

	FXStack.available_fx[ name ] = fx_info;
}

//for common functions shared among different FXs...
FXStack.registerFunction = function( name, code )
{
	FXStack.available_functions[name] = code;
}

LS.FXStack = FXStack;
LS.TextureFX = FXStack; //LEGACY
///@FILE:../src/helpers/tween.js
///@INFO: UNCOMMON
/**
* Allows to launch tweening 
*
* @class Tween
* @namespace LS
* @constructor
*/

LS.Tween = {
	MAX_EASINGS: 256, //to avoid problems

	EASE_IN_QUAD: 1,
	EASE_OUT_QUAD: 2,
	EASE_IN_OUT_QUAD: 3,
	QUAD: 3,

	EASE_IN_CUBIC: 4,
	EASE_OUT_CUBIC: 5,
	EASE_IN_OUT_CUBIC: 6,
	CUBIC: 6,

	EASE_IN_QUART: 7,
	EASE_OUT_QUART: 8,
	EASE_IN_OUT_QUART: 9,
	QUART: 9,

	EASE_IN_SINE: 10,
	EASE_OUT_SINE: 11,
	EASE_IN_OUT_SINE: 12,
	SINE: 12,

	EASE_IN_EXPO: 13,
	EASE_OUT_EXPO: 14,
	EASE_IN_OUT_EXPO: 15,
	EXPO: 15,

	EASE_IN_BACK: 16,
	EASE_OUT_BACK: 17,
	EASE_IN_OUT_BACK: 18,
	BACK: 18,

	current_easings: [],
	_alife: [], //temporal array
	_temp: [], //another temporal

	reset: function()
	{
		this.current_easings = [];
		this._alife = [];
	},

	easeProperty: function( object, property, target, time, easing_function, on_complete, on_progress )
	{
		if( !object )
			throw("ease object cannot be null");
		if( target === undefined )
			throw("target value must be defined");
		if(object[property] === undefined)
			throw("property not found in object, must be initialized to a value");

		//cancel previous in case we already have one for this property
		if(this.current_easings.length)
		{
			for(var i = 0; i < this.current_easings.length; ++i)
			{
				var easing = this.current_easings[i];
				if( easing.object !== object || easing.property != property )
					continue;
				this.current_easings.splice(i,1); //remove old one
				break;		
			}
		}

		easing_function = easing_function || this.EASE_IN_OUT_QUAD;

		//clone to avoid problems
		var origin = null;
		
		if(property)
			origin = LS.cloneObject( object[ property ] );
		else
			origin = LS.cloneObject( object );
		target = LS.cloneObject( target );

		//precompute target value size
		var size = 0;
		if(target.constructor === Number)
			size = -1;
		else if(target && target.length !== undefined)
			size = target.length;

		var type = null;
		var type_info = object.constructor["@" + property];
		if( type_info )
			type = type_info.type;

		var data = { 
			object: object, 
			property: property, 
			origin: origin, 
			target: target, 
			current: 0, 
			time: time, 
			easing: easing_function, 
			on_complete: on_complete, 
			on_progress: on_progress, 
			size: size, 
			type: type,
			running: true
		};

		for(var i = 0; i < this.current_easings.length; ++i)
		{
			if( this.current_easings[i].object == object && this.current_easings[i].property == property )
			{
				this.current_easings[i] = data; //replace old easing
				break;
			}
		}

		if(this.current_easings.length >= this.MAX_EASINGS)
		{
			var easing = this.current_easings.shift();
			//TODO: this could be improved applyting the target value right now
		}

		this.current_easings.push( data );
		return data;
	},

	easeObject: function( object, target, time, easing_function, on_complete, on_progress )
	{
		if( !object || !target )
			throw("ease object cannot be null");

		easing_function = easing_function || this.EASE_IN_OUT_QUAD;

		//clone to avoid problems
		var origin = LS.cloneObject( object );
		target = LS.cloneObject( target );

		//precompute size
		var size = 0;
		if(target.length !== undefined)
			size = target.length;

		var data = { object: object, origin: origin, target: target, current: 0, time: time, easing: easing_function, on_complete: on_complete, on_progress: on_progress, size: size };

		for(var i = 0; i < this.current_easings.length; ++i)
		{
			if( this.current_easings[i].object == object )
			{
				this.current_easings[i] = data; //replace old easing
				break;
			}
		}

		if(this.current_easings.length >= this.MAX_EASINGS)
		{
			this.current_easings.shift();
		}

		this.current_easings.push( data );
		return data;
	},

	cancelEaseObject: function( object, property )
	{
		if( !this.current_easings.length )
			return;
		
		var easings = this.current_easings;
		for(var i = 0, l = easings.length; i < l; ++i)
		{
			var item = easings[i];
			if( item.object != object)
				continue;
			if( property && item.property != property)
				continue;
			item.cancel = true;
		}
	},

	//updates all the active tweens
	update: function( dt )
	{
		if( !this.current_easings.length )
			return;

		var easings = this.current_easings;
		this.current_easings = this._temp; //empty it to control incomming tweens during this update
		this.current_easings.length = 0;
		var alive = this._alife;
		alive.length = easings.length;
		var pos = 0;

		//for every pending easing method
		for(var i = 0, l = easings.length; i < l; ++i)
		{
			var item = easings[i];
			item.current += dt;
			var t = 1;

			if(item.cancel) //wont be added to the alive list
				continue;

			if(item.current < item.time)
			{
				t = item.current / item.time;
				alive[ pos ] = item;
				pos += 1;
			}

			var f = this.getEaseFactor( t, item.easing );

			var result = null;

			if(item.size)
			{
				if(item.size == -1) //number
					item.object[ item.property ] = item.target * f + item.origin * ( 1.0 - f );
				else //array
				{
					var property = item.object[ item.property ];

					if(item.type && item.type == "quat")
						quat.slerp( property, item.origin, item.target, f );
					else
					{
						//regular linear interpolation
						for(var j = 0; j < item.size; ++j)
							property[j] = item.target[j] * f + item.origin[j] * ( 1.0 - f );
					}
				}
				if(item.object.mustUpdate !== undefined)
					item.object.mustUpdate = true;
			}

			if(item.on_progress)
				item.on_progress( item );

			if(t >= 1)
			{
				if(item.on_complete)
					item.on_complete( item );
				item.running = false;
			}
		}

		alive.length = pos; //trim

		//add incomming tweens
		for(var i = 0; i < this.current_easings.length; ++i)
			alive.push( this.current_easings[i] );

		this.current_easings = alive;
		this._alife = easings;
	},

	getEaseFactor: function(t,type)
	{
		if(t>1) 
			t = 1;
		else if(t < 0)
			t = 0;
		var s = 1.70158;
		type = type || this.QUAD;
		switch(type)
		{
			case this.EASE_IN_QUAD: return (t*t);
			case this.EASE_OUT_QUAD: return 1-(t*t);
			case this.EASE_IN_OUT_QUAD: { 
				t *= 2;
				if( t < 1 ) return 0.5 * t * t;
				t -= 1;
				return -0.5 * ((t)*(t-2) - 1);
			};

			case this.EASE_IN_CUBIC: return t*t*t;
			case this.EASE_OUT_CUBIC: {
				t -= 1;
				return t*t*t + 1;
			};
			case this.EASE_IN_OUT_CUBIC: {
				t *= 2;
				if( t < 1 )
					return 0.5 * t*t*t;
				t -= 2;
				return 0.5*(t*t*t + 2);
			};

			case this.EASE_IN_QUART: return t*t*t*t;
			case this.EASE_OUT_QUART: {
				t -= 1;
				return -(t*t*t*t - 1);
			}
			case this.EASE_IN_OUT_QUART: {
				t *= 2;
				if( t < 1 ) return 0.5*t*t*t*t;
				else {
					t -= 2;
					return -0.5 * (t*t*t*t - 2);
				}
			}

			case this.EASE_IN_SINE:	return 1-Math.cos( t * Math.PI / 2 );
			case this.EASE_OUT_SINE:	return Math.sin( t * Math.PI / 2 );
			case this.EASE_IN_OUT_SINE: return -0.5 * ( Math.cos( Math.PI * t ) - 1 );

			case this.EASE_IN_EXPO: return t == 0 ? 0 : Math.pow( 2, 10 * (t - 1) );
			case this.EASE_OUT_EXPO: return t == 1 ? 1 : 1 - Math.pow( 2, -10 * t );
			case this.EASE_IN_OUT_EXPO: {
				if( t == 0 ) return 0;
				if( t == 1 ) return 1;
				t *= 2;
				if( t < 1 ) return 0.5 * Math.pow( 2, 10 * (t - 1) );
				return 0.5 * ( -Math.pow( 2, -10 * (t - 1)) + 2);
			}

			case this.EASE_IN_BACK: return t * t * ((s+1)*t - s);
			case this.EASE_OUT_BACK: return (t*t*((s+1)*t + s) + 1);
			case this.EASE_IN_OUT_BACK: {
				t *= 2;
				if( t < 1 ) {
					s *= 1.525;
					return 0.5*(t*t*((s+1)*t - s));
				}
				else {
					t -= 2;
					s *= 1.525;
					return 0.5*(t*t*((s+1)*t+ s) + 2);
				}
			};
		}
		return t;
	}
};



///@INFO: UNCOMMON
/**
* This component allow to create basic FX
* @class CameraFX
* @param {Object} o object with the serialized info
*/
function CameraFX( o )
{
	this.enabled = true;

	/**
	* The FX Stack
	* @property fx {LS.FXStack}
	*/
	this.fx = new LS.FXStack( o ? o.fx : null );

	/**
	* The position of the camera (in local space, node space)
	* @property eye {vec3}
	* @default [0,100,100]
	*/
	this.frame = new LS.RenderFrameContext();
	this.frame.use_depth_texture = true;
	this.use_antialiasing = false;

	this.shader_material = null;

	if(o)
		this.configure(o);
}

CameraFX.icon = "mini-icon-fx.png";
CameraFX["@camera_uid"] = { type: "String" };

/**
* Apply antialiasing post-processing shader
* @property use_antialiasing {Boolean}
*/
Object.defineProperty( CameraFX.prototype, "use_antialiasing", { 
	set: function(v) { this.fx.apply_fxaa = v; },
	get: function() { return this.fx.apply_fxaa; },
	enumerable: true
});

CameraFX.prototype.configure = function(o)
{
	this.enabled = !!o.enabled;
	this.use_antialiasing = !!o.use_antialiasing;
	this.camera_uid = o.camera_uid;
	if(o.frame)
		this.frame.configure( o.frame );
	if(o.fx)
		this.fx.configure(o.fx);
}

CameraFX.prototype.serialize = function()
{
	return { 
		object_class: "CameraFX",
		enabled: this.enabled,
		use_antialiasing: this.use_antialiasing,
		frame: this.frame.serialize(),
		camera_uid: this.camera_uid,
		fx: this.fx.serialize()
	};
}

CameraFX.prototype.getResources = function( res )
{
	this.fx.getResources(res);
	if(this.shader_material)
		res[ this.shader_material ] = true;
	return res;
}

CameraFX.prototype.onResourceRenamed = function( old_name, new_name, resource )
{
	if( this.shader_material == old_name )
		this.shader_material = new_name;
	else
		this.fx.onResourceRenamed( old_name, new_name, resource );
}


CameraFX.prototype.addFX = function( name )
{
	this.fx.addFX(name);
}

CameraFX.prototype.getFX = function(index)
{
	return this.fx.getFX( index );
}

CameraFX.prototype.moveFX = function( fx, offset )
{
	return this.fx.moveFX(fx,offset);
}

CameraFX.prototype.removeFX = function( fx )
{
	return this.fx.removeFX( fx );
}

CameraFX.prototype.onAddedToScene = function( scene )
{
	LEvent.bind( scene, "enableFrameContext", this.onBeforeRender, this );
	LEvent.bind( scene, "showFrameContext", this.onAfterRender, this );
}

CameraFX.prototype.onRemovedFromScene = function( scene )
{
	LEvent.unbind( scene, "enableFrameContext", this.onBeforeRender, this );
	LEvent.unbind( scene, "showFrameContext", this.onAfterRender, this );

	if( this._binded_camera )
	{
		LEvent.unbindAll( this._binded_camera, this );
		this._binded_camera = null;
	}
}

//hook the RFC
CameraFX.prototype.onBeforeRender = function(e, render_settings)
{
	if(!this.enabled)
	{
		if( this._binded_camera )
		{
			LEvent.unbindAll( this._binded_camera, this );
			this._binded_camera = null;
		}
		return;
	}

	//FBO for one camera
	var camera = this._root.camera;
	if(this.camera_uid)
	{
		if( !this._binded_camera || this._binded_camera.uid != this.camera_uid )
			camera = this._binded_camera;
		else
			camera = this._root.scene.findComponentByUId( this.camera_uid );
	}

	if(!camera)
	{
		if( this._binded_camera )
		{
			LEvent.unbindAll( this._binded_camera, this );
			this._binded_camera = null;
		}
		return;
	}

	if(camera && camera != this._binded_camera)
	{
		if(this._binded_camera)
			LEvent.unbindAll( this._binded_camera, this );
		LEvent.bind( camera, "enableFrameContext", this.enableCameraFBO, this );
		LEvent.bind( camera, "showFrameContext", this.showCameraFBO, this );
	}
	this._binded_camera = camera;
}

CameraFX.prototype.onAfterRender = function( e, render_settings )
{
	if(!this.enabled)
		return;
	//this.showFBO();
}

CameraFX.prototype.enableCameraFBO = function(e, render_settings )
{
	if(!this.enabled)
		return;

	var camera = this._binded_camera;
	var viewport = this._viewport = camera.getLocalViewport( null, this._viewport );
	this.frame.enable( render_settings, viewport );

	render_settings.ignore_viewports = true;
}

CameraFX.prototype.showCameraFBO = function(e, render_settings )
{
	if(!this.enabled)
		return;
	render_settings.ignore_viewports = false;
	this.showFBO();
}

CameraFX.prototype.showFBO = function()
{
	if(!this.enabled)
		return;

	this.frame.disable();

	LEvent.trigger( LS.Renderer, "beforeShowFrameContext", this.frame );

	if(this.shader_material)
	{
		var material = LS.ResourcesManager.getResource( this.shader_material );
		var rendered = false;
		if(material && material.constructor === LS.ShaderMaterial )
			rendered = material.applyToTexture( this.frame._color_texture );
		if(!rendered)
			this.frame._color_texture.toViewport(); //fallback in case the shader is missing
		return;
	}

	if( this._viewport )
	{
		gl.setViewport( this._viewport );
		this.applyFX();
		gl.setViewport( this.frame._fbo._old_viewport );
	}
	else
		this.applyFX();
}


CameraFX.prototype.applyFX = function()
{
	var color_texture = this.frame._color_texture;
	var depth_texture = this.frame._depth_texture;

	this.fx.apply_fxaa = this.use_antialiasing;
	this.fx.filter = this.frame.filter_texture;
	this.fx.applyFX( color_texture, null, { depth_texture: depth_texture } );
}

LS.registerComponent( CameraFX );
///@FILE:../src/components/frameFX.js
///@INFO: UNCOMMON
/**
* This component allow to create basic FX applied to the whole scene
* @class FrameFX
* @param {Object} o object with the serialized info
*/
function FrameFX(o)
{
	this.enabled = true;

	this.fx = new LS.FXStack( o ? o.fx : null );
	this.frame = new LS.RenderFrameContext();
	this.frame.use_depth_texture = true;
	this.use_antialiasing = false;
	this.shader_material = null;

	if(o)
		this.configure(o);
}

FrameFX.icon = "mini-icon-fx.png";

FrameFX.prototype.configure = function(o)
{
	this.enabled = !!o.enabled;
	this.use_viewport_size = !!o.use_viewport_size;
	this.use_antialiasing = !!o.use_antialiasing;
	this.shader_material = o.shader_material;
	if(o.fx)
		this.fx.configure( o.fx );
	if(o.frame)
		this.frame.configure( o.frame );
}

FrameFX.prototype.serialize = function()
{
	return { 
		object_class: "FrameFX",
		enabled: this.enabled,
		uid: this.uid,
		frame: this.frame.serialize(),
		shader_material: this.shader_material,
		use_antialiasing: this.use_antialiasing,
		use_viewport_size: this.use_viewport_size,
		fx: this.fx.serialize()
	};
}

FrameFX.prototype.getResources = function( res )
{
	this.fx.getResources(res);
	if(this.shader_material)
		res[ this.shader_material ] = true;
	return res;
}

FrameFX.prototype.onResourceRenamed = function( old_name, new_name, resource )
{
	if( this.shader_material == old_name )
		this.shader_material = new_name;
	else
		this.fx.onResourceRenamed( old_name, new_name, resource );
}

FrameFX.prototype.addFX = function( name )
{
	this.fx.addFX(name);
}

FrameFX.prototype.getFX = function(index)
{
	return this.fx.getFX( index );
}

FrameFX.prototype.moveFX = function( fx, offset )
{
	return this.fx.moveFX(fx,offset);
}

FrameFX.prototype.removeFX = function( fx )
{
	return this.fx.removeFX( fx );
}

FrameFX.prototype.onAddedToScene = function( scene )
{
	LEvent.bind( scene, "enableFrameContext", this.onBeforeRender, this );
	LEvent.bind( scene, "showFrameContext", this.onAfterRender, this );
}

FrameFX.prototype.onRemovedFromScene = function( scene )
{
	LEvent.unbind( scene, "enableFrameContext", this.onBeforeRender, this );
	LEvent.unbind( scene, "showFrameContext", this.onAfterRender, this );
}

//hook the RFC
FrameFX.prototype.onBeforeRender = function(e, render_settings)
{
	if(!this.enabled)
		return;

	this.enableFrameFBO( render_settings );
}

FrameFX.prototype.onAfterRender = function( e, render_settings )
{
	if(!this.enabled)
		return;
	this.showFBO();
}

FrameFX.prototype.enableFrameFBO = function( render_settings )
{
	if(!this.enabled)
		return;

	this.frame.enable( render_settings );
}

FrameFX.prototype.showFBO = function()
{
	if(!this.enabled)
		return;

	this.frame.disable();

	LEvent.trigger( LS.Renderer, "beforeShowFrameContext", this.frame );

	if(this.shader_material)
	{
		var material = LS.ResourcesManager.getResource( this.shader_material );
		var rendered = false;
		if(material && material.constructor === LS.ShaderMaterial )
			rendered = material.applyToTexture( this.frame._color_texture );
		if(!rendered)
			this.frame._color_texture.toViewport(); //fallback in case the shader is missing
		return;
	}

	if( this._viewport )
	{
		gl.setViewport( this._viewport );
		this.applyFX();
		gl.setViewport( this.frame._fbo._old_viewport );
	}
	else
		this.applyFX();
}

FrameFX.prototype.applyFX = function()
{
	var color_texture = this.frame._color_texture;
	var depth_texture = this.frame._depth_texture;

	this.fx.apply_fxaa = this.use_antialiasing;
	this.fx.filter = this.frame.filter_texture;
	this.fx.applyFX( color_texture, null, { depth_texture: depth_texture } );
}

///@INFO: UNCOMMON
function FogFX(o)
{
	this.enabled = true;
	this.start = 100;
	this.end = 1000;
	this.density = 0.001;
	this.type = FogFX.LINEAR;
	this.color = vec3.fromValues(0.5,0.5,0.5);

	this._uniforms = {
		u_fog_info: vec3.create(),
		u_fog_color: this.color
	}

	if(o)
		this.configure(o);
}

FogFX.icon = "mini-icon-fog.png";

FogFX.LINEAR = 1;
FogFX.EXP = 2;
FogFX.EXP2 = 3;

FogFX["@color"] = { type: "color" };
FogFX["@density"] = { type: "number", min: 0, max:1, step:0.0001, precision: 4 };
FogFX["@type"] = { type:"enum", values: {"linear": FogFX.LINEAR, "exponential": FogFX.EXP, "exponential 2": FogFX.EXP2 }};


FogFX.prototype.onAddedToScene = function(scene)
{
	//LEvent.bind( scene,"fillLightUniforms",this.fillUniforms,this);
	LEvent.bind( scene, "fillSceneUniforms",this.fillSceneUniforms,this);

}

FogFX.prototype.onRemovedFromScene = function(scene)
{
	//LEvent.unbind(Scene,"fillLightUniforms",this.fillUniforms,this);
	LEvent.unbind( scene, "fillSceneUniforms",this.fillSceneUniforms, this);
}

FogFX.prototype.fillSceneUniforms = function( e, uniforms )
{
	if(!this.enabled)
		return;

	this._uniforms.u_fog_info[0] = this.start;
	this._uniforms.u_fog_info[1] = this.end;
	this._uniforms.u_fog_info[2] = this.density;
	this._uniforms.u_fog_color = this.color;

	LS.Renderer.enableFrameShaderBlock( "fog", this._uniforms );
}

LS.registerComponent(FogFX);

//shaderblock
var fog_block = new LS.ShaderBlock("fog");
//fog_block.addInclude("computeFog");
fog_block.bindEvent("fs_functions", "	uniform vec3 u_fog_info;\n	uniform vec3 u_fog_color;\n");
fog_block.bindEvent("fs_final_pass", "	if(u_light_info.z == 0.0) { float cam_dist = length(u_camera_eye - v_pos);\n	float fog = 1. - 1.0 / exp(max(0.0,cam_dist - u_fog_info.x) * u_fog_info.z);\n	final_color.xyz = mix(final_color.xyz, u_fog_color, fog);\n}\n\n");
fog_block.register();
FogFX.block = fog_block;



/**
* The base class used by the ParticlesEmissor
* @class Particle
* @namespace LS
* @constructor
* @param {Object} object to configure from
*/
function Particle()
{
	this.id = 0;
	this._pos = vec3.fromValues(0,0,0);
	this._vel = vec3.fromValues(0,0,0);
	this.life = 1;
	this.angle = 0;
	this.size = 1;
	this.rot = 0;
}

Object.defineProperty( Particle.prototype, 'pos', {
	get: function() { return this._pos; },
	set: function(v) { this._pos.set(v); },
	enumerable: true
});

Object.defineProperty( Particle.prototype, 'vel', {
	get: function() { return this._vel; },
	set: function(v) { this._vel.set(v); },
	enumerable: true
});

/**
* ParticlesEmissor allow to render a particle system, meant to render things like smoke or fire
* @class ParticlesEmissor
* @namespace LS.Components
* @constructor
* @param {Object} object to configure from
*/
function ParticleEmissor(o)
{
	this.enabled = true;

	this.max_particles = 1024;
	this.warm_up_time = 0;
	this.point_particles = false;

	this.emissor_type = ParticleEmissor.BOX_EMISSOR;
	this.emissor_rate = 5; //particles per second
	this.emissor_size = vec3.fromValues(10,10,10);
	this.emissor_mesh = null;

	this.particle_life = 5;
	this.particle_speed = 10;
	this.particle_size = 5;
	this.particle_rotation = 0;
	this.particle_size_curve = [[1,1]];

	this._particle_start_color = vec3.fromValues(1,1,1);
	this._particle_end_color = vec3.fromValues(1,1,1);

	this.particle_opacity_curve = [[0.5,1]];

	this.texture_grid_size = 1;

	//physics
	this.physics_gravity = [0,0,0];
	this.physics_friction = 0;

	//material
	this.opacity = 1;
	this.additive_blending = false;
	this.texture = null;
	this.animation_fps = 1;
	this.soft_particles = false;

	this.use_node_material = false; 
	this.animated_texture = false; //change frames
	this.loop_animation = false;
	this.independent_color = false;
	this.premultiplied_alpha = false;
	this.align_with_camera = true;
	this.align_always = false; //align with all cameras
	this.follow_emitter = false;
	this.sort_in_z = true; //slower
	this.stop_update = false; //do not move particles
	this.ignore_lights = false; 

	this.onCreateParticle = null;
	this.onUpdateParticle = null;

	if(o)
		this.configure(o);

	//LEGACY!!! sizes where just a number before
	if(typeof(this.emissor_size) == "number")
		this.emissor_size = [this.emissor_size,this.emissor_size,this.emissor_size];

	this._emissor_pos = vec3.create();
	this._particles = [];
	this._remining_dt = 0;
	this._visible_particles = 0;
	this._min_particle_size = 0.001;
	this._last_id = 0;

	if(global.gl)
		this.createMesh();

	
	/* demo particles
	for(var i = 0; i < this.max_particles; i++)
	{
		var p = this.createParticle();
		this._particles.push(p);
	}
	*/
}

ParticleEmissor.BOX_EMISSOR = 1;
ParticleEmissor.SPHERE_EMISSOR = 2;
ParticleEmissor.MESH_EMISSOR = 3;
ParticleEmissor.CUSTOM_EMISSOR = 10;

ParticleEmissor["@emissor_type"] = { type:"enum", values:{ "Box":ParticleEmissor.BOX_EMISSOR, "Sphere":ParticleEmissor.SPHERE_EMISSOR, "Mesh":ParticleEmissor.MESH_EMISSOR, "Custom": ParticleEmissor.CUSTOM_EMISSOR }};
ParticleEmissor.icon = "mini-icon-particles.png";

Object.defineProperty( ParticleEmissor.prototype, 'particle_start_color', {
	get: function() { return this._particle_start_color; },
	set: function(v) { 
		if(v)
			this._particle_start_color.set(v); 
	},
	enumerable: true
});

Object.defineProperty( ParticleEmissor.prototype, 'particle_end_color', {
	get: function() { return this._particle_end_color; },
	set: function(v) { 
		if(v)
			this._particle_end_color.set(v); 
	},
	enumerable: true
});


ParticleEmissor.prototype.onAddedToScene = function(scene)
{
	LEvent.bind( scene, "update",this.onUpdate,this);
	LEvent.bind( scene, "start",this.onStart,this);
	LEvent.bind( scene, "collectRenderInstances", this.onCollectInstances, this);
	LEvent.bind( scene, "afterCameraEnabled",this.onAfterCamera, this);
}

ParticleEmissor.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbindAll( scene, this );
}

ParticleEmissor.prototype.getResources = function(res)
{
	if(this.emissor_mesh)
		res[ this.emissor_mesh ] = Mesh;
	if(this.texture)
		res[ this.texture ] = Texture;
}

ParticleEmissor.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	if(this.emissor_mesh == old_name)
		this.emissor_mesh = new_name;
	if(this.texture == old_name)
		this.texture = new_name;
}

ParticleEmissor.prototype.onAfterCamera = function(e,camera)
{
	if(!this.enabled)
		return;

	if(this.align_always)
		this.updateMesh( camera );
}

ParticleEmissor.prototype.createParticle = function(p)
{
	p = p || new Particle();
	
	switch(this.emissor_type)
	{
		case ParticleEmissor.BOX_EMISSOR: p._pos.set( [this.emissor_size[0] * ( Math.random() - 0.5), this.emissor_size[1] * ( Math.random() - 0.5 ), this.emissor_size[2] * (Math.random() - 0.5) ]); break;
		case ParticleEmissor.SPHERE_EMISSOR: 
			var gamma = 2 * Math.PI * Math.random();
			var theta = Math.acos(2 * Math.random() - 1);
			p._pos.set( [Math.sin(theta) * Math.cos(gamma), Math.sin(theta) * Math.sin(gamma), Math.cos(theta) ]);
			vec3.multiply( p.pos, p.pos, this.emissor_size); 
			break;
			//p.pos = vec3.multiply( vec3.normalize( vec3.create( [(Math.random() - 0.5), ( Math.random() - 0.5 ), (Math.random() - 0.5)])), this.emissor_size); break;
		case ParticleEmissor.MESH_EMISSOR: 
			var mesh = this.emissor_mesh;
			if(mesh && mesh.constructor === String)
				mesh = LS.ResourcesManager.getMesh(this.emissor_mesh);
			if(mesh && mesh.getBuffer("vertices") )
			{
				var vertices = mesh.getBuffer("vertices").data;				
				var v = Math.floor(Math.random() * vertices.length / 3)*3;
				p._pos.set( [vertices[v] + Math.random() * 0.001, vertices[v+1] + Math.random() * 0.001, vertices[v+2] + Math.random() * 0.001] );
			}
			else
				p._pos.set([0,0,0]);
			break;
		case ParticleEmissor.CUSTOM_EMISSOR: //done after the rest
		default: 
	}

	p._vel.set( [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5 ] );
	p.life = this.particle_life;
	p.id = this._last_id;
	p.angle = 0;
	p.size = 1;
	p.rot = this.particle_rotation + 0.25 * this.particle_rotation * Math.random();

	this._last_id += 1;
	if(this.independent_color)
		p.c = vec3.clone( this.particle_start_color );

	vec3.scale(p._vel, p._vel, this.particle_speed);

	//after everything so the user can edit whatever he wants
	if(this.emissor_type == ParticleEmissor.CUSTOM_EMISSOR && this.onCreateParticle)
		this.onCreateParticle( p, this );

	//this._root.transform.transformPoint(p.pos, p.pos);
	if(!this.follow_emitter) //the transform will be applyed in the matrix
		vec3.add(p._pos, p._pos, this._emissor_pos);

	return p;
}

ParticleEmissor.prototype.onStart = function(e)
{
	if(!this.enabled)
		return;

	if(this.warm_up_time <= 0)
		return;

	var delta = 1/30;
	for(var i = 0; i < this.warm_up_time; i+= delta)
		this.onUpdate( null, delta, true);
}

ParticleEmissor.prototype.onUpdate = function(e, dt, do_not_updatemesh )
{
	if(!this.enabled)
		return;

	if(!this._root.scene)
		throw("update without scene? impossible");

	if(this._root.transform)
		this._root.transform.getGlobalPosition(this._emissor_pos);

	if(this.emissor_rate < 0) this.emissor_rate = 0;

	if(!this.stop_update)
	{
		//update particles
		var gravity = vec3.clone(this.physics_gravity);
		var friction = this.physics_friction;
		var particles = [];
		var vel = vec3.create();
		var rot = this.particle_rotation * dt;

		for(var i = 0, l = this._particles.length; i < l; ++i)
		{
			var p = this._particles[i];

			vec3.copy(vel, p._vel);
			vec3.add(vel, gravity, vel);
			vec3.scale(vel, vel, dt);

			if(friction)
			{
				vel[0] -= vel[0] * friction;
				vel[1] -= vel[1] * friction;
				vel[2] -= vel[2] * friction;
			}

			vec3.add( p._pos, vel, p._pos);

			p.angle += p.rot * dt;
			p.life -= dt;

			if(this.onUpdateParticle)
				this.onUpdateParticle(p,dt,this);

			if(p.life > 0) //keep alive
				particles.push(p);
		}

		//emit new
		if(this.emissor_rate != 0)
		{
			var new_particles = (dt + this._remining_dt) * this.emissor_rate;
			this._remining_dt = (new_particles % 1) / this.emissor_rate;
			new_particles = new_particles<<0;

			if(new_particles > this.max_particles)
				new_particles = this.max_particles;

			for(var i = 0; i < new_particles; i++)
			{
				var p = this.createParticle();
				if(particles.length < this.max_particles)
					particles.push(p);
			}
		}

		//replace old container with new one
		this._particles = particles;
	}

	//compute mesh
	if(!this.align_always && !do_not_updatemesh)
	{
		this.updateMesh( LS.Renderer._current_camera );
		this._root.scene.requestFrame();
	}

	//send change
	LEvent.trigger( this._root.scene , "change"); //??
}

ParticleEmissor.prototype.createMesh = function ()
{
	if( this._mesh_maxparticles == this.max_particles)
		return;

	this._vertices = new Float32Array(this.max_particles * 6 * 3); //6 vertex per particle x 3 floats per vertex
	this._coords = new Float32Array(this.max_particles * 6 * 2);
	this._colors = new Float32Array(this.max_particles * 6 * 4);
	this._extra2 = new Float32Array(this.max_particles * 2);

	var default_coords = [1,1, 0,1, 1,0,  0,1, 0,0, 1,0];
	var default_color = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1];

	for(var i = 0; i < this.max_particles; i++)
	{
		this._coords.set( default_coords , i*6*2);
		this._colors.set( default_color , i*6*4);
		this._extra2[i*2] = 1;
		this._extra2[i*2+1] = i;
	}

	this._computed_grid_size = 1;
	//this._mesh = Mesh.load({ vertices:this._vertices, coords: this._coords, colors: this._colors, stream_type: gl.STREAM_DRAW });
	this._mesh = new GL.Mesh();
	this._mesh.addBuffers({ vertices:this._vertices, coords: this._coords, colors: this._colors, extra2: this._extra2 }, null, gl.STREAM_DRAW);
	this._mesh_maxparticles = this.max_particles;
}

ParticleEmissor._tmp_quat = quat.create();

ParticleEmissor.prototype.updateMesh = function (camera)
{
	if(!camera) //no main camera specified (happens at early updates)
		return;

	if( this._mesh_maxparticles != this.max_particles) 
		this.createMesh();

	var center = camera.getEye(); 

	var MIN_SIZE = this._min_particle_size;

	/*
	if(this.follow_emitter)
	{
		var iM = this._root.transform.getMatrix();
		mat4.multiplyVec3(iM, center);
	}
	*/

	var front = camera.getLocalVector([0,0,1]);
	var right = camera.getLocalVector([1,0,0]);
	var top = camera.getLocalVector([0,1,0]);
	var temp = vec3.create();
	var size = this.particle_size;

	var topleft = vec3.fromValues(-1,0,-1);
	var topright = vec3.fromValues(1,0,-1);
	var bottomleft = vec3.fromValues(-1,0,1);
	var bottomright = vec3.fromValues(1,0,1);

	if(this.align_with_camera)
	{
		vec3.subtract(topleft, top,right);
		vec3.add(topright, top,right);
		vec3.scale(bottomleft,topright,-1);
		vec3.scale(bottomright,topleft,-1);
	}

	//scaled versions
	var s_topleft = vec3.create()
	var s_topright = vec3.create()
	var s_bottomleft = vec3.create()
	var s_bottomright = vec3.create()

	var particles = this._particles;
	if(this.sort_in_z)
	{
		particles = this._particles.concat(); //copy
		var plane = geo.createPlane(center, front); //compute camera plane
		var den = 1 / Math.sqrt(plane[0]*plane[0] + plane[1]*plane[1] + plane[2]*plane[2]); //delta
		for(var i = 0; i < particles.length; ++i)
			particles[i]._dist = Math.abs(vec3.dot(particles[i]._pos,plane) + plane[3]) * den;
			//particles[i]._dist = vec3.dist( center, particles[i].pos );
		particles.sort(function(a,b) { return a._dist < b._dist ? 1 : (a._dist > b._dist ? -1 : 0); });
		this._particles = particles;
	}

	//avoid errors
	if(this.particle_life == 0)
		this.particle_life = 0.0001;

	var color = new Float32Array([1,1,1,1]);
	var particle_start_color = this._particle_start_color;
	var particle_end_color = this._particle_end_color;

	//used for grid based textures
	var recompute_coords = false;
	if((this._computed_grid_size != this.texture_grid_size || this.texture_grid_size > 1) || this.point_particles)
	{
		recompute_coords = true;
		this._computed_grid_size = this.texture_grid_size;
	}
	var texture_grid_size = this.texture_grid_size;
	var d_uvs = 1 / this.texture_grid_size;
	var offset_u = 0, offset_v = 0;
	var grid_frames = this.texture_grid_size<<2;
	var animated_texture = this.animated_texture;
	var loop_animation = this.loop_animation;
	var time = this._root.scene.getTime() * this.animation_fps;

	//used for precompute curves to speed up (sampled at 60 frames per second)
	var recompute_colors = true;
	var opacity_curve = new Float32Array((this.particle_life * 60)<<0);
	var size_curve = new Float32Array((this.particle_life * 60)<<0);
	var particle_size = this.particle_size;

	var dI = 1 / (this.particle_life * 60);
	for(var i = 0; i < opacity_curve.length; i += 1)
	{
		opacity_curve[i] = LS.getCurveValueAt(this.particle_opacity_curve,0,1,0, i * dI );
		size_curve[i] = LS.getCurveValueAt(this.particle_size_curve,0,1,0, i * dI );
	}

	//references
	var points = this.point_particles;
	var max_vertices = this._vertices.length;
	var vertices = this._vertices;
	var colors = this._colors;
	var extra2 = this._extra2;
	var coords = this._coords;

	//used for rotations
	var rot = ParticleEmissor._tmp_quat;

	//generate quads
	var i = 0, f = 0;
	for( var iParticle = 0, l = particles.length; iParticle < l; ++iParticle )
	{
		var p = particles[iParticle];
		if(p.life <= 0)
			continue;

		f = 1.0 - p.life / this.particle_life;

		if(recompute_colors) //compute color and opacity
		{
			var a = opacity_curve[(f*opacity_curve.length)<<0]; //getCurveValueAt(this.particle_opacity_curve,0,1,0,f);

			if(this.independent_color && p.c)
				vec3.clone(color,p.c);
			else
				vec3.lerp(color, particle_start_color, particle_end_color, f);

			if(this.premultiplied_alpha)
			{
				vec3.scale(color,color,a);
				color[3] = 1.0;
			}
			else
				color[3] = a;

			if(a < 0.001)
				continue;
		}

		var s = p.size * size_curve[(f*size_curve.length)<<0]; //getCurveValueAt(this.particle_size_curve,0,1,0,f);

		if(Math.abs(s * particle_size) < MIN_SIZE)
			continue; //ignore almost transparent particles

		//fill the extra2 with scale and particle index
		if(points)
		{
			vertices.set(p._pos, i*3);
			colors.set(color, i*4);
			if(recompute_coords)
			{
				var iG = (animated_texture ? ((loop_animation?time:f)*grid_frames)<<0 : p.id) % grid_frames;
				offset_u = iG * d_uvs;
				offset_v = 1 - (offset_u<<0) * d_uvs - d_uvs;
				offset_u = offset_u%1;
				coords[i*2] = offset_u;
				coords[i*2+1] = offset_v;
			}
			extra2[i*2] = s;
			extra2[i*2+1] = i;
			++i;
			if(i*3 >= max_vertices)
				break; //too many particles
			continue; //continue to avoid computing the inflation of every particle
		}

		s *= particle_size;

		vec3.scale(s_bottomleft, bottomleft, s)
		vec3.scale(s_topright, topright, s);
		vec3.scale(s_topleft, topleft, s);
		vec3.scale(s_bottomright, bottomright, s);

		if(p.angle != 0)
		{
			quat.setAxisAngle( rot , front, p.angle * DEG2RAD);
			vec3.transformQuat(s_bottomleft, s_bottomleft, rot);
			vec3.transformQuat(s_topright, s_topright, rot);
			vec3.transformQuat(s_topleft, s_topleft, rot);
			vec3.transformQuat(s_bottomright, s_bottomright, rot);
		}

		vec3.add(temp, p._pos, s_topright);
		vertices.set(temp, i*6*3);

		vec3.add(temp, p._pos, s_topleft);
		vertices.set(temp, i*6*3 + 3);

		vec3.add(temp, p._pos, s_bottomright);
		vertices.set(temp, i*6*3 + 3*2);

		vec3.add(temp, p._pos, s_topleft);
		vertices.set(temp, i*6*3 + 3*3);

		vec3.add(temp, p._pos, s_bottomleft);
		vertices.set(temp, i*6*3 + 3*4);

		vec3.add(temp, p._pos, s_bottomright);
		vertices.set(temp, i*6*3 + 3*5);

		if(recompute_colors)
		{
			colors.set(color, i*6*4);
			colors.set(color, i*6*4 + 4);
			colors.set(color, i*6*4 + 4*2);
			colors.set(color, i*6*4 + 4*3);
			colors.set(color, i*6*4 + 4*4);
			colors.set(color, i*6*4 + 4*5);
		}

		if(recompute_coords)
		{
			var iG = (animated_texture ? ((loop_animation?time:f)*grid_frames)<<0 : p.id) % grid_frames;
			offset_u = iG * d_uvs;
			offset_v = 1 - (offset_u<<0) * d_uvs - d_uvs;
			offset_u = offset_u%1;
			coords.set([offset_u+d_uvs,offset_v+d_uvs, offset_u,offset_v+d_uvs, offset_u+d_uvs,offset_v,  offset_u,offset_v+d_uvs, offset_u,offset_v, offset_u+d_uvs,offset_v], i*6*2);
		}

		++i;
		if(i*6*3 >= max_vertices)
			break; //too many particles
	}
	this._visible_particles = i;

	//upload geometry
	this._mesh.vertexBuffers["vertices"].data = this._vertices;
	this._mesh.vertexBuffers["vertices"].upload(gl.STREAM_DRAW);

	this._mesh.vertexBuffers["colors"].data = this._colors;
	this._mesh.vertexBuffers["colors"].upload(gl.STREAM_DRAW);

	this._mesh.vertexBuffers["extra2"].data = this._extra2;
	this._mesh.vertexBuffers["extra2"].upload(gl.STREAM_DRAW);

	if(recompute_coords)
	{
		this._mesh.vertexBuffers["coords"].data = this._coords;
		this._mesh.vertexBuffers["coords"].upload(gl.STREAM_DRAW);
	}
}

ParticleEmissor._identity = mat4.create();

//ParticleEmissor.prototype.getRenderInstance = function(options,camera)
ParticleEmissor.prototype.onCollectInstances = function(e, instances, options)
{
	if(!this._root || !this.enabled)
		return;

	var camera = LS.Renderer._current_camera;

	if(!this._material)
		this._material = new LS.StandardMaterial();

	this._material.opacity = this.opacity - 0.01; //try to keep it under 1
	this._material.setTexture( "color", this.texture );
	this._material.blend_mode = this.additive_blending ? LS.Blend.ADD : LS.Blend.ALPHA;
	this._material.constant_diffuse = true;
	this._material.uvs_matrix[0] = this._material.uvs_matrix[4] = 1 / this.texture_grid_size;
	this._material.flags.depth_write = false;
	this._material.flags.ignore_lights = this.ignore_lights;

	if(!this._mesh)
		return null;

	var RI = this._render_instance;
	if(!RI)
		this._render_instance = RI = new LS.RenderInstance(this._root, this);

	if( this.point_particles )
	{
		//enable extra2
		RI.addShaderBlock( LS.Shaders.extra2_block );
		//enable point particles 
		RI.addShaderBlock( pointparticles_block );
	}
	else
	{
		RI.removeShaderBlock( LS.Shaders.extra2_block );
		RI.removeShaderBlock( pointparticles_block );
	}

	if(this.follow_emitter)
		mat4.translate( RI.matrix, ParticleEmissor._identity, this._root.transform._position );
	else
	{
		mat4.copy( RI.matrix, ParticleEmissor._identity );
		if(this._root.transform)
			this._root.transform.getGlobalPosition( RI.center );
	}

	var material = (this._root.material && this.use_node_material) ? this._root.getMaterial() : this._material;
	mat4.multiplyVec3(RI.center, RI.matrix, vec3.create());

	RI.setMaterial( material );

	if(this.point_particles)
	{
		RI.setMesh( this._mesh, gl.POINTS );
		RI.uniforms.u_point_size = this.particle_size;
		RI.setRange(0, this._visible_particles );
	}
	else
	{
		RI.setMesh( this._mesh, gl.TRIANGLES );
		RI.setRange(0, this._visible_particles * 6 ); //6 vertex per particle
		delete RI.uniforms["u_point_size"];
	}

	RI.use_bounding = false; //bounding is not valid
	instances.push( RI );
}
