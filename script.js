// Add a simple test function to verify Three.js is working
function testThreeJS() {
  try {
    console.log('Testing Three.js functionality...');
    
    if (typeof THREE === 'undefined') {
      console.error('THREE is not defined!');
      return false;
    }
    
    // Test basic Three.js objects
    const testScene = new THREE.Scene();
    const testCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const testRenderer = new THREE.WebGLRenderer();
    
    console.log('Basic Three.js objects created successfully');
    console.log('Scene:', testScene);
    console.log('Camera:', testCamera);
    console.log('Renderer:', testRenderer);
    
    return true;
  } catch (error) {
    console.error('Three.js test failed:', error);
    return false;
  }
}

// Call test function when script loads
console.log('Script.js loaded, testing Three.js...');
if (typeof THREE !== 'undefined') {
  testThreeJS();
} else {
  console.log('THREE not available yet, will test later');
}

let scene, camera, renderer, controls;
let cubeGroup; // Will be initialized after Three.js loads
let cubes = []; // Store individual cubes for proper face rotation
let moveCount = 0; // Track actual moves
let isAnimating = false; // Prevent moves during animation
let lastMove = null; // Track last move for prime notation

// Remove automatic initialization since it's now handled by the loading script
// document.addEventListener('DOMContentLoaded', function() {
//   init();
//   animate();
// });

function init() {
  try {
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
      console.error('Three.js not loaded!');
      document.getElementById('loading').innerHTML = '<p style="color: red;">Error: Three.js library failed to load. Please refresh the page.</p>';
      return;
    }

    console.log('Three.js loaded successfully');

    // Initialize cube group after Three.js is loaded
    cubeGroup = new THREE.Group();
    cubes = []; // Reset cubes array

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Camera - adjusted position to better view the cube
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    // Renderer with improved settings
    renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight * 0.8);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Check if container exists
    const container = document.getElementById("cube-container");
    if (!container) {
      console.error('Cube container not found!');
      return;
    }
    
    container.appendChild(renderer.domElement);
    console.log('Renderer added to container');

    // Controls with improved settings
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 3;
      controls.maxDistance = 20;
      controls.maxPolarAngle = Math.PI;
      console.log('OrbitControls loaded successfully');
    } else {
      console.warn('OrbitControls not loaded');
    }

    // Enhanced lighting system
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, 5, -5);
    scene.add(pointLight);
    
    console.log('Lights added to scene');

    // Add a simple test cube to verify rendering
    const testGeometry = new THREE.BoxGeometry(1, 1, 1);
    const testMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const testCube = new THREE.Mesh(testGeometry, testMaterial);
    testCube.position.set(0, 0, 0);
    scene.add(testCube);
    console.log('Test cube added to scene');

    // Build Rubik's cube (3x3x3 small cubes)
    buildCube();

    scene.add(cubeGroup);
    console.log('Cube built successfully. Total cubes:', cubes.length);
    console.log('Scene children:', scene.children.length);

    // Remove loading screen
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
    }

    // Initialize UI elements
    addSolveButton();
    
    // Resize
    window.addEventListener("resize", onWindowResize);

    // Keyboard moves
    document.addEventListener("keydown", onKeyDown);
    
    // Start animation loop
    animate();
    
    console.log('Initialization complete!');
    
  } catch (error) {
    console.error('Error in init:', error);
    document.getElementById('loading').innerHTML = '<p style="color: red;">Error initializing: ' + error.message + '</p>';
  }
}

