"use strict";

(function(global){
var GL = global.GL = {};

if (typeof(glMatrix) == "undefined")
{
    throw("glMatrix must be included before litegl");
}
else
{
    if (!global.vec2)
    {
        throw("Litegl does not support gl-matrix3.0, download 2.8");
    }
}

//polyfill
global.requestAnimationFrame = global.requestAnimationFrame || global.mozRequestAnimationFrame || global.webkitRequestAnimationFrame || function(callback) { setTimeout(callback, 1000 / 60); };

GL.blockable_keys = {"Up":true,"Down":true,"Left":true,"Right":true};

GL.reverse = null;

//some consts
//https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
GL.LEFT_MOUSE_BUTTON = 0;
GL.MIDDLE_MOUSE_BUTTON = 1;
GL.RIGHT_MOUSE_BUTTON = 2;

GL.LEFT_MOUSE_BUTTON_MASK = 1;
GL.RIGHT_MOUSE_BUTTON_MASK = 2;
GL.MIDDLE_MOUSE_BUTTON_MASK = 4;

GL.last_context_id = 0;


//Define WEBGL ENUMS as statics (more to come in WebGL 2)
//sometimes we need some gl enums before having the gl context, solution: define them globally because the specs says they are constant)

GL.COLOR_BUFFER_BIT = 16384;
GL.DEPTH_BUFFER_BIT = 256;
GL.STENCIL_BUFFER_BIT = 1024;

GL.TEXTURE_2D = 3553;
GL.TEXTURE_CUBE_MAP = 34067;
GL.TEXTURE_3D = 32879;

GL.TEXTURE_MAG_FILTER = 10240;
GL.TEXTURE_MIN_FILTER = 10241;
GL.TEXTURE_WRAP_S = 10242;
GL.TEXTURE_WRAP_T = 10243;

GL.BYTE = 5120;
GL.UNSIGNED_BYTE = 5121;
GL.SHORT = 5122;
GL.UNSIGNED_SHORT = 5123;
GL.INT = 5124;
GL.UNSIGNED_INT = 5125;
GL.FLOAT = 5126;
GL.HALF_FLOAT_OES = 36193; //webgl 1.0 only

//webgl2 formats
GL.HALF_FLOAT = 5131; 
GL.DEPTH_COMPONENT16 = 33189;
GL.DEPTH_COMPONENT24 = 33190;
GL.DEPTH_COMPONENT32F = 36012;

GL.FLOAT_VEC2 = 35664;
GL.FLOAT_VEC3 = 35665;
GL.FLOAT_VEC4 = 35666;
GL.INT_VEC2 = 35667;
GL.INT_VEC3 = 35668;
GL.INT_VEC4 = 35669;
GL.BOOL = 35670;
GL.BOOL_VEC2 = 35671;
GL.BOOL_VEC3 = 35672;
GL.BOOL_VEC4 = 35673;
GL.FLOAT_MAT2 = 35674;
GL.FLOAT_MAT3 = 35675;
GL.FLOAT_MAT4 = 35676;

//used to know the amount of data to reserve per uniform
GL.TYPE_LENGTH = {};
GL.TYPE_LENGTH[ GL.FLOAT ] = GL.TYPE_LENGTH[ GL.INT ] = GL.TYPE_LENGTH[ GL.BYTE ] = GL.TYPE_LENGTH[ GL.BOOL ] = 1;
GL.TYPE_LENGTH[ GL.FLOAT_VEC2 ] = GL.TYPE_LENGTH[ GL.INT_VEC2 ] = GL.TYPE_LENGTH[ GL.BOOL_VEC2 ] = 2;
GL.TYPE_LENGTH[ GL.FLOAT_VEC3 ] = GL.TYPE_LENGTH[ GL.INT_VEC3 ] = GL.TYPE_LENGTH[ GL.BOOL_VEC3 ] = 3;
GL.TYPE_LENGTH[ GL.FLOAT_VEC4 ] = GL.TYPE_LENGTH[ GL.INT_VEC4 ] = GL.TYPE_LENGTH[ GL.BOOL_VEC4 ] = 4;
GL.TYPE_LENGTH[ GL.FLOAT_MAT3 ] = 9;
GL.TYPE_LENGTH[ GL.FLOAT_MAT4 ] = 16;

GL.SAMPLER_2D = 35678;
GL.SAMPLER_3D = 35679;
GL.SAMPLER_CUBE = 35680;
GL.INT_SAMPLER_2D = 36298;
GL.INT_SAMPLER_3D = 36299;
GL.INT_SAMPLER_CUBE = 36300;
GL.UNSIGNED_INT_SAMPLER_2D = 36306;
GL.UNSIGNED_INT_SAMPLER_3D = 36307;
GL.UNSIGNED_INT_SAMPLER_CUBE = 36308;

GL.DEPTH_COMPONENT = 6402;
GL.ALPHA = 6406;
GL.RGB = 6407;
GL.RGBA = 6408;
GL.LUMINANCE = 6409;
GL.LUMINANCE_ALPHA = 6410;
GL.DEPTH_STENCIL = 34041;
GL.UNSIGNED_INT_24_8_WEBGL = 34042;

//webgl2 formats
GL.R8 = 33321;
GL.R16F = 33325;
GL.R32F = 33326;
GL.R8UI = 33330;
GL.RG8 = 33323;
GL.RG16F = 33327;
GL.RG32F = 33328;
GL.RGB8 = 32849;
GL.SRGB8 = 35905;
GL.RGB565 = 36194;
GL.R11F_G11F_B10F = 35898;
GL.RGB9_E5 = 35901;
GL.RGB16F = 34843;
GL.RGB32F = 34837;
GL.RGB8UI = 36221;
GL.RGBA8 = 32856;
GL.RGB5_A1 = 32855;
GL.RGBA16F = 34842;
GL.RGBA32F = 34836;
GL.RGBA8UI = 36220;
GL.RGBA16I = 36232;
GL.RGBA16UI = 36214;
GL.RGBA32I = 36226;
GL.RGBA32UI = 36208;

GL.NEAREST = 9728;
GL.LINEAR = 9729;
GL.NEAREST_MIPMAP_NEAREST = 9984;
GL.LINEAR_MIPMAP_NEAREST = 9985;
GL.NEAREST_MIPMAP_LINEAR = 9986;
GL.LINEAR_MIPMAP_LINEAR = 9987;

GL.REPEAT = 10497;
GL.CLAMP_TO_EDGE = 33071;
GL.MIRRORED_REPEAT = 33648;

GL.ZERO = 0;
GL.ONE = 1;
GL.SRC_COLOR = 768;
GL.ONE_MINUS_SRC_COLOR = 769;
GL.SRC_ALPHA = 770;
GL.ONE_MINUS_SRC_ALPHA = 771;
GL.DST_ALPHA = 772;
GL.ONE_MINUS_DST_ALPHA = 773;
GL.DST_COLOR = 774;
GL.ONE_MINUS_DST_COLOR = 775;
GL.SRC_ALPHA_SATURATE = 776;
GL.CONSTANT_COLOR = 32769;
GL.ONE_MINUS_CONSTANT_COLOR = 32770;
GL.CONSTANT_ALPHA = 32771;
GL.ONE_MINUS_CONSTANT_ALPHA = 32772;

GL.VERTEX_SHADER = 35633;
GL.FRAGMENT_SHADER = 35632;

GL.FRONT = 1028;
GL.BACK = 1029;
GL.FRONT_AND_BACK = 1032;

GL.NEVER = 512;
GL.LESS = 513;
GL.EQUAL = 514;
GL.LEQUAL = 515;
GL.GREATER = 516;
GL.NOTEQUAL = 517;
GL.GEQUAL = 518;
GL.ALWAYS = 519;

GL.KEEP = 7680;
GL.REPLACE = 7681;
GL.INCR = 7682;
GL.DECR = 7683;
GL.INCR_WRAP = 34055;
GL.DECR_WRAP = 34056;
GL.INVERT = 5386;

GL.STREAM_DRAW = 35040;
GL.STATIC_DRAW = 35044;
GL.DYNAMIC_DRAW = 35048;

GL.ARRAY_BUFFER = 34962;
GL.ELEMENT_ARRAY_BUFFER = 34963;

GL.POINTS = 0;
GL.LINES = 1;
GL.LINE_LOOP = 2;
GL.LINE_STRIP = 3;
GL.TRIANGLES = 4;
GL.TRIANGLE_STRIP = 5;
GL.TRIANGLE_FAN = 6;

GL.CW = 2304;
GL.CCW = 2305;

GL.CULL_FACE = 2884;
GL.DEPTH_TEST = 2929;
GL.BLEND = 3042;

GL.temp_vec3 = vec3.create();
GL.temp2_vec3 = vec3.create();
GL.temp_vec4 = vec4.create();
GL.temp_quat = quat.create();
GL.temp_mat3 = mat3.create();
GL.temp_mat4 = mat4.create();


global.DEG2RAD = 0.0174532925;
global.RAD2DEG = 57.295779578552306;
global.EPSILON = 0.000001;

vec3.ZERO = vec3.fromValues(0,0,0);
vec3.FRONT = vec3.fromValues(0,0,-1);
vec3.UP = vec3.fromValues(0,1,0);
vec3.RIGHT = vec3.fromValues(1,0,0);

/**
 * Tells if one number is power of two (used for textures)
 */
global.isPowerOfTwo = GL.isPowerOfTwo = function isPowerOfTwo(v)
{
    // logcA/logcB = logAB
    return ((Math.log(v) / Math.log(2)) % 1) == 0;
}

/**
 * Get nearest number that is power of two (used for textures)
 */
global.nearestPowerOfTwo = GL.nearestPowerOfTwo = function nearestPowerOfTwo(v)
{
    return Math.pow(2, Math.round(Math.log(v) / Math.log(2)));
}

/**
 * converts from polar to cartesian
 * out[0] == x, out[1] == z, out[2] == y
 */
global.polarToCartesian = function(out, azimuth, inclination, radius)
{
    out = out || vec3.create();
    out[0] = radius * Math.sin(inclination) * Math.cos(azimuth);
    out[1] = radius * Math.cos(inclination);
    out[2] = radius * Math.sin(inclination) * Math.sin(azimuth);
    return out;
}

/**
 * converts from cartesian to polar
 * out = [azimuth, inclination, radius]
 */
global.cartesianToPolar = function(out, x, y, z)
{
    out = out || vec3.create();
    out[2] = Math.sqrt(x*x + y*y + z*z);
    out[0] = Math.atan2(x, z);
    out[1] = Math.acos(z/out[2]);
    return out;
}

var typed_arrays = [Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array];
function typedToArray(){
    return Array.prototype.slice.call(this);
}

typed_arrays.forEach(function(v){
    if (!v.prototype.toJSON){
        Object.defineProperty(v.prototype, "toJSON", {
            value: typedToArray,
            enumerable: false,
            configurable: true,
            writable: true
        });
    }
});

Math.clamp = function(v, a, b){
    return (a>v? a:(b<v? b:v));
}

vec2.rotate = function(out, vec, angleInRad){
    var x = vec[0];
    var y = vec[1];
    var cos = Math.cos(angleInRad);
    var sin = Math.sin(angleInRad);
    out[0] = x * cos - y * sin;
	out[1] = x * sin + y * cos;
	return out;
}

vec3.zero = function(a){
    a[0] = a[1] = a[2] = 0.0;
    return a;
}

vec2.perpdot = function(a,b){
    return a[1] * b[0] + -a[0] * b[1];
}

vec2.computeSignedAngle = function(a, b){
    // |axb| = |a||b|sin(theta)
    // |a.b| = |a||b|cos(theta)
    // tan(theta) = |axb| / |a.b|
    return Math.atan2(vec2.perpdot(a, b), vec2.dot(a,b));
}

vec2.random = function(vec, scale){
    scale = scale || 1.0;
    vec[0] = Math.random() * scale;
    vec[1] = Math.random() * scale;
    return vec;
}

vec3.random = function(vec, scale){
	scale = scale || 1.0;
	vec[0] = Math.random() * scale;
	vec[1] = Math.random() * scale;
	vec[2] = Math.random() * scale;
	return vec;
}

vec3.zero = function(a){
    a[0] = a[1] = a[2] = 0.0;
    return a;
}

vec3.minValue = function(a){
    if (a[0] < a[1] && a[0] < a[2])
    {
        return a[0];
    }
    if (a[1] < a[2])
    {
        return a[1];
    }
    return a[2];
}

vec3.maxValue = function(a){
    if (a[0] > a[1] && a[0] > a[2])
    {
        return a[0];
    }
    if (a[1] > a[2])
    {
        return a[1];
    }
    return a[2];
}

vec3.addValue = function(out, a, v){
    out[0] = a[0] + v;
    out[1] = a[1] + v;
    out[2] = a[2] + v;
}

vec3.subValue = function(out, a, v){
    out[0] = a[0] - v;
    out[1] = a[1] - v;
    out[2] = a[2] - v;
}

vec3.toArray = function(vec){
    return [vec[0], vec[1], vec[2]];
}


vec3.rotateX = function(out,vec,angle_in_rad){
	var y = vec[1], z = vec[2];
	var cos = Math.cos(angle_in_rad);
	var sin = Math.sin(angle_in_rad);

	out[0] = vec[0];
	out[1] = y * cos - z * sin;
	out[2] = y * sin + z * cos;
	return out;
}

vec3.rotateY = function(out,vec,angle_in_rad){
	var x = vec[0], z = vec[2];
	var cos = Math.cos(angle_in_rad);
	var sin = Math.sin(angle_in_rad);

	out[0] = x * cos - z * sin;
	out[1] = vec[1];
	out[2] = x * sin + z * cos;
	return out;
}

vec3.rotateZ = function(out,vec,angle_in_rad){
	var x = vec[0], y = vec[1];
	var cos = Math.cos(angle_in_rad);
	var sin = Math.sin(angle_in_rad);

	out[0] = x * cos - y * sin;
	out[1] = x * sin + y * cos;
	out[2] = vec[2];
	return out;
}

vec3.signedAngle = function(from, to, axis){
	var unsignedAngle = vec3.angle( from, to );
	var cross_x = from[1] * to[2] - from[2] * to[1];
	var cross_y = from[2] * to[0] - from[0] * to[2];
	var cross_z = from[0] * to[1] - from[1] * to[0];
	var sign = Math.sign(axis[0] * cross_x + axis[1] * cross_y + axis[2] * cross_z);
	return unsignedAngle * sign;
}

vec3.polarToCartesian = function(out, v){
    var r = v[0];
	var lat = v[1];
	var lon = v[2];
	out[0] = r * Math.cos(lat) * Math.sin(lon);
	out[1] = r * Math.sin(lat);
	out[2] = r * Math.cos(lat) * Math.cos(lon);
	return out;
}

/**
 * 
 * @param {*} out 
 * @param {original vector} v 
 * @param {n is the vector which is parallel to reflect surface} n 
 */
vec3.reflect = function(out, v, n){
    var x = v[0]; var y = v[1]; var z = v[2];
	vec3.scale( out, n, -2 * vec3.dot(v,n) );
	out[0] += x;
	out[1] += y;
	out[2] += z;
	return out;
}

vec4.random = function(vec, scale){
    scale = scale || 1.0;
    vec[0] = Math.random() * scale;
    vec[1] = Math.random() * scale;
    vec[2] = Math.random() * scale;
    vec[3] = Math.random() * scale;
    return vec;
}

vec4.toArray = function(vec){
    return [vec[0], vec[1], vec[2], vec[3]];
}

/**
 * Matrix part
 */
(function(){
    mat3.IDENTITY = mat3.create();
    mat4.IDENTITY = mat4.create();

    mat4.toArray = function(mat){
        return [mat[0],mat[1],mat[2],mat[3],mat[4],mat[5],mat[6],mat[7],mat[8],mat[9],mat[10],mat[11],mat[12],mat[13],mat[14],mat[15]];
    };

    mat4.setUpAndOrthonormalize = function(out, m, up){
        if(m != out)
            mat4.copy(out,m);
        var right = out.subarray(0,3);
        vec3.normalize(out.subarray(4,7),up);
        var front = out.subarray(8,11);
        vec3.cross( right, up, front );
        vec3.normalize( right, right );
        vec3.cross( front, right, up );
        vec3.normalize( front, front );
    };

    mat4.multiplyVec3 = function(out, m, a) {
        var x = a[0], y = a[1], z = a[2];
        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        return out;
    };

    /**
     * out[0] = (ox / ow + 1) / 2; This line transfer coordinate in -1~1 to 0~1 space
     * @param {*} out 
     * @param {MVP or VP matrix} m 
     * @param {*} a 
     * @returns 
     */
    mat4.projectVec3 = function(out, m, a){
        var ix = a[0];
        var iy = a[1];
        var iz = a[2];

        var ox = m[0] * ix + m[4] * iy + m[8] * iz + m[12];
        var oy = m[1] * ix + m[5] * iy + m[9] * iz + m[13];
        var oz = m[2] * ix + m[6] * iy + m[10] * iz + m[14];
        var ow = m[3] * ix + m[7] * iy + m[11] * iz + m[15];

        out[0] = (ox / ow + 1) / 2;
        out[1] = (oy / ow + 1) / 2;
        out[2] = (oz / ow + 1) / 2;
        return out;
    };

    vec3.project = function(out, vec,  mvp, viewport) {
        viewport = viewport || gl.viewport_data;
    
        var m = mvp;
    
        var ix = vec[0];
        var iy = vec[1];
        var iz = vec[2];
    
        var ox = m[0] * ix + m[4] * iy + m[8] * iz + m[12];
        var oy = m[1] * ix + m[5] * iy + m[9] * iz + m[13];
        var oz = m[2] * ix + m[6] * iy + m[10] * iz + m[14];
        var ow = m[3] * ix + m[7] * iy + m[11] * iz + m[15];
    
        var projx =     (ox / ow + 1) / 2;
        var projy = 1 - (oy / ow + 1) / 2;
        var projz =     (oz / ow + 1) / 2;
    
        out[0] = projx * viewport[2] + viewport[0];
        out[1] = projy * viewport[3] + viewport[1];
        out[2] = projz; //ow
        return out;
    };

    var unprojectMat = mat4.create();
    var unprojectVec = vec4.create();
})();

})