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

    /**
     * This function transfer vector in 0~1 to -1~1
     * 
     * @param {*} out 
     * @param {*} vec 
     * @param {*} viewprojection 
     * @param {viewport[2] = viewport width, viewport[3] = viewport height} viewport 
     * @returns 
     */
    vec3.unproject = function(out, vec, viewprojection, viewport){
        unprojectVec[0] = (vec[0] - viewport[0]) * 2.0 / viewport[2] - 1.0;
        unprojectVec[1] = (vec[1] - viewport[1]) * 2.0 / viewport[3] - 1.0;
        unprojectVec[2] = 2.0 * vec[2] - 1.0;
        unprojectVec[3] = 1.0;
        
        if(!mat4.invert(unprojectMat,viewprojection)) 
            return null;
        
        vec4.transformMat4(unprojectVec, unprojectVec, unprojectMat);
        if(unprojectVec[3] === 0.0) 
            return null;

        out[0] = unprojectVec[0] / unprojectVec[3];
        out[1] = unprojectVec[1] / unprojectVec[3];
        out[2] = unprojectVec[2] / unprojectVec[3];
        
        return out;
    }

    mat4.rotateVec3 = function(out, m, a) {
        var x = a[0], y = a[1], z = a[2];
        out[0] = m[0] * x + m[4] * y + m[8] * z;
        out[1] = m[1] * x + m[5] * y + m[9] * z;
        out[2] = m[2] * x + m[6] * y + m[10] * z;
        return out;
    };

    mat4.fromTranslationFrontTop = function (out, pos, front, top){
        vec3.cross(out.subarray(0,3), front, top);
        out.set(top,4);
        out.set(front,8);
        out.set(pos,12);
        return out;
    }

    mat4.translationMatrix = function (v){
        var out = mat4.create();
        out[12] = v[0];
        out[13] = v[1];
        out[14] = v[2];
        return out;
    }

    mat4.setTranslation = function (out, v){
        out[12] = v[0];
        out[13] = v[1];
        out[14] = v[2];
        return out;
    }

    mat4.getTranslation = function (out, matrix){
        out[0] = matrix[12];
        out[1] = matrix[13];
        out[2] = matrix[14];
        return out;
    }

    //returns the matrix without rotation
    mat4.toRotationMat4 = function (out, mat) {
        mat4.copy(out,mat);
        out[12] = out[13] = out[14] = 0.0;
        return out;
    };

    mat4.swapRows = function(out, mat, row, row2){
        if(out != mat)
        {
            mat4.copy(out, mat);
            out[4*row] = mat[4*row2];
            out[4*row+1] = mat[4*row2+1];
            out[4*row+2] = mat[4*row2+2];
            out[4*row+3] = mat[4*row2+3];
            out[4*row2] = mat[4*row];
            out[4*row2+1] = mat[4*row+1];
            out[4*row2+2] = mat[4*row+2];
            out[4*row2+3] = mat[4*row+3];
            return out;
        }

        var temp = new Float32Array(matrix.subarray(row*4,row*5));
        matrix.set( matrix.subarray(row2*4,row2*5), row*4 );
        matrix.set( temp, row2*4 );
        return out;
    }

    //used in skinning
    mat4.scaleAndAdd = function(out, mat, mat2, v)
    {
        out[0] = mat[0] + mat2[0] * v; 	out[1] = mat[1] + mat2[1] * v; 	out[2] = mat[2] + mat2[2] * v; 	out[3] = mat[3] + mat2[3] * v;
        out[4] = mat[4] + mat2[4] * v; 	out[5] = mat[5] + mat2[5] * v; 	out[6] = mat[6] + mat2[6] * v; 	out[7] = mat[7] + mat2[7] * v;
        out[8] = mat[8] + mat2[8] * v; 	out[9] = mat[9] + mat2[9] * v; 	out[10] = mat[10] + mat2[10] * v; 	out[11] = mat[11] + mat2[11] * v;
        out[12] = mat[12] + mat2[12] * v;  out[13] = mat[13] + mat2[13] * v; 	out[14] = mat[14] + mat2[14] * v; 	out[15] = mat[15] + mat2[15] * v;
        return out;
    }
})();

/**
 * lambda0 = cos(theta/2)
 * lambdai = p*sin(theta/2)
 * @param {*} axis 
 * @param {*} rad 
 * @returns 
 */
quat.fromAxisAngle = function(axis, rad)
{
    var out = quat.create();
    rad = rad * 0.5;
    var s = Math.sin(rad);
    out[0] = s * axis[0];
    out[1] = s * axis[1];
    out[2] = s * axis[2];
    out[3] = Math.cos(rad);
    return out;
}

