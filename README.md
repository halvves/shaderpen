# Shaderpen

[![Latest NPM release][npm-badge]][npm-badge-url]
[![License][license-badge]][license-badge-url]

## About

Shaderpen is a simple library that mimics a lot of the same functionality seen in Shadertoy. It sets up the WebGL context, adds a canvas to the DOM that auto-resizes to fit the window, sets up a flat vertex shader that covers the entire canvas, and exposes several attributes relating to time, mouse position, etc. This allows you to get started tinkering with WebGL quickly by writing fragment shaders.

## Usage

### npm/Import

`npm install shaderpen`

```javascript
import ShaderPen from 'shaderpen';

new ShaderPen(`
  WRITE YOUR SHADER HERE
`);
```

### Script Include

Include the script: `https://unpkg.com/shaderpen`

```javascript
new ShaderPen(`
  WRITE YOUR SHADER HERE
`);
```

## Reason

[Codepen](https://codepen.io/) is where I make/keep 99% of my sketches/ideas, so I wanted a way to do quick shader sketches there as well. Creating shaderpen was also a great opportunity for me to dive more into learning how to interface directly with the WebGL context. With that said, any and all input on how to improve upon this is welcome.

## Future

I've tested this library a good bit with various examples from Shadertoy that don't use some of the deeper features (channels, etc...), and 95% of them work correctly. I would like to reach full parity with Shadertoy's base feature set (no audio channels or other custom inputs), but then deviate Shadertoy's "Channels" by creating a means for people to extend the Shaderpen object, adding their own custom uniforms and event listeners. This will allow people to create any custom input imaginable (WebAudio context, WebSockets, even things like the Battery Status API, etc...).

## TODO

* Add iDate from Shadertoy
* Begin exploring ways of extending


## See Also

[Shadertoy](https://www.shadertoy.com/) - The awesome site that inspired this library!

[npm-badge]: https://img.shields.io/npm/v/shaderpen.svg
[npm-badge-url]: https://www.npmjs.com/package/shaderpen
[license-badge]: https://img.shields.io/npm/l/shaderpen.svg
[license-badge-url]: ./LICENSE
