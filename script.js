import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// =====================
// Rubik's Cube Engine
// =====================
const EPS = 1e-4; // tolerance when selecting layer cubies
const SIZE = 3;    // 3x3x3 cube
const CUBIE_GAP = 0.04; // small gap to see separation
const FACE = { R: 'x=+1', L: 'x=-1', U: 'y=+1', D: 'y=-1', F: 'z=+1', B: 'z=-1' };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const wrapEl = document.getElementById('canvas-wrap');
const wrapRect = wrapEl.getBoundingClientRect();
const initialWidth = Math.max(200, Math.floor(wrapRect.width || window.innerWidth));
const initialHeight = Math.max(200, Math.floor(wrapRect.height || window.innerHeight));
renderer.setSize(initialWidth, initialHeight);
wrapEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, initialWidth/initialHeight, 0.1, 100);
camera.position.set(6, 6, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 4; controls.maxDistance = 16;

// Lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1.0);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(4,8,6); scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.4); rim.position.set(-6,-4,-8); scene.add(rim);

// Ground grid removed for clean look

// Cube root container
const cubeRoot = new THREE.Group();
scene.add(cubeRoot);

// Materials for face stickers in order: +X (R), -X (L), +Y (U), -Y (D), +Z (F), -Z (B)
// Color-to-number mapping (as requested): yellow=0, red=1, green=2, blue=3, white=4, orange=5
export const COLOR_TO_NUMBER = { yellow: 0, red: 1, green: 2, blue: 3, white: 4, orange: 5 };
export const NUMBER_TO_COLOR = Object.fromEntries(Object.entries(COLOR_TO_NUMBER).map(([k,v])=>[v,k]));
export const FACE_TO_COLOR = { U:'white', D:'yellow', R:'red', L:'orange', F:'green', B:'blue' };
export const FACE_TO_NUMBER = Object.fromEntries(Object.entries(FACE_TO_COLOR).map(([f,name])=>[f, COLOR_TO_NUMBER[name]]));
const col = { R: 0xff3b30, L: 0xf97316, U: 0xffffff, D: 0xffdd00, F: 0x34c759, B: 0x0a84ff };
const stickerMat = {
	R: new THREE.MeshBasicMaterial({ color: col.R, side: THREE.DoubleSide }),
	L: new THREE.MeshBasicMaterial({ color: col.L, side: THREE.DoubleSide }),
	U: new THREE.MeshBasicMaterial({ color: col.U, side: THREE.DoubleSide }),
	D: new THREE.MeshBasicMaterial({ color: col.D, side: THREE.DoubleSide }),
	F: new THREE.MeshBasicMaterial({ color: col.F, side: THREE.DoubleSide }),
	B: new THREE.MeshBasicMaterial({ color: col.B, side: THREE.DoubleSide })
};
const plasticMat = new THREE.MeshPhongMaterial({ color: 0x11151f, shininess: 40 });

// Data structure for cubies
/** cubie = { mesh:THREE.Group, pos:[i,j,k] integer coords in {-1,0,1} } */
const cubies = [];

// Build all cubies
function makeCubie(i,j,k){
	const g = new THREE.Group();

	// Base black cube
	const geom = new THREE.BoxGeometry(1 - CUBIE_GAP, 1 - CUBIE_GAP, 1 - CUBIE_GAP);
	const base = new THREE.Mesh(geom, plasticMat);
	g.add(base);

	// Add stickers: small planes slightly above each face
	const s = 0.9; // sticker size
	const t = 0.005; // sticker lift

	function addSticker(face){
		const sg = new THREE.PlaneGeometry(s, s);
		const sm = stickerMat[face];
		const m = new THREE.Mesh(sg, sm);
		if(face==='R'){ m.position.x = 0.5 + t; m.rotation.y = -Math.PI/2; }
		if(face==='L'){ m.position.x = -0.5 - t; m.rotation.y =  Math.PI/2; }
		if(face==='U'){ m.position.y = 0.5 + t; m.rotation.x =  Math.PI/2; }
		if(face==='D'){ m.position.y = -0.5 - t; m.rotation.x = -Math.PI/2; }
		if(face==='F'){ m.position.z = 0.5 + t; }
		if(face==='B'){ m.position.z = -0.5 - t; m.rotation.y =  Math.PI; }
		g.add(m);
	}

	if(i===+1) addSticker('R');
	if(i===-1) addSticker('L');
	if(j===+1) addSticker('U');
	if(j===-1) addSticker('D');
	if(k===+1) addSticker('F');
	if(k===-1) addSticker('B');

	g.position.set(i, j, k);
	return g;
}

for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++){
	const mesh = makeCubie(i,j,k);
	cubeRoot.add(mesh);
	cubies.push({ mesh, pos:[i,j,k], home:[i,j,k] });
}