function buildCube() {
  try {
    console.log('Building cube...');
    console.log('cubeGroup exists:', !!cubeGroup);
    console.log('THREE exists:', typeof THREE !== 'undefined');
    
    if (!cubeGroup) {
      console.error('cubeGroup is not initialized!');
      return;
    }
    
    cubeGroup.clear();
    cubes = [];
    
    // Define colors for each face with better contrast
    const colors = {
      right: 0xff0000,   // Red
      left: 0xff8c00,    // Orange (darker for better contrast)
      top: 0xffffff,     // White
      bottom: 0xffff00,  // Yellow
      front: 0x00ff00,   // Green
      back: 0x0066ff     // Blue (darker for better contrast)
    };

    // Create materials with better properties
    const createMaterials = (x, y, z) => {
      const materials = [];
      
      // Right face (positive X)
      if (x === 1) {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: colors.right, 
          shininess: 30,
          specular: 0x444444
        }));
      } else {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: 0x222222, 
          shininess: 10,
          specular: 0x111111
        }));
      }
      
      // Left face (negative X)
      if (x === -1) {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: colors.left, 
          shininess: 30,
          specular: 0x444444
        }));
      } else {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: 0x222222, 
          shininess: 10,
          specular: 0x111111
        }));
      }
      
      // Top face (positive Y)
      if (y === 1) {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: colors.top, 
          shininess: 30,
          specular: 0x444444
        }));
      } else {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: 0x222222, 
          shininess: 10,
          specular: 0x111111
        }));
      }
      
      // Bottom face (negative Y)
      if (y === -1) {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: colors.bottom, 
          shininess: 30,
          specular: 0x444444
        }));
      } else {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: 0x222222, 
          shininess: 10,
          specular: 0x111111
        }));
      }
      
      // Front face (positive Z)
      if (z === 1) {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: colors.front, 
          shininess: 30,
          specular: 0x444444
        }));
      } else {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: 0x222222, 
          shininess: 10,
          specular: 0x111111
        }));
      }
      
      // Back face (negative Z)
      if (z === -1) {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: colors.back, 
          shininess: 30,
          specular: 0x444444
        }));
      } else {
        materials.push(new THREE.MeshPhongMaterial({ 
          color: 0x222222, 
          shininess: 10,
          specular: 0x111111
        }));
      }

      return materials;
    };

    let cubeCount = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Skip center cube (it's not visible in a real Rubik's cube)
          if (x === 0 && y === 0 && z === 0) continue;
          
          const materials = createMaterials(x, y, z);
          const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
          const cube = new THREE.Mesh(cubeGeo, materials);
          
          cube.position.set(x, y, z);
          cube.userData = { x, y, z }; // Store position data
          cube.castShadow = true;
          cube.receiveShadow = true;
          
          cubeGroup.add(cube);
          cubes.push(cube);
          cubeCount++;
        }
      }
    }
    
    console.log('Cube built with', cubeCount, 'small cubes');
    console.log('Cube group children:', cubeGroup.children.length);
    console.log('Cubes array length:', cubes.length);
    
  } catch (error) {
    console.error('Error building cube:', error);
    console.error('Error stack:', error.stack);
  }
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / (window.innerHeight * 0.8);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight * 0.8);
}

// Render loop with improved controls
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls for smooth movement
  if (controls) {
    controls.update();
  }
  
  // Debug rendering
  if (renderer && scene && camera) {
    try {
      renderer.render(scene, camera);
      // Log first few frames to confirm rendering is working
      if (window.frameCount === undefined) {
        window.frameCount = 0;
      }
      if (window.frameCount < 5) {
        console.log('Frame rendered:', window.frameCount, 'Scene children:', scene.children.length);
        window.frameCount++;
      }
    } catch (error) {
      console.error('Error in render:', error);
    }
  } else {
    console.warn('Renderer, scene, or camera not ready:', {
      renderer: !!renderer,
      scene: !!scene,
      camera: !!camera
    });
  }
}

// Enhanced key moves with better handling
function onKeyDown(e) {
  if (isAnimating) return; // Prevent moves during animation
  
  let move = null;
  let isPrime = false;
  
  switch (e.key.toUpperCase()) {
    case "R": move = "right"; break;
    case "L": move = "left"; break;
    case "U": move = "up"; break;
    case "D": move = "down"; break;
    case "F": move = "front"; break;
    case "B": move = "back"; break;
    case "'": 
      // Handle prime notation (counter-clockwise)
      if (lastMove) {
        move = lastMove;
        isPrime = true;
      }
      break;
    default: return;
  }
  
  if (move) {
    lastMove = move;
    if (isPrime) {
      // For prime moves, rotate 3 times clockwise = 1 time counter-clockwise
      for (let i = 0; i < 3; i++) {
        rotateFace(move);
      }
    } else {
      rotateFace(move);
    }
    updateMoveCount();
  }
}

