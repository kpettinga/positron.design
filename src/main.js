import { mountMeshBackground } from './background.js'

const logo = document.querySelector('.logo')
const background = document.querySelector('#background')
const dot = document.querySelector('#dot')
const trails = [...document.querySelectorAll('.trail')]
const enterDurationMs = 1000
const dotDurationMs = 500
const trailFadeMs = dotDurationMs * 0.25
const dotLeadMs = 500
const grabRadius = 100
const cursorDot = document.createElement('div')
const cursorCore = document.createElement('span')
const cursorRing = document.createElement('span')
cursorDot.id = 'cursor-dot'
cursorDot.setAttribute('aria-hidden', 'true')
cursorCore.className = 'cursor-core'
cursorRing.className = 'cursor-ring'
cursorDot.append(cursorCore, cursorRing)
document.body.append(cursorDot)

let dotCaught = false

function enterLogo() {
	if (!logo) return
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

	logo.style.animationDuration = `${enterDurationMs}ms`
	logo.classList.add('is-entered')

	if (background) {
		background.style.animationDuration = `${enterDurationMs}ms`
		background.classList.add('is-shown')
	}

	window.setTimeout(returnDot, Math.max(0, enterDurationMs - dotLeadMs))
}

// CSS ease-out is cubic-bezier(0, 0, 0.58, 1). Invert it so a fade
// starts when the dot, moving on that curve, reaches a circle.
function easeOutProgressToTime(progress) {
	const x1 = 0
	const y1 = 0
	const x2 = 0.58
	const y2 = 1
	const cx = 3 * x1
	const bx = 3 * (x2 - x1) - cx
	const ax = 1 - cx - bx
	const cy = 3 * y1
	const by = 3 * (y2 - y1) - cy
	const ay = 1 - cy - by
	const outputAt = (t) => ((ay * t + by) * t + cy) * t
	const timeAt = (t) => ((ax * t + bx) * t + cx) * t

	let low = 0
	let high = 1
	for (let step = 0; step < 20; step++) {
		const mid = (low + high) / 2
		if (outputAt(mid) < progress) low = mid
		else high = mid
	}

	return timeAt((low + high) / 2)
}

function lightTrails() {
	const viewBoxHeight = Number(logo.getAttribute('viewBox').split(' ')[3])
	const originY = Number(dot.getAttribute('cy'))
	const startShift = (originY / 100) * 2.5 * viewBoxHeight
	const startY = originY + startShift

	for (const circle of trails) {
		const progress =
			(startY - Number(circle.getAttribute('cy'))) / startShift
		const clamped = Math.min(1, Math.max(0, progress))
		circle.style.animationDelay = `${easeOutProgressToTime(clamped) * dotDurationMs}ms`
		circle.style.animationDuration = `${trailFadeMs}ms`
		circle.classList.add('is-lit')
	}
}

function returnDot() {
	if (!dot) return

	dot.style.animationDuration = `${dotDurationMs}ms`
	dot.classList.add('is-home')
	lightTrails()
}

function placeCursorDot(x, y) {
	cursorDot.style.left = `${x}px`
	cursorDot.style.top = `${y}px`
}

function catchDot(x, y) {
	if (!dot || dotCaught) return

	dotCaught = true
	const size = dot.getBoundingClientRect().width
	cursorDot.style.width = `${size}px`
	cursorDot.style.height = `${size}px`
	placeCursorDot(x, y)
	cursorDot.classList.add('is-on')
	dot.style.visibility = 'hidden'
	document.documentElement.classList.add('is-dot-cursor')

	for (const trail of trails) trail.remove()
}

function onPointerMove(event) {
	if (!dot || event.pointerType === 'touch') return

	if (!dotCaught) {
		const rect = dot.getBoundingClientRect()
		const dx = event.clientX - (rect.left + rect.width / 2)
		const dy = event.clientY - (rect.top + rect.height / 2)
		if (dx * dx + dy * dy > grabRadius * grabRadius) return
		catchDot(event.clientX, event.clientY)
		return
	}

	placeCursorDot(event.clientX, event.clientY)
}

function onPointerDown(event) {
	if (!dotCaught || event.pointerType === 'touch' || event.button !== 0) return
	cursorDot.classList.add('is-pressed')
}

function releaseCursor() {
	cursorDot.classList.remove('is-pressed')
}

window.addEventListener('pointermove', onPointerMove)
window.addEventListener('pointerdown', onPointerDown)
window.addEventListener('pointerup', releaseCursor)
window.addEventListener('pointercancel', releaseCursor)
window.addEventListener('blur', releaseCursor)
window.addEventListener('resize', () => {
	if (!dotCaught || !dot) return
	const size = dot.getBoundingClientRect().width
	cursorDot.style.width = `${size}px`
	cursorDot.style.height = `${size}px`
})

window.addEventListener('load', () => {
	if (background instanceof HTMLCanvasElement) mountMeshBackground(background)
	requestAnimationFrame(enterLogo)
})