quat.lookRotation = (function(){
	var vector = vec3.create();
	var vector2 = vec3.create();
	var vector3 = vec3.create();

	return function( q, front, up )
	{
		vec3.normalize(vector,front);
		vec3.cross( vector2, up, vector );
		vec3.normalize(vector2,vector2);
		vec3.cross( vector3, vector, vector2 );

		var m00 = vector2[0];
		var m01 = vector2[1];
		var m02 = vector2[2];
		var m10 = vector3[0];
		var m11 = vector3[1];
		var m12 = vector3[2];
		var m20 = vector[0];
		var m21 = vector[1];
		var m22 = vector[2];

		var num8 = (m00 + m11) + m22;

		 if (num8 > 0)
		 {
			 var num = Math.sqrt(num8 + 1);
			 q[3] = num * 0.5;
			 num = 0.5 / num;
			 q[0] = (m12 - m21) * num;
			 q[1] = (m20 - m02) * num;
			 q[2] = (m01 - m10) * num;
			 return q;
		 }
		 if ((m00 >= m11) && (m00 >= m22))
		 {
			 var num7 = Math.sqrt(((1 + m00) - m11) - m22);
			 var num4 = 0.5 / num7;
			 q[0] = 0.5 * num7;
			 q[1] = (m01 + m10) * num4;
			 q[2] = (m02 + m20) * num4;
			 q[3] = (m12 - m21) * num4;
			 return q;
		 }
		 if (m11 > m22)
		 {
			 var num6 = Math.sqrt(((1 + m11) - m00) - m22);
			 var num3 = 0.5 / num6;
			 q[0] = (m10+ m01) * num3;
			 q[1] = 0.5 * num6;
			 q[2] = (m21 + m12) * num3;
			 q[3] = (m20 - m02) * num3;
			 return q; 
		 }
		 var num5 = Math.sqrt(((1 + m22) - m00) - m11);
		 var num2 = 0.5 / num5;
		 q[0] = (m20 + m02) * num2;
		 q[1] = (m21 + m12) * num2;
		 q[2] = 0.5 * num5;
		 q[3] = (m01 - m10) * num2;
		 return q;
	};
})();

/**
 * Change quaternion to euler angle
 * @param {*} out 
 * @param {*} q 
 * @returns 
 */
quat.toEuler = function(out, q)
{
    var heading = Math.atan2(2*q[1]*q[3] - 2*q[0]*q[2], 1 - 2*q[1]*q[1] - 2*q[2]*q[2]);
    var attitude = Math.asin(2*q[0]*q[1] + 2*q[2]*q[3]);
    var bank = Math.atan2(2*q[0]*q[3] - 2*q[1]*q[2], 1 - 2*q[0]*q[0] - 2*q[2]*q[2]);
	if(!out)
		out = vec3.create();
	vec3.set(out, heading, attitude, bank);
	return out;
}

quat.fromEuler = function(out, vec) {
	var heading = vec[0];
	var attitude = vec[1];
	var bank = vec[2];

	var C1 = Math.cos(heading); //yaw
	var C2 = Math.cos(attitude); //pitch
	var C3 = Math.cos(bank); //roll
	var S1 = Math.sin(heading);
	var S2 = Math.sin(attitude);
	var S3 = Math.sin(bank);

	var w = Math.sqrt(1.0 + C1 * C2 + C1*C3 - S1 * S2 * S3 + C2*C3) * 0.5;
	if(w == 0.0)
	{
		w = 0.000001;
		//quat.set(out, 0,0,0,1 );
		//return out;
	}

	var x = (C2 * S3 + C1 * S3 + S1 * S2 * C3) / (4.0 * w);
	var y = (S1 * C2 + S1 * C3 + C1 * S2 * S3) / (4.0 * w);
	var z = (-S1 * S3 + C1 * S2 * C3 + S2) /(4.0 * w);
	quat.set(out, x,y,z,w );
	quat.normalize(out,out);
	return out;
};


//not tested, it gives weird results sometimes
quat.fromMat4 = function(out,m)
{
	var trace = m[0] + m[5] + m[10];
	if ( trace > 0.0 )
	{
		var s = Math.sqrt( trace + 1.0 );
		out[3] = s * 0.5;//w
		var recip = 0.5 / s;
		out[0] = ( m[9] - m[6] ) * recip; //2,1  1,2
		out[1] = ( m[8] - m[2] ) * recip; //0,2  2,0
		out[2] = ( m[4] - m[1] ) * recip; //1,0  0,1
	}
	else
	{
		var i = 0;
		if( m[5] > m[0] )
		 i = 1;
		if( m[10] > m[i*4+i] )
		 i = 2;
		var j = ( i + 1 ) % 3;
		var k = ( j + 1 ) % 3;
		var s = Math.sqrt( m[i*4+i] - m[j*4+j] - m[k*4+k] + 1.0 );
		out[i] = 0.5 * s;
		var recip = 0.5 / s;
		out[3] = ( m[k*4+j] - m[j*4+k] ) * recip;//w
		out[j] = ( m[j*4+i] + m[i*4+j] ) * recip;
		out[k] = ( m[k*4+i] + m[i*4+k] ) * recip;
	}
	quat.normalize(out,out);
}