// Improved face rotation function with smooth animations
function rotateFace(face) {
  if (isAnimating) return;
  
  isAnimating = true;
  const angle = Math.PI / 2;
  let axis, direction;
  
  switch (face) {
    case "right":
      axis = "x";
      direction = 1;
      break;
    case "left":
      axis = "x";
      direction = -1;
      break;
    case "up":
      axis = "y";
      direction = 1;
      break;
    case "down":
      axis = "y";
      direction = -1;
      break;
    case "front":
      axis = "z";
      direction = 1;
      break;
    case "back":
      axis = "z";
      direction = -1;
      break;
  }
  
  // Create a temporary group for the face being rotated
  const faceGroup = new THREE.Group();
  
  // Find all cubes that belong to this face
  const faceCubes = [];
  cubes.forEach(cube => {
    const { x, y, z } = cube.userData;
    let shouldInclude = false;
    
    switch (face) {
      case "right":
        shouldInclude = (x === 1);
        break;
      case "left":
        shouldInclude = (x === -1);
        break;
      case "up":
        shouldInclude = (y === 1);
        break;
      case "down":
        shouldInclude = (y === -1);
        break;
      case "front":
        shouldInclude = (z === 1);
        break;
      case "back":
        shouldInclude = (z === -1);
        break;
    }
    
    if (shouldInclude) {
      faceCubes.push(cube);
      // Remove from original parent and add to face group
      cubeGroup.remove(cube);
      faceGroup.add(cube);
    }
  });
  
  // Animate the rotation
  const startRotation = faceGroup.rotation[axis];
  const targetRotation = startRotation + (angle * direction);
  const duration = 300; // 300ms for smooth animation
  const startTime = Date.now();
  
  function animateRotation() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Use easing function for smooth animation
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    faceGroup.rotation[axis] = startRotation + (easedProgress * angle * direction);
    
    if (progress < 1) {
      requestAnimationFrame(animateRotation);
    } else {
      // Animation complete, update cube positions and userData
      faceCubes.forEach(cube => {
        const { x, y, z } = cube.userData;
        let newX = x, newY = y, newZ = z;
        
        // Calculate new positions based on rotation
        switch (face) {
          case "right": // Rotate around X-axis
            if (direction === 1) {
              newY = -z;
              newZ = y;
            } else {
              newY = z;
              newZ = -y;
            }
            break;
          case "left": // Rotate around X-axis
            if (direction === 1) {
              newY = z;
              newZ = -y;
            } else {
              newY = -z;
              newZ = y;
            }
            break;
          case "up": // Rotate around Y-axis
            if (direction === 1) {
              newX = z;
              newZ = -x;
            } else {
              newX = -z;
              newZ = x;
            }
            break;
          case "down": // Rotate around Y-axis
            if (direction === 1) {
              newX = -z;
              newZ = x;
            } else {
              newX = z;
              newZ = -x;
            }
            break;
          case "front": // Rotate around Z-axis
            if (direction === 1) {
              newX = -y;
              newY = x;
            } else {
              newX = y;
              newY = -x;
            }
            break;
          case "back": // Rotate around Z-axis
            if (direction === 1) {
              newX = y;
              newY = -x;
            } else {
              newX = -y;
              newY = x;
            }
            break;
        }
        
        // Update cube data
        cube.userData = { x: newX, y: newY, z: newZ };
        cube.position.set(newX, newY, newZ);
      });
      
      // Add the rotated face back to the main cube group
      cubeGroup.add(faceGroup);
      
      // Clean up the temporary group
      faceGroup.children.forEach(cube => {
        faceGroup.remove(cube);
        cubeGroup.add(cube);
      });
      
      // Reset rotation
      faceGroup.rotation[axis] = 0;
      
      isAnimating = false;
      console.log(`Rotated ${face} face`);
    }
  }
  
  animateRotation();
}

// Update move counter
function updateMoveCount() {
  moveCount++;
  const moveCountElement = document.getElementById('move-count');
  if (moveCountElement) {
    moveCountElement.textContent = moveCount;
  }
}

function scrambleCube() {
  if (isAnimating) return;
  
  const moves = ["R", "L", "U", "D", "F", "B"];
  const numMoves = 20; // More moves for better scrambling
  
  console.log('Scrambling cube...');
  
  for (let i = 0; i < numMoves; i++) {
    const move = moves[Math.floor(Math.random() * moves.length)];
    const isPrime = Math.random() > 0.5; // 50% chance of prime move
    
    setTimeout(() => {
      if (isPrime) {
        // For prime moves, rotate 3 times clockwise = 1 time counter-clockwise
        for (let j = 0; j < 3; j++) {
          rotateFace(move.toLowerCase());
        }
      } else {
        rotateFace(move.toLowerCase());
      }
      updateMoveCount();
    }, i * 100); // Stagger moves for visual effect
  }
}

function resetCube() {
  if (isAnimating) return;
  
  console.log('Resetting cube...');
  
  // Reset all cube rotations
  cubeGroup.rotation.set(0, 0, 0);
  
  // Rebuild the cube to original state
  buildCube();
  
  // Reset move counter
  moveCount = 0;
  updateMoveCount();
  
  console.log('Cube reset to solved state');
}

// Basic solver algorithm
function solveCube() {
  if (isAnimating) return;
  
  console.log('Solving cube...');
  isAnimating = true;
  
  // This is a simplified solver that just resets the cube
  // In a real implementation, you'd analyze the current state
  // and apply the reverse of the scramble sequence
  
  // For now, we'll just reset it
  setTimeout(() => {
    resetCube();
    isAnimating = false;
    console.log('Cube solved!');
  }, 500);
}

// Check if cube is solved
function isCubeSolved() {
  // This is a simplified check - in reality you'd check each face
  // For now, we'll assume it's solved if no moves have been made
  return moveCount === 0;
}

// Add solve button functionality (if needed for dynamic addition)
function addSolveButton() {
  // This function is kept for potential future use
  // Currently the solve button is added directly in HTML
  console.log('Solve button functionality initialized');
}
