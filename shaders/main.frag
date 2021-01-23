#version 300 es

/* Hybrid graphing render engine
 * built by Griffith T.
 * https://github.com/KiranWells/
 */

#define pi 3.14159265358
#define MAX_STEPS 1000
#define MAX_ITERATIONS 16
#define NORMAL_D 0.01

precision lowp float;

uniform float u_time;
uniform vec2 u_resolution;

uniform vec2 u_angles;
uniform float u_fov;
uniform float u_zoom;
uniform float u_bounds;
uniform float u_step_size;
uniform float u_line_width;
${variables}

#define MIN_DIST (u_bounds * u_step_size)

out vec4 Color;

struct Ray {
  vec3 origin;
  vec3 direction;
};

// credit for these rotation functions goes to CodeParade in his marble marcher on github
// https://github.com/HackerPoet/MarbleMarcher/blob/master/assets/frag.glsl
void rotX(inout vec3 z, float a) {
  z.yz = vec2(
    cos(a)*z.y + sin(a)*z.z, 
    cos(a)*z.z - sin(a)*z.y
  );
}

void rotY(inout vec3 z, float a) {
  z.xz = vec2(
    cos(a)*z.x - sin(a)*z.z, 
    cos(a)*z.z + sin(a)*z.x
  );
}

void rotZ(inout vec3 z, float a) {
  z.xy = vec2(
    cos(a)*z.x + sin(a)*z.y, 
    cos(a)*z.y - sin(a)*z.x
  );
}

// fix the issues with negative powers
float cust_pow(float b, float ex) {
  if (ex < 0.) {
    if (mod(ex, 2.) < 0.1) return 1./pow(abs(b), abs(ex));
    return 1./(pow(abs(b), ex) * (b / abs(b)));
  }
  if (mod(ex, 2.) < 0.1) return pow(abs(b), ex);
  return pow(abs(b), ex) * (b / abs(b));
}

FOREACH {
  float f${i}(vec3 pt) {
    // polar coordinates support
    // radius
    float r = cust_pow(pt.x * pt.x + pt.y * pt.y, 0.5);
    float rho = length(pt);
    // phi
    float theta = atan(pt.x/pt.y);
    // theta
    float phi = acos(pt.z/r);
    return ${eq};
  }
}

FOREACH {
  bool f_i${i}(vec3 pt) {
    // polar coordinates support
    // radius
    float r = cust_pow(pt.x * pt.x + pt.y * pt.y, 0.5);
    float rho = length(pt);
    // phi
    float theta = atan(pt.x/pt.y);
    // theta
    float phi = acos(pt.z/r);
    return ${ineq};
  }
}

vec3 getRayDirection() {
  // get the direction of the ray from the origin for this pixel
  vec2 pixel = gl_FragCoord.xy / u_resolution.xy;
  pixel.x = (pixel.x * 2.0 - 1.0) / u_resolution.y * u_resolution.x * tan(u_fov * pi / 360.0);
  pixel.y = -(1.0 - 2.0 * pixel.y) * tan(u_fov * pi / 360.0);
  vec3 pixelDir = normalize(
    vec3(pixel, 1.0)
  );

  return pixelDir;
}

Ray getCameraRay(in float zoom, in float angY, in float angX) {
  //generates the camera from orbit controls
  angY /= 180.0 / pi;
  angX /= 180.0 / pi;
  vec3 position = vec3(0.0, 0.0, -zoom);
  rotX(position, angX);
  rotY(position, angY);
  vec3 direction = getRayDirection();
  rotX(direction, angX);
  rotY(direction, angY);
  return Ray(position, direction);
}

vec3 min3(in vec3 a, in vec3 b) {
  return vec3(
    min(a.x, b.x),
    min(a.y, b.y),
    min(a.z, b.z)
  );
}

vec3 max3(in vec3 a, in vec3 b) {
  return vec3(
    max(a.x, b.x),
    max(a.y, b.y),
    max(a.z, b.z)
  );
}

bool sphereIntersect(in Ray r, out float depth, out vec3 pos) {
  vec3 L = 0. - r.origin;
  float tc = dot(L, r.direction);
  if (tc < 0.) {
    //no hit
    return false;
  }
  float d = length(0. - (r.origin + r.direction * tc));
  if (d > u_bounds) {
    //no hit
    return false;
  }
  float t1c = sqrt(u_bounds * u_bounds - d * d);
  depth = tc - t1c;
  pos = r.origin + r.direction * (tc - t1c);
  //n = normalize(0. - r.origin + r.direction * (tc - t1c));
  return true;
}