//col according to common matrix notation, here are stored as rows
vec3.getMat3Column = function(out, m, index )
{
	out[0] = m[index*3];
	out[1] = m[index*3 + 1];
	out[2] = m[index*3 + 2];
	return out;
}

mat3.setColumn = function(out, v, index )
{
	out[index*3] = v[0];
	out[index*3+1] = v[1];
	out[index*3+2] = v[2];
	return out;
}


//http://matthias-mueller-fischer.ch/publications/stablePolarDecomp.pdf
//reusing the previous quaternion as an indicator to keep perpendicularity
quat.fromMat3AndQuat = (function(){
	var temp_mat3 = mat3.create();
	var temp_quat = quat.create();
	var Rcol0 = vec3.create();
	var Rcol1 = vec3.create();
	var Rcol2 = vec3.create();
	var Acol0 = vec3.create();
	var Acol1 = vec3.create();
	var Acol2 = vec3.create();
	var RAcross0 = vec3.create();
	var RAcross1 = vec3.create();
	var RAcross2 = vec3.create();
	var omega = vec3.create();
	var axis = mat3.create();

	return function( q, A, max_iter )
	{
		max_iter = max_iter || 25;
		for (var iter = 0; iter < max_iter; ++iter)
		{
			var R = mat3.fromQuat( temp_mat3, q );
			vec3.getMat3Column(Rcol0,R,0);
			vec3.getMat3Column(Rcol1,R,1);
			vec3.getMat3Column(Rcol2,R,2);
			vec3.getMat3Column(Acol0,A,0);
			vec3.getMat3Column(Acol1,A,1);
			vec3.getMat3Column(Acol2,A,2);
			vec3.cross( RAcross0, Rcol0, Acol0 );
			vec3.cross( RAcross1, Rcol1, Acol1 );
			vec3.cross( RAcross2, Rcol2, Acol2 );
			vec3.add( omega, RAcross0, RAcross1 );
			vec3.add( omega, omega, RAcross2 );
			var d = 1.0 / Math.abs( vec3.dot(Rcol0,Acol0) + vec3.dot(Rcol1,Acol1) + vec3.dot(Rcol2,Acol2) ) + 1.0e-9;
			vec3.scale( omega, omega, d );
			var w = vec3.length(omega);
			if (w < 1.0e-9)
				break;
			vec3.scale(omega,omega,1/w); //normalize
			quat.setAxisAngle( temp_quat, omega, w );
			quat.mul( q, temp_quat, q );
			quat.normalize(q,q);
		}
		return q;
	};
})();

//http://number-none.com/product/IK%20with%20Quaternion%20Joint%20Limits/
quat.rotateToFrom = (function(){ 
	var tmp = vec3.create();
	return function(out, v1, v2)
	{
		out = out || quat.create();
		var axis = vec3.cross(tmp, v1, v2);
		var dot = vec3.dot(v1, v2);
		if( dot < -1 + 0.01){
			out[0] = 0;
			out[1] = 1; 
			out[2] = 0; 
			out[3] = 0; 
			return out;
		}
		out[0] = axis[0] * 0.5;
		out[1] = axis[1] * 0.5; 
		out[2] = axis[2] * 0.5; 
		out[3] = (1 + dot) * 0.5; 
		quat.normalize(out, out); 
		return out;    
	}
})();

quat.lookAt = (function(){ 
	var axis = vec3.create();
	
	return function( out, forwardVector, up )
	{
		var dot = vec3.dot( vec3.FRONT, forwardVector );

		if ( Math.abs( dot - (-1.0)) < 0.000001 )
		{
			out.set( vec3.UP );
			out[3] = Math.PI;
			return out;
		}
		if ( Math.abs(dot - 1.0) < 0.000001 )
		{
			return quat.identity( out );
		}

		var rotAngle = Math.acos( dot );
		vec3.cross( axis, vec3.FRONT, forwardVector );
		vec3.normalize( axis, axis );
		quat.setAxisAngle( out, axis, rotAngle );
		return out;
	}
})();

})