// Animation and move queue
// queue element: { mv:string, log:boolean }
const queue = [];
let isAnimating = false;
const SPEED = 380; // degrees per second

function enqueueMoves(seq, options={}){
	// parse like "R U R' U'" or ["R","U",...]
	if(typeof seq === 'string') seq = seq.trim().split(/\s+/).filter(Boolean);
	const shouldLog = options.log !== false;
	
	// Filter out invalid moves
	const validMoves = [];
	for(const mv of seq) {
		try {
			mvAxisLayer(mv); // Test if move is valid
			validMoves.push({ mv, log: shouldLog });
		} catch(e) {
			console.warn(`Invalid move ignored: ${mv}`);
		}
	}
	
	for(const move of validMoves) queue.push(move);
	runQueue();
}

function runQueue(){
	if(isAnimating || queue.length===0) return;
	const { mv, log } = queue.shift();
	rotateLayerAnimated(mv, ()=>{ if(log) updateLog(mv); runQueue(); });
}

function mvAxisLayer(m){
	// returns {axis:'x'|'y'|'z', layerValue:-1|0|1, angle: +PI/2 or -PI/2 or PI}
	const base = m[0];
	const mod = m.length>1 ? m.slice(1) : '';

	const map = {
		'R':{axis:'x', layer: +1, dir:+1}, 'L':{axis:'x', layer:-1, dir:-1},
		'U':{axis:'y', layer: +1, dir:+1}, 'D':{axis:'y', layer:-1, dir:-1},
		'F':{axis:'z', layer: +1, dir:+1}, 'B':{axis:'z', layer:-1, dir:-1},
	};
	const info = map[base];
	if(!info) throw new Error('Invalid move '+m);
	let turns = 1;
	let dir = info.dir;
	if(mod==="'") dir = -dir;
	if(mod==="2") turns = 2;

	return { axis:info.axis, layerValue:info.layer, turns, dir };
}

function selectLayerCubies(axis, layerValue){
	const idx = axis==='x'?0:axis==='y'?1:2;
	return cubies.filter(c=>Math.abs(c.mesh.position.getComponent(idx) - layerValue) < 0.5+EPS);
}

function rotateLayerState(layerCubies, axis, dir){
	// Update the cubie's integer pos after a quarter turn
	for(const c of layerCubies){
		let [x,y,z] = c.pos;
		if(axis==='x'){
			// (y,z) -> ( -dir*z, dir*y ) for quarter turns
			const ny = -dir*z; const nz = dir*y; y=ny; z=nz;
		} else if(axis==='y'){
			// (x,z) -> ( dir*z, -dir*x )
			const nx = dir*z; const nz = -dir*x; x=nx; z=nz;
		} else if(axis==='z'){
			// (x,y) -> ( -dir*y, dir*x )
			const nx = -dir*y; const ny = dir*x; x=nx; y=ny;
		}
		c.pos = [x,y,z];
	}
}