// adapted from the Scratchapixel version
bool cubeIntersect(in Ray r, out float depth, out vec3 n) {
  float minbox = -u_bounds;
  float maxbox = u_bounds;
  vec3 t1 = (minbox - r.origin) / r.direction;
  vec3 t2 = (maxbox - r.origin) / r.direction;
  vec3 tmins = min(t1,t2);
  vec3 tmaxs = max(t1,t2);
  if ((tmins.x > tmaxs.y) || (tmins.y > tmaxs.x))
    return false;
  float tmin = min(tmins.x, tmins.y);
  float tmax = max(tmaxs.x, tmaxs.y);
  if ((tmin > tmaxs.z) || (tmins.z > tmax))
    return false;
  tmin = min(tmin, tmins.z);
  tmax = max(tmax, tmaxs.z);
  depth = abs(tmin);
  return true;
}

FOREACH {
  float binarySearch${i}(in Ray r) {
    // uses binary search to get closer to the zero
    float start = -MIN_DIST;
    float end = 0.;
    float f_a = f${i}(r.origin + r.direction * start);
    float f_b = f${i}(r.origin + r.direction * end);
    float diff = f_a;
    float c;
    for (int i = 0; i < MAX_ITERATIONS; i++) {
      c = (start + end) * 0.5;
      vec3 p = r.origin + r.direction * c;
      if (f${i}(p) * diff < 0.0) {
        //f${i}(a) is the opposite sign of f${i}(c)
        end = c;
      } else {
        start = c;
      }
    }
    return (start + end) * 0.5;
  }
}

bool testPoint(in Ray r, out vec3 pos, out vec3 norm, out float hue) {
  float mint = 100.;
  FOREACH {
    float t${i} = binarySearch${i}(r);

    if (abs(f${i}(r.origin + r.direction * t${i})) < MIN_DIST * 0.01)
    if (t${i} < mint) {
      mint = t${i};
      hue = ${i}. / (${MAX_I}. - 0.5);
    }
  }
  pos = r.origin + r.direction * mint;
  // test for outside the bounds
  if (length(pos) > u_bounds) return false;
  float minf = 1.;
  FOREACH {
    minf = min(abs(f${i}(pos)), minf);
  }
  // test for a false positive
  if (minf > sqrt(u_bounds) * 0.01) {return false;}
  vec3 xDir = vec3(NORMAL_D, 0.0, 0.0);
  vec3 yDir = vec3(0.0, NORMAL_D, 0.0);
  vec3 zDir = vec3(0.0, 0.0, NORMAL_D);
  FOREACH {
    if (mint == t${i}) {
        norm = normalize(
        vec3(f${i}(pos+xDir)-f${i}(pos-xDir),
            f${i}(pos+yDir)-f${i}(pos-yDir),
            f${i}(pos+zDir)-f${i}(pos-zDir)));
    }
  }
  return true;
}

bool marchRay(in Ray r, out vec3 position, out vec3 normal, out float hue) {
  FOREACH {
    float a0${i} = f${i}(r.origin);
  }
  float n = -1.;
  for (int i = 0; i < MAX_STEPS; i++) {
    r.origin += r.direction * MIN_DIST;
    if (length(r.origin) > u_bounds) {
      if (testPoint(r, position, normal, hue))
        return true;
      else 
        return false;
    }
    FOREACH {
      float a${i} = f${i}(r.origin);
      if (a${i} * a0${i} <= 0. || abs(a${i}) < MIN_DIST)
        if (testPoint(r, position, normal, hue))
          return true;
    }
  }
  position = r.origin;
  return false;
}

// adapted from https://stackoverflow.com/questions/9234724/how-to-change-hue-of-a-texture-with-glsl
// This is not accurate
vec3 hue_rotate_(in vec3 c, in float hue) {
  const mat3 rgb2yiq = mat3(0.299, 0.587, 0.114, 0.595716, -0.274453, -0.321263, 0.211456, -0.522591, 0.311135);
  const mat3 yiq2rgb = mat3(1.0, 0.9563, 0.6210, 1.0, -0.2721, -0.6474, 1.0, -1.1070, 1.7046);
  vec3 yColor = rgb2yiq * c; 

  float originalHue = atan(yColor.b, yColor.g);
  float finalHue = originalHue + hue * 2. * pi;

  float chroma = sqrt(yColor.b*yColor.b+yColor.g*yColor.g);

  vec3 yFinalColor = vec3(yColor.r, chroma * cos(finalHue), chroma * sin(finalHue));
  return yiq2rgb*yFinalColor;
}

