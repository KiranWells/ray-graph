#version 300 es

/* Hybrid graphing render engine
 * built by Griffith T.
 * https://github.com/KiranWells/
 */

/* IMPORTANT NOTE:
 * This program uses a custom JavaScript preprocessor
 * that replaces ${variables} with the user-defined uniforms
 * 
 * In addition, it allows for FOREACH loops, which are
 * copied and pasted once per user-defined function.
 * Inside these loops, the following variables are defined:
 * 
 * ${i}     -   The number of the function currently being pasted
 * ${MAX_I} -   The number of functions total
 * ${eq}    -   The current user-defined equation in implicit form
 * ${ineq}  -   The current user-defined equation in the form of an inequality
 * 
 * These are used to create a user-defined number of arbitrary
 * equations and the functions necessary to process them.
 */

#ifdef MOBILE
  // an attempt to reduce precision errors
  // mobile devices seem to have some issues with
precision highp float;
#else
  // for speed. highp didn't seem to make a difference
  // for computers
precision lowp float;
#endif

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
#define MAX_ITERATIONS 2
#define NORMAL_D 0.01
#define DELTA_X (0.0001 * u_bounds)
#define MIN_DIST (u_bounds * u_step_size)

// displays color as: 
// step iteration        - red
// distance from camera  - green
// function number       - blue
// #define DEBUG_COLOR
// shows only the given iteration
// #define DEBUG_ITER 3

// float number hacks
#define NaN 0./0.
#ifdef MOBILE
  // an attempt to reduce precision errors
  // mobile devices seem to have some issues with
  #define Inf 1e20
#else
  #define Inf 1./0.
#endif

out vec4 Color;

struct Ray {
  vec3 origin;
  vec3 direction;
};

// utility functions to simplify latex parsing
float sec(float v) {return 1./cos(v);}
float csc(float v) {return 1./sin(v);}
float cot(float v) {return 1./tan(v);}

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
  return r;
}