function rotateLayerAnimated(move, onDone){
	const {axis, layerValue, turns, dir} = mvAxisLayer(move);
	const layerCubies = selectLayerCubies(axis, layerValue);

	// Create a temporary pivot for this layer
	const pivot = new THREE.Group();
	cubeRoot.add(pivot);

	for(const c of layerCubies){
		pivot.attach(c.mesh); // reparent under pivot
	}

	// How much to rotate per frame
	const target = (Math.PI/2) * dir * turns;
	let rotated = 0;
	isAnimating = true;

	let prevTs = undefined;
	const step = (ts)=>{
		if(prevTs===undefined) prevTs = ts;
		const dt = (ts - prevTs) / 1000; // seconds
		prevTs = ts;
		const delta = dt * (Math.PI/180) * SPEED * Math.sign(target);
		const remain = target - rotated;
		const add = Math.abs(delta) > Math.abs(remain) ? remain : delta;
		rotated += add;
		if(axis==='x') pivot.rotation.x += add;
		if(axis==='y') pivot.rotation.y += add;
		if(axis==='z') pivot.rotation.z += add;

		if(Math.abs(target - rotated) < 1e-6){
			// Bake final transform by reparenting children BEFORE resetting pivot
			for(const c of layerCubies){ cubeRoot.attach(c.mesh); }
			cubeRoot.remove(pivot);

			// Update integer state for each quarter turn
			for(let t=0;t<turns;t++) rotateLayerState(layerCubies, axis, dir);

			isAnimating = false;
			if(onDone) onDone();
			return;
		}
		requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}

// Render loop
let last = performance.now();
function loop(ts){
	const dt = (ts - last)/1000; last = ts;
	controls.update();
	renderer.render(scene, camera);
	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Responsive
window.addEventListener('resize', ()=>{
	const rect = wrapEl.getBoundingClientRect();
	const w = Math.max(200, Math.floor(rect.width || (window.innerWidth - 340)));
	const h = Math.max(200, Math.floor(rect.height || window.innerHeight));
	renderer.setSize(w, h);
	camera.aspect = w / h; camera.updateProjectionMatrix();
});

// UI / Keyboard
const logEl = document.getElementById('log');
const algEl = document.getElementById('alg');

function updateLog(mv){
	logEl.value += (logEl.value? ' ':'') + mv;
	logEl.scrollTop = logEl.scrollHeight;
	
	// Auto-sync virtual cube state when moves are logged
	if (virtualCube && mv && mv.trim() !== '') {
		try {
			// Apply the move to virtual cube
			virtualCube.move(mv.trim());
			console.log('Synced move to virtual cube:', mv);
		} catch (e) {
			console.error('Failed to sync move to virtual cube:', e);
		}
	}
}

document.querySelectorAll('[data-mv]').forEach(btn=>{
	btn.addEventListener('click', ()=> enqueueMoves([btn.dataset.mv]));
});

document.getElementById('play-seq').addEventListener('click', ()=>{
	const seq = algEl.value.trim(); 
	if(seq) {
		enqueueMoves(seq);
	} else {
		// Provide user feedback when algorithm is empty
		algEl.focus();
		algEl.style.borderColor = 'var(--err)';
		setTimeout(() => {
			algEl.style.borderColor = '';
		}, 1000);
	}
});

document.getElementById('undo').addEventListener('click', ()=>{
	if(isAnimating) return;
	// Simple undo = inverse of last move (approx; does not collapse R2). For demonstration.
	const txt = logEl.value.trim(); 
	if(!txt) return;
	
	const arr = txt.split(/\s+/); 
	const last = arr.pop();
	
	// Handle inverse moves properly
	let inv;
	if(last.endsWith("'")) {
		inv = last.slice(0, -1); // R' -> R
	} else if(last.endsWith('2')) {
		inv = last; // R2 -> R2 (self-inverse)
	} else {
		inv = last + "'"; // R -> R'
	}
	
	logEl.value = arr.join(' ');
	enqueueMoves([inv], { log: false });
});

document.getElementById('reset').addEventListener('click', ()=>{
	// Reset scene to solved state
	queue.length = 0; isAnimating = false; 
	logEl.value = ''; // Clear move log
	algEl.value = ''; // Clear algorithm textarea
	for(const c of cubies){
		// Ensure each cubie is directly under the cube root (detach from any pivot)
		cubeRoot.attach(c.mesh);
		// Restore position/orientation and logical coordinates
		c.pos = [...c.home];
		c.mesh.rotation.set(0,0,0);
		c.mesh.position.set(c.home[0], c.home[1], c.home[2]);
	}
	// Clean up any leftover empty pivot groups
	for(const child of [...cubeRoot.children]){
		if(!cubies.some(c=>c.mesh===child)) cubeRoot.remove(child);
	}
});

const MOVES = ['R','R\'','R2','L','L\'','L2','U','U\'','U2','D','D\'','D2','F','F\'','F2','B','B\'','B2'];
function randomScramble(n=25){
	const seq = []; 
	let lastAxis = '';
	let attempts = 0;
	const maxAttempts = 100; // Prevent infinite loops
	
	const axisOf = m => ({R:'x','R\'':'x','R2':'x', L:'x','L\'':'x','L2':'x', U:'y','U\'':'y','U2':'y', D:'y','D\'':'y','D2':'y', F:'z','F\'':'z','F2':'z', B:'z','B\'':'z','B2':'z'})[m];
	
	while(seq.length < n && attempts < maxAttempts){
		const m = MOVES[Math.floor(Math.random() * MOVES.length)];
		const ax = axisOf(m);
		if(ax === lastAxis) {
			attempts++;
			continue; // avoid same-axis consecutive moves
		}
		seq.push(m); 
		lastAxis = ax;
		attempts = 0; // Reset attempts counter on successful move
	}
	return seq;
}
document.getElementById('scramble').addEventListener('click', ()=>{
	const seq = randomScramble(25); 
	algEl.value = seq.join(' '); 
	enqueueMoves(seq);
	
	// Initialize virtual cube for solving
	if (!virtualCube) {
		initVirtualCube();
	}
});

// Enhanced scramble function that also updates virtual cube
function enhancedScramble() {
	const seq = randomScramble(25);
	algEl.value = seq.join(' ');
	enqueueMoves(seq);
	
	// Initialize virtual cube if needed
	if (!virtualCube) {
		initVirtualCube();
	}
	
	console.log('Scrambled cube with moves:', seq);
}

// FPS meter (simple)
const fpsEl = document.getElementById('fps');
let frames=0, acc=0, lastT=performance.now();
function fpsTick(){
	const now = performance.now();
	frames++; acc += now-lastT; lastT = now;
	if(acc>1000){ fpsEl.textContent = `${frames} FPS`; frames=0; acc=0; }
	requestAnimationFrame(fpsTick);
}
requestAnimationFrame(fpsTick);

// =====================
// Cube Solver Integration
// =====================

// Virtual cube for solving
let virtualCube = null;

// Initialize virtual cube
function initVirtualCube() {
    try {
        if (typeof Cube !== 'undefined') {
            virtualCube = new Cube();
            console.log('Virtual cube initialized');
            return true;
        } else {
            console.error('Cube library not loaded');
            return false;
        }
    } catch (e) {
        console.error('Failed to initialize virtual cube:', e);
        return false;
    }
}

// Convert current 3D cube state to virtual cube
function syncCubeState() {
    if (!virtualCube) return false;
    
    try {
        // Reset virtual cube to solved state
        virtualCube = new Cube();
        
        // Get moves from log and apply them to virtual cube
        const moves = logEl.value.trim().split(/\s+/).filter(Boolean);
        if (moves.length > 0) {
            virtualCube.move(moves.join(' '));
            console.log('Applied moves to virtual cube:', moves);
        }
        return true;
    } catch (e) {
        console.error('Failed to sync cube state:', e);
        return false;
    }
}

// Try to extract a state string from the virtual cube for different libraries
function getCubeStateString() {
    if (!virtualCube) return null;
    try {
        if (typeof virtualCube.asString === 'function') return virtualCube.asString();
        if (typeof virtualCube.toString === 'function') return virtualCube.toString();
        if (typeof virtualCube.state === 'function') return virtualCube.state();
        if (typeof virtualCube.getState === 'function') return virtualCube.getState();
    } catch (e) {
        console.warn('Unable to read cube state string:', e);
    }
    return null;
}

// Attempt to solve using any available API shape
function trySolveWithAvailableApis() {
    // 1) Instance method: virtualCube.solve()
    if (virtualCube && typeof virtualCube.solve === 'function') {
        return virtualCube.solve();
    }

    // 2) Static/namespace solvers that take a state string
    const state = getCubeStateString();
    if (state) {
        // Cube.solve(state)
        if (typeof Cube !== 'undefined' && typeof Cube.solve === 'function') {
            return Cube.solve(state);
        }
        // cubejs.solve(state)
        if (typeof window !== 'undefined' && window.cubejs && typeof window.cubejs.solve === 'function') {
            return window.cubejs.solve(state);
        }
        // global solve(state)
        if (typeof window !== 'undefined' && typeof window.solve === 'function') {
            return window.solve(state);
        }
    }

    throw new Error('No compatible solve() API found in loaded cube library.');
}

// Apply a single move to the 3D cube
function applyMove(move) {
    if (!move || move.trim() === '') return;
    
    console.log('Applying move:', move);
    enqueueMoves([move.trim()], { log: true });
}

// Solve the cube using cubejs
async function solveCube() {
    console.log('Starting cube solve...');
    
    // Check if cube is already solved
    if (isCubeSolved()) {
        alert('Cube is already solved! 🎉');
        return;
    }
    
    // Initialize virtual cube if needed
    if (!virtualCube) {
        if (!initVirtualCube()) {
            alert('Cube solver library not available. Please refresh the page.');
            return;
        }
    }
    
    // Sync current state to virtual cube
    if (!syncCubeState()) {
        alert('Failed to sync cube state. Please try again.');
        return;
    }
    
    try {
        // Check if cube is solvable (only if the library provides this method)
        if (typeof virtualCube.isSolvable === 'function') {
            if (!virtualCube.isSolvable()) {
                alert('This cube state is not solvable! Please reset and try again.');
                return;
            }
        }
        
        // Generate solution
        console.log('Generating solution...');
        const solution = trySolveWithAvailableApis();
        
        if (!solution || solution.trim() === '') {
            alert('No solution found. The cube might be in an unsolvable state.');
            return;
        }
        
        console.log('Solution found:', solution);
        
        // Display solution in algorithm textarea
        algEl.value = solution;
        
        // Apply solution step by step
        const moves = solution.split(/\s+/).filter(Boolean);
        
        if (moves.length > 0) {
            // Clear any existing moves in queue
            queue.length = 0;
            
            // Add solution moves to queue
            enqueueMoves(moves, { log: false });
            
            // Do not write non-move text into the move log; just inform via console
            console.log(`🧩 Solution applied: ${moves.length} moves`);
            
            console.log(`Applying ${moves.length} moves to solve cube`);
        } else {
            alert('No moves in solution. Cube might already be solved.');
        }
        
    } catch (e) {
        console.error('Solve error:', e);
        
        // Provide more specific error messages
        if (e.message.includes('unsolvable')) {
            alert('This cube state is not solvable! Please reset the cube and try again.');
        } else if (e.message.includes('timeout')) {
            alert('Solution generation timed out. Please try again.');
        } else {
            alert('Failed to solve cube: ' + e.message);
        }
    }
}

// Check if cube is solved
function isCubeSolved() {
    for (const c of cubies) {
        if (c.pos[0] !== c.home[0] || c.pos[1] !== c.home[1] || c.pos[2] !== c.home[2]) {
            return false;
        }
    }
    return true;
}

// Add solve button event listener
const solveBtn = document.getElementById('solve-cube');
if (solveBtn) {
    solveBtn.addEventListener('click', async () => {
        if (isAnimating) {
            alert('Please wait for current animation to finish.');
            return;
        }
        
        solveBtn.disabled = true;
        try {
            await solveCube();
        } finally {
            solveBtn.disabled = false;
        }
    });
}