// adapted from https://stackoverflow.com/questions/9234724/how-to-change-hue-of-a-texture-with-glsl
vec3 hue_rotate(in vec3 c, in float hueAdjust) {
  const vec4  kRGBToYPrime = vec4 (0.299, 0.587, 0.114, 0.0);
  const vec4  kRGBToI     = vec4 (0.596, -0.275, -0.321, 0.0);
  const vec4  kRGBToQ     = vec4 (0.212, -0.523, 0.311, 0.0);

  const vec4  kYIQToR   = vec4 (1.0, 0.956, 0.621, 0.0);
  const vec4  kYIQToG   = vec4 (1.0, -0.272, -0.647, 0.0);
  const vec4  kYIQToB   = vec4 (1.0, -1.107, 1.704, 0.0);

  // Sample the input pixel
  vec4    color   = vec4(c, 1.0);

  // Convert to YIQ
  float   YPrime  = dot (color, kRGBToYPrime);
  float   I      = dot (color, kRGBToI);
  float   Q      = dot (color, kRGBToQ);

  // Calculate the hue and chroma
  float   hue     = atan (Q, I);
  float   chroma  = sqrt (I * I + Q * Q);

  // Make the user's adjustments
  hue += hueAdjust * 2. * pi;

  // Convert back to YIQ
  Q = chroma * sin (hue);
  I = chroma * cos (hue);

  // Convert back to RGB
  vec4    yIQ   = vec4 (YPrime, I, Q, 0.0);
  color.r = dot (yIQ, kYIQToR);
  color.g = dot (yIQ, kYIQToG);
  color.b = dot (yIQ, kYIQToB);

  // Save the result
  return color.rgb;
}

vec3 shade(in vec3 p, in vec3 n, in Ray r, in float hue) {
  vec3 color1 = vec3(0.4588, 0.8196, 0.3176);
  vec3 color2 = vec3(0.9098, 0.9412, 0.4549);
  vec3 color3 = vec3(0.1804, 0.8275, 0.6314);
  const vec3 sunDir = normalize(vec3(0.8549, 0.7176, 0.2667));
  float diffuse = abs(dot(n, sunDir));
  // vec3 reflection = 2.0 * dot(n, -1.0 * sunDir) * n - sunDir;
  // reflection = normalize(reflection);
  // vec3 camera = r.direction;rho = csin(bxyz) + a
  // float specular = pow(clamp(dot(reflection, camera), 0.0, 1.0), 64.0);
  vec3 grad = mix(
    mix(color1, color2, abs(p.x / u_bounds)),
    color3,
    diffuse);
  return hue_rotate(grad, hue);
}

void drawAxes(in Ray fromCamera, in float t) {
  if (u_line_width < 0.01) return;
  vec3 intercept = -fromCamera.origin / fromCamera.direction;
  if (intercept.x < 0.0) {intercept.x = 100000.0;}
  if (intercept.y < 0.0) {intercept.y = 100000.0;}
  if (intercept.z < 0.0) {intercept.z = 100000.0;}
  if (!(t < intercept.x)) {
    vec3 hit = fromCamera.origin + fromCamera.direction * intercept.x;
    if (!(length(hit) > u_bounds) && (mod(hit.y, 1.0) < u_line_width || mod(hit.z, 1.0) < u_line_width)) {
      Color.rgb = mix(Color.rgb, vec3(0.0), 0.1);
      Color.a += 0.1;
    }
  }
  if (!(t < intercept.y)) {
    vec3 hit = fromCamera.origin + fromCamera.direction * intercept.y;
    if (!(length(hit) > u_bounds) && (mod(hit.x, 1.0) < u_line_width || mod(hit.z, 1.0) < u_line_width)) {
      Color.rgb = mix(Color.rgb, vec3(0.0), 0.1);
      Color.a += 0.1;
    }
  }
  if (!(t < intercept.z)) {
    vec3 hit = fromCamera.origin + fromCamera.direction * intercept.z;
    if (!(length(hit) > u_bounds) && (mod(hit.y, 1.0) < u_line_width || mod(hit.x, 1.0) < u_line_width)) {
      Color.rgb = mix(Color.rgb, vec3(0.0), 0.1);
      Color.a += 0.1;
    }
  }
  
}

bool testInequality(in vec3 pos, out vec3 normal, out float hue) {
  FOREACH {
    if (f_i${i}(pos)) {
      normal = normalize(pos);
      hue = ${i}. / ${MAX_I}.;
      return true;
    }
  }
  return false;
}

void main() {
  Ray fromCamera = getCameraRay(u_zoom, u_angles.x, u_angles.y);
  float depth;
  vec3 pos;
  vec3 normal;
  float hue = 0.;
  vec4 color = vec4(0.0);
  // find where we should start looking
  if (length(fromCamera.origin) < u_bounds)
    // we are in the bounds, start at the camera
    pos = fromCamera.origin;
  else
    // find where the ray hits the sphere
    if (!sphereIntersect(fromCamera, depth, pos))
      return;
  if (!testInequality(pos, normal, hue))
    // we have hit the bounds, so march through them
    if (!marchRay(Ray(pos, fromCamera.direction), pos, normal, hue)) {
      drawAxes(fromCamera, 10000.0);
      return;
    }
  Color.a = 1.0;
  Color.rgb = vec3(shade(pos, normal, fromCamera, hue));
  float t = length(fromCamera.origin - pos);
  drawAxes(fromCamera, t);
}