FOREACH {
  // This function emulates the user-defined formula
  // defining the polar variables and allowing direct
  // access to the location vector. It acts as a pseudo-
  // distance equation, allowing for rendering with a
  // ray-marching like algorithm.
  // This will be defined for each user-input formula, with
  // a numerical suffix (the ${i})
  float f${i}(vec3 pt) {
    pt /= u_scale;
    // polar coordinates support
    // cylindrical radius
    float r = cust_pow(pt.x * pt.x + pt.y * pt.y, 0.5);
    // spherical radius
    float rho = length(pt);
    float theta = atan(pt.x, pt.y);
    float phi = acos(pt.z/r);
    // adjust the scale
    return ${eq};
  }

  // an inequality version of the above function
  bool f_i${i}(vec3 pt) {
    pt /= u_scale;
    // polar coordinates support
    // cylindrical radius
    float r = cust_pow(pt.x * pt.x + pt.y * pt.y, 0.5);
    // spherical radius
    float rho = length(pt);
    float theta = pt.x > 0. ? atan(pt.x,pt.y): atan(-pt.x,-pt.y);
    float phi = acos(pt.z/r);
    // adjust the scale
    return ${ineq};
  }

  // a derivative approximation for the above function.
  // Used to implement Newton's method for finding zeros
  float df${i}(vec3 pt, vec3 d) {
    // implements a centered first derivative estimation
    return (f${i}(pt + DELTA_X * d) - f${i}(pt - DELTA_X * d))
              /
           (2. * DELTA_X);
  }

  // a second derivative approximation
  float d2f${i}(vec3 pt, vec3 d) {
    // implements a centered first derivative estimation
    return (f${i}(pt + DELTA_X * d) - 2.*f${i}(pt) + f${i}(pt - DELTA_X * d))
              /
           (DELTA_X * DELTA_X);
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
  //////// CURRENTLY UNUSED ////////
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
  
  float Newton${i}(in Ray r) {
    // implements Newton's method to better approximate zeros
    float start = -MIN_DIST;
    float end = 0.;
    float c = start;
    for (int i = 0; i < MAX_ITERATIONS; i++) {
      vec3 p = r.origin + r.direction * c;
      float a = f${i}(p);
      float da = df${i}(p, r.direction);
      // TODO: add a test to see if the value is progressing
      // out-of-bounds. If so, move in the opposite direction
      c = c - a/da;
      if (c > end) {return Inf;}
    }
    return c;
  }
}

bool testPoint(in Ray r, out vec3 pos, out vec3 norm, out float hue) {
  // tests the next interval to determine 
  // which formula is closest, if any.
  // Returns true if a hit is found, false otherwise
  float mint = Inf;
  // search for each formula
  FOREACH {
    float t${i} = Newton${i}(r);
    // float t${i} = binarySearch${i}(r);

    if (t${i} < mint) {
      // change to use this one if it is valid
      vec3 pos${i} = r.origin + r.direction * t${i};
      if (
        length(pos${i}) < min(u_bounds, u_zoom) && // out-of-bounds and behind camera test
        abs(f${i}(pos${i})) < 0.01    // false positive test
      )  {
        mint = t${i};
        hue = ${i}. / (${MAX_I}. - 0.5);
      }
    }
  }
  pos = r.origin + r.direction * mint;
  // test to see if any ts were acceptable
  if (mint == Inf) return false;

  // these should not be needed as the conditions are tested above:
  // test for outside the bounds
  // if (length(pos) > u_bounds) return false;
  // float minf = Inf;
  // FOREACH {
  //   minf = min(abs(f${i}(pos)), minf);
  // }
  // test for a false positive
  // if (minf > 0.01) {return false;}

  // calculate fake normal based on the change in the function
  // IMPORTANT: does not point away from the surface!
  // both sides of the surface will have the same "normal"
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

bool marchRay(in Ray r, out vec3 position, out vec3 normal, out float hue, out float steps) {
  // marches through the bounds from the given position, 
  // testing at set intervals for valid intersections
  for (int i = 0; i < MAX_STEPS; i++) {
    r.origin += r.direction * MIN_DIST;
    steps = float(i);
#ifdef DEBUG_ITER
    if (i != DEBUG_ITER) continue;
#endif
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

  // Convert input color to vec4
  vec4    color  = vec4(c, 1.0);

  // Convert to YIQ
  float   YPrime = dot (color, kRGBToYPrime);
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

  // Return the result
  return color.rgb;
}

vec3 shade(in vec3 p, in vec3 n, in Ray r, in float hue) {
  // hard-coded gradient, similar to what is encoded in the CSS
  vec3 color1 = vec3(0.4588, 0.8196, 0.3176);
  vec3 color2 = vec3(0.9098, 0.9412, 0.4549);
  vec3 color3 = vec3(0.1804, 0.8275, 0.6314);

  // "lighting" based on the faked "normal"
  const vec3 sunDir = normalize(vec3(0.8549, 0.7176, 0.2667));
  float diffuse = abs(dot(n, sunDir));
  // attempt at shadows
  // does not work as the direction of the surface is 
  // not reliable - the normal is space-dependent, not
  // view-dependent
  // vec3 pos, norm;
  // float hue1, steps, light  = 1.0;
  // if (marchRay(Ray(p - sunDir * 0.1, -sunDir), pos, norm, hue1, steps))
  //   light = 0.5;
  // unused as it does not fit the look
  // vec3 reflection = 2.0 * dot(n, -1.0 * sunDir) * n - sunDir;
  // reflection = normalize(reflection);
  // vec3 camera = r.direction;rho = csin(bxyz) + a
  // float specular = pow(clamp(dot(reflection, camera), 0.0, 1.0), 64.0);
  vec3 grad = mix(
    mix(color1, color2, abs(p.x / u_bounds)),
    color3,
    diffuse);
  // TODO: make the shading after act more like ambient occlusion
  return hue_rotate(grad, hue) * min(1.0, length(p) / u_bounds * 0.2 + 0.8);
}

void drawAxes(in Ray fromCamera, in float t) {
  // draws a grid of graph lines on each axis
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
  // checks to see if the function should act as if it is solid
  // layers the functions in the order of their creation
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
  float stepcount = 0.;
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
    if (!marchRay(Ray(pos, fromCamera.direction), pos, normal, hue, stepcount)) {
      drawAxes(fromCamera, Inf);
      return;
    }
  Color.a = 1.0;
  Color.rgb = vec3(shade(pos, normal, fromCamera, hue));
  float t = length(fromCamera.origin - pos);
#ifdef DEBUG_COLOR
  Color.rgb = vec3((stepcount + 1.) * u_step_size,  (1.0 - t / (u_zoom + u_bounds)), hue);
#endif
  drawAxes(fromCamera, t);
}