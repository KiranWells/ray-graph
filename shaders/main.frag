#version 300 es

/* Hybrid graphing render engine
 * built by Griffith T.
 * https://github.com/KiranWells/
 */

precision lowp float; // for speed. highp didn't seem to make a difference.

uniform float u_time;
uniform vec2 u_resolution;

uniform vec2 u_angles;
uniform float u_fov;
uniform float u_zoom;
uniform float u_bounds;
uniform float u_step_size;
uniform float u_line_width;
uniform float u_spacing;
uniform vec3 u_scale;
${variables}

#define pi 3.14159265358979323846264
#define e 2.7182818284590452353602874713527
// not the intended way, but this works
#define u_phi_0 1.618033988749894848204586834
#define MAX_STEPS 1000
#define MAX_ITERATIONS 10
#define NORMAL_D 0.01
#define DELTA_X 0.0001 * u_bounds
#define MIN_DIST (u_bounds * u_step_size)

// float number hacks
#define NaN 0./0.
#define Inf 1./0.

out vec4 Color;

struct Ray {
  vec3 origin;
  vec3 direction;
};

// credit for these rotation functions goes to CodeParade in his marble marcher on GitHub
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
  float r = pow(b,ex); // check if the power was correct
  if (b < 0. && r == 0.) {
    // the power is incorrect for most cases
    return NaN;
  }
  return pow(b, ex);
}

FOREACH {
  float f${i}(vec3 pt) {
    pt /= u_scale;
    // polar coordinates support
    // cylindrical radius
    float r = cust_pow(pt.x * pt.x + pt.y * pt.y, 0.5);
    // spherical radius
    float rho = length(pt);
    float theta = atan(pt.x,pt.y);
    float phi = acos(pt.z/r);
    // adjust the scale
    return ${eq};
  }

  bool f_i${i}(vec3 pt) {
    pt /= u_scale;
    // polar coordinates support
    // cylindrical radius
    float r = cust_pow(pt.x * pt.x + pt.y * pt.y, 0.5);
    // spherical radius
    float rho = length(pt);
    float theta = atan(pt.x,pt.y);
    float phi = acos(pt.z/r);
    // adjust the scale
    return ${ineq};
  }

  float df${i}(vec3 pt, vec3 d) {
    // implements a centered first derivative estimation
    return (f${i}(pt + DELTA_X * d) - f${i}(pt - DELTA_X * d))
              /
           (2. * DELTA_X);
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

FOREACH {
  float Newton${i}(in Ray r) {
    float start = -MIN_DIST*1.1;
    float end = 0.;
    float c = start;
    for (int i = 0; i < MAX_ITERATIONS; i++) {
      vec3 p = r.origin + r.direction * c;
      float a = f${i}(p);
      float da = df${i}(p, r.direction);
      c = c - a/da;
      if (c > end) {return Inf;}
    }
    if (c < start) return Inf;
    return c;
  }
}

bool testPoint(in Ray r, out vec3 pos, out vec3 norm, out float hue) {
  float mint = Inf;
  FOREACH {
    float t${i} = Newton${i}(r);

    if (t${i} < mint) {
      mint = t${i};
      hue = ${i}. / (${MAX_I}. - 0.5);
    }
  }
  pos = r.origin + r.direction * mint;
  // test for outside the bounds
  if (length(pos) > u_bounds) return false;
  float minf = Inf;
  FOREACH {
    minf = min(abs(f${i}(pos)), minf);
  }
  // test for a false positive
  if (minf > 0.01) {return false;}
  vec3 xDir = vec3(NORMAL_D, 0.0, 0.0);
  vec3 yDir = vec3(0.0, NORMAL_D, 0.0);
  vec3 zDir = vec3(0.0, 0.0, NORMAL_D);
  FOREACH {
    if (mint == t${i}) {
        norm =  normalize(
        vec3(f${i}(pos+xDir)-f${i}(pos-xDir),
            f${i}(pos+yDir)-f${i}(pos-yDir),
            f${i}(pos+zDir)-f${i}(pos-zDir)));
    }
  }
  return true;
}

bool marchRay(in Ray r, out vec3 position, out vec3 normal, out float hue) {
  float n = -1.;
  for (int i = 0; i < MAX_STEPS; i++) {
    r.origin += r.direction * MIN_DIST;
    // I multiply by 1.1 because otherwise it
    // doesn't test when it should 
    if (length(r.origin) > u_bounds * 1.1) {
      if (testPoint(r, position, normal, hue))
        return true;
      else 
        return false;
    }
    if (testPoint(r, position, normal, hue))
      return true;
  }
  return false;
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
  // unused as it does not fit the look
  // vec3 reflection = 2.0 * dot(n, -1.0 * sunDir) * n - sunDir;
  // reflection = normalize(reflection);
  // vec3 camera = r.direction;rho = csin(bxyz) + a
  // float specular = pow(clamp(dot(reflection, camera), 0.0, 1.0), 64.0);
  vec3 grad = mix(
    mix(color1, color2, abs(p.x / u_bounds)),
    color3,
    diffuse);
  // TODO: make this act more like ambient occlusion
  return hue_rotate(grad, hue) * min(1.0, length(p) / u_bounds * 0.2 + 0.8);
}

void drawAxes(in Ray fromCamera, in float t) {
  // TODO: add support for scaling
  if (u_line_width < 0.01) return;
  vec3 intercept = -fromCamera.origin / fromCamera.direction;
  if (intercept.x < 0.0) {intercept.x = Inf;}
  if (intercept.y < 0.0) {intercept.y = Inf;}
  if (intercept.z < 0.0) {intercept.z = Inf;}
  vec3 spacing = u_spacing * u_scale;
  if (!(t < intercept.x)) {
    vec3 hit = fromCamera.origin + fromCamera.direction * intercept.x;
    if (
      !(length(hit) > u_bounds) && 
     (mod(hit.y + u_line_width * 0.5, spacing.y) < u_line_width * spacing.y || 
      mod(hit.z + u_line_width * 0.5, spacing.z) < u_line_width * spacing.z)
    ) {
      Color.rgb = mix(Color.rgb, vec3(0.0), 0.1);
      Color.a += 0.1;
    }
  }
  if (!(t < intercept.y)) {
    vec3 hit = fromCamera.origin + fromCamera.direction * intercept.y;
    if (
      !(length(hit) > u_bounds) &&
     (mod(hit.x + u_line_width * 0.5, spacing.x) < u_line_width * spacing.x || 
      mod(hit.z + u_line_width * 0.5, spacing.z) < u_line_width * spacing.z)
    ) {
      Color.rgb = mix(Color.rgb, vec3(0.0), 0.1);
      Color.a += 0.1;
    }
  }
  if (!(t < intercept.z)) {
    vec3 hit = fromCamera.origin + fromCamera.direction * intercept.z;
    if (
      !(length(hit) > u_bounds) && 
     (mod(hit.y + u_line_width * 0.5, spacing.y) < u_line_width * spacing.y || 
      mod(hit.x + u_line_width * 0.5, spacing.x) < u_line_width * spacing.x)
    ) {
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
      drawAxes(fromCamera, Inf);
      return;
    }
  Color.a = 1.0;
  Color.rgb = vec3(shade(pos, normal, fromCamera, hue));
  float t = length(fromCamera.origin - pos);
  drawAxes(fromCamera, t);
}