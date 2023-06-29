(function (global) {
    // 16384 = 0100000000000000, which is used to clear data bit to bit
global.GL.COLOR_BUFFER_BIT = 16384;
global.GL.DEPTH_BUFFER_BIT = 256;
global.GL.STENCIL_BUFFER_BIT = 1024;

global.GL.TEXTURE_2D = 3553;
global.GL.TEXTURE_CUBE_MAP = 34067;
global.GL.TEXTURE_3D = 32879;

global.GL.TEXTURE_MAG_FILTER = 10240;
global.GL.TEXTURE_MIN_FILTER = 10241;
global.GL.TEXTURE_WRAP_S = 10242;
global.GL.TEXTURE_WRAP_T = 10243;

global.GL.BYTE = 5120;
global.GL.UNSIGNED_BYTE = 5121;
global.GL.SHORT = 5122;
global.GL.UNSIGNED_SHORT = 5123;
global.GL.INT = 5124;
global.GL.UNSIGNED_INT = 5125;
global.GL.FLOAT = 5126;
global.GL.HALF_FLOAT_OES = 36193; //webgl 1.0 only

//webgl2 formats
global.GL.HALF_FLOAT = 5131; 
global.GL.DEPTH_COMPONENT16 = 33189;
global.GL.DEPTH_COMPONENT24 = 33190;
global.GL.DEPTH_COMPONENT32F = 36012;

global.GL.FLOAT_VEC2 = 35664;
global.GL.FLOAT_VEC3 = 35665;
global.GL.FLOAT_VEC4 = 35666;
global.GL.INT_VEC2 = 35667;
global.GL.INT_VEC3 = 35668;
global.GL.INT_VEC4 = 35669;
global.GL.BOOL = 35670;
global.GL.BOOL_VEC2 = 35671;
global.GL.BOOL_VEC3 = 35672;
global.GL.BOOL_VEC4 = 35673;
global.GL.FLOAT_MAT2 = 35674;
global.GL.FLOAT_MAT3 = 35675;
global.GL.FLOAT_MAT4 = 35676;

//used to know the amount of data to reserve per uniform
global.GL.TYPE_LENGTH = {};
global.GL.TYPE_LENGTH[ GL.FLOAT ] = GL.TYPE_LENGTH[ GL.INT ] = GL.TYPE_LENGTH[ GL.BYTE ] = GL.TYPE_LENGTH[ GL.BOOL ] = 1;
global.GL.TYPE_LENGTH[ GL.FLOAT_VEC2 ] = GL.TYPE_LENGTH[ GL.INT_VEC2 ] = GL.TYPE_LENGTH[ GL.BOOL_VEC2 ] = 2;
global.GL.TYPE_LENGTH[ GL.FLOAT_VEC3 ] = GL.TYPE_LENGTH[ GL.INT_VEC3 ] = GL.TYPE_LENGTH[ GL.BOOL_VEC3 ] = 3;
global.GL.TYPE_LENGTH[ GL.FLOAT_VEC4 ] = GL.TYPE_LENGTH[ GL.INT_VEC4 ] = GL.TYPE_LENGTH[ GL.BOOL_VEC4 ] = 4;
global.GL.TYPE_LENGTH[ GL.FLOAT_MAT3 ] = 9;
global.GL.TYPE_LENGTH[ GL.FLOAT_MAT4 ] = 16;

global.GL.SAMPLER_2D = 35678;
global.GL.SAMPLER_3D = 35679;
global.GL.SAMPLER_CUBE = 35680;
global.GL.INT_SAMPLER_2D = 36298;
global.GL.INT_SAMPLER_3D = 36299;
global.GL.INT_SAMPLER_CUBE = 36300;
global.GL.UNSIGNED_INT_SAMPLER_2D = 36306;
global.GL.UNSIGNED_INT_SAMPLER_3D = 36307;
global.GL.UNSIGNED_INT_SAMPLER_CUBE = 36308;

global.GL.DEPTH_COMPONENT = 6402;
global.GL.ALPHA = 6406;
global.GL.RGB = 6407;
global.GL.RGBA = 6408;
global.GL.LUMINANCE = 6409;
global.GL.LUMINANCE_ALPHA = 6410;
global.GL.DEPTH_STENCIL = 34041;
global.GL.UNSIGNED_INT_24_8_WEBGL = 34042;

//webgl2 formats
global.GL.R8 = 33321;
global.GL.R16F = 33325;
global.GL.R32F = 33326;
global.GL.R8UI = 33330;
global.GL.RG8 = 33323;
global.GL.RG16F = 33327;
global.GL.RG32F = 33328;
global.GL.RGB8 = 32849;
global.GL.SRGB8 = 35905;
global.GL.RGB565 = 36194;
global.GL.R11F_G11F_B10F = 35898;
global.GL.RGB9_E5 = 35901;
global.GL.RGB16F = 34843;
global.GL.RGB32F = 34837;
global.GL.RGB8UI = 36221;
global.GL.RGBA8 = 32856;
global.GL.RGB5_A1 = 32855;
global.GL.RGBA16F = 34842;
global.GL.RGBA32F = 34836;
global.GL.RGBA8UI = 36220;
global.GL.RGBA16I = 36232;
global.GL.RGBA16UI = 36214;
global.GL.RGBA32I = 36226;
global.GL.RGBA32UI = 36208;

global.GL.NEAREST = 9728;
global.GL.LINEAR = 9729;
global.GL.NEAREST_MIPMAP_NEAREST = 9984;
global.GL.LINEAR_MIPMAP_NEAREST = 9985;
global.GL.NEAREST_MIPMAP_LINEAR = 9986;
global.GL.LINEAR_MIPMAP_LINEAR = 9987;

global.GL.REPEAT = 10497;
global.GL.CLAMP_TO_EDGE = 33071;
global.GL.MIRRORED_REPEAT = 33648;

global.GL.ZERO = 0;
global.GL.ONE = 1;
global.GL.SRC_COLOR = 768;
global.GL.ONE_MINUS_SRC_COLOR = 769;
global.GL.SRC_ALPHA = 770;
global.GL.ONE_MINUS_SRC_ALPHA = 771;
global.GL.DST_ALPHA = 772;
global.GL.ONE_MINUS_DST_ALPHA = 773;
global.GL.DST_COLOR = 774;
global.GL.ONE_MINUS_DST_COLOR = 775;
global.GL.SRC_ALPHA_SATURATE = 776;
global.GL.CONSTANT_COLOR = 32769;
global.GL.ONE_MINUS_CONSTANT_COLOR = 32770;
global.GL.CONSTANT_ALPHA = 32771;
global.GL.ONE_MINUS_CONSTANT_ALPHA = 32772;

global.GL.VERTEX_SHADER = 35633;
global.GL.FRAGMENT_SHADER = 35632;

global.GL.FRONT = 1028;
global.GL.BACK = 1029;
global.GL.FRONT_AND_BACK = 1032;

global.GL.NEVER = 512;
global.GL.LESS = 513;
global.GL.EQUAL = 514;
global.GL.LEQUAL = 515;
global.GL.GREATER = 516;
global.GL.NOTEQUAL = 517;
global.GL.GEQUAL = 518;
global.GL.ALWAYS = 519;

global.GL.KEEP = 7680;
global.GL.REPLACE = 7681;
global.GL.INCR = 7682;
global.GL.DECR = 7683;
global.GL.INCR_WRAP = 34055;
global.GL.DECR_WRAP = 34056;
global.GL.INVERT = 5386;

global.GL.STREAM_DRAW = 35040;
global.GL.STATIC_DRAW = 35044;
global.GL.DYNAMIC_DRAW = 35048;

global.GL.ARRAY_BUFFER = 34962;
global.GL.ELEMENT_ARRAY_BUFFER = 34963;

global.GL.POINTS = 0;
global.GL.LINES = 1;
global.GL.LINE_LOOP = 2;
global.GL.LINE_STRIP = 3;
global.GL.TRIANGLES = 4;
global.GL.TRIANGLE_STRIP = 5;
global.GL.TRIANGLE_FAN = 6;

global.GL.CW = 2304;
global.GL.CCW = 2305;

global.GL.CULL_FACE = 2884;
global.GL.DEPTH_TEST = 2929;
global.GL.BLEND = 3042;
})(typeof(window) != "undefined" ? window:(typeof(self) != "undefined" ? self:global));