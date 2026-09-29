import fragmentSource from './shaders/mesh-drift.frag?raw'

const vertexSource = `
attribute vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// First four colours are the mesh recipe. The rest stay black so the
// WebGL1 colour array stays a fixed length of eight.
const colors = new Float32Array([
	0.063, 0.063, 0.063, 0.961, 0.961, 0.961, 0.69, 0.69, 0.69, 0.227, 0.227,
	0.227, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
])

const maxPixelRatio = 2
const timeScale = 1
const colorCount = 4
const cursorFadeSeconds = 0.22

export function mountMeshBackground(canvas) {
	const gl = canvas.getContext('webgl', {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false,
	})
	if (!gl) {
		canvas.classList.add('is-fallback')
		return
	}

	const program = createProgram(gl, vertexSource, fragmentSource)
	if (!program) {
		canvas.classList.add('is-fallback')
		return
	}

	const buffer = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 3, -1, -1, 3]),
		gl.STATIC_DRAW,
	)

	const position = gl.getAttribLocation(program, 'a_position')
	const uniforms = {
		colors: gl.getUniformLocation(program, 'u_colors[0]'),
		scene: gl.getUniformLocation(program, 'u_scene'),
		shape: gl.getUniformLocation(program, 'u_shape'),
		surface: gl.getUniformLocation(program, 'u_surface'),
		finish: gl.getUniformLocation(program, 'u_finish'),
		transform: gl.getUniformLocation(program, 'u_transform'),
		space: gl.getUniformLocation(program, 'u_space'),
		cursor: gl.getUniformLocation(program, 'u_cursor'),
	}

	const pointer = { x: 0, y: 0, inside: false }
	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	let reduceMotion = motionQuery.matches
	let presence = 0
	let width = 0
	let height = 0
	let raf = 0
	const started = performance.now()
	let lastFrame = started

	function resize() {
		const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio)
		const nextWidth = Math.max(
			1,
			Math.round(canvas.clientWidth * pixelRatio),
		)
		const nextHeight = Math.max(
			1,
			Math.round(canvas.clientHeight * pixelRatio),
		)
		if (nextWidth === width && nextHeight === height) return

		width = nextWidth
		height = nextHeight
		canvas.width = width
		canvas.height = height
		gl.viewport(0, 0, width, height)
		gl.useProgram(program)
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.enableVertexAttribArray(position)
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
		gl.uniform3fv(uniforms.colors, colors)
		gl.uniform4f(uniforms.shape, 1.26, 0.35, 0.28, 0)
		gl.uniform4f(uniforms.surface, 1.82, 1.1, 0, 1)
		gl.uniform4f(uniforms.finish, 0, 0, 0, 0.04)
		gl.uniform4f(uniforms.transform, 8424, 0, 0.2, 0)
	}

	function draw(now) {
		if (gl.isContextLost()) return

		resize()
		const dt = Math.min(0.05, (now - lastFrame) / 1000)
		lastFrame = now
		const target = pointer.inside && !reduceMotion ? 1 : 0
		presence +=
			(target - presence) * (1 - Math.exp(-dt / cursorFadeSeconds))
		if (Math.abs(target - presence) < 0.001) presence = target

		const seconds = reduceMotion ? 0 : (now - started) / 1000
		gl.uniform4f(
			uniforms.scene,
			width,
			height,
			seconds * timeScale,
			colorCount,
		)
		gl.uniform4f(uniforms.space, 0, 0, pointer.x, pointer.y)
		gl.uniform4f(uniforms.cursor, presence, 1, 0.54, 0.8)
		gl.drawArrays(gl.TRIANGLES, 0, 3)
	}

	function stop() {
		cancelAnimationFrame(raf)
		raf = 0
	}

	function start() {
		if (raf || reduceMotion) return
		lastFrame = performance.now()
		raf = requestAnimationFrame(frame)
	}

	function frame(now) {
		if (document.hidden || reduceMotion) {
			raf = 0
			return
		}
		draw(now)
		raf = requestAnimationFrame(frame)
	}

	function onPointerMove(event) {
		const rect = canvas.getBoundingClientRect()
		if (rect.width === 0 || rect.height === 0) return
		const x = (event.clientX - rect.left) / rect.width
		const y = (event.clientY - rect.top) / rect.height
		pointer.x = x * 2 - 1
		pointer.y = 1 - y * 2
		pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
	}

	function onPointerOut(event) {
		if (!event.relatedTarget) pointer.inside = false
	}

	function onPointerEnd(event) {
		if (event.pointerType === 'touch') pointer.inside = false
	}

	function onMotionChange() {
		reduceMotion = motionQuery.matches
		pointer.inside = false
		presence = 0
		if (reduceMotion) {
			stop()
			draw(performance.now())
			return
		}
		start()
	}

	function onVisibilityChange() {
		if (document.hidden) {
			stop()
			return
		}
		if (reduceMotion) draw(performance.now())
		else start()
	}

	const observer = new ResizeObserver(() => {
		if (!raf) draw(performance.now())
	})

	window.addEventListener('pointermove', onPointerMove, { passive: true })
	window.addEventListener('pointerup', onPointerEnd)
	window.addEventListener('pointercancel', onPointerEnd)
	document.addEventListener('pointerout', onPointerOut)
	document.addEventListener('visibilitychange', onVisibilityChange)
	motionQuery.addEventListener('change', onMotionChange)
	observer.observe(canvas)

	resize()
	draw(started)
	start()
}

function createProgram(gl, vertex, fragment) {
	const program = gl.createProgram()
	const vertexShader = compile(gl, gl.VERTEX_SHADER, vertex)
	const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment)
	if (!vertexShader || !fragmentShader) return null

	gl.attachShader(program, vertexShader)
	gl.attachShader(program, fragmentShader)
	gl.linkProgram(program)
	gl.deleteShader(vertexShader)
	gl.deleteShader(fragmentShader)

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program))
		gl.deleteProgram(program)
		return null
	}

	return program
}

function compile(gl, type, source) {
	const shader = gl.createShader(type)
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader

	const label = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
	console.error(
		`${label} shader failed to compile`,
		gl.getShaderInfoLog(shader),
	)
	gl.deleteShader(shader)
	return null
}
