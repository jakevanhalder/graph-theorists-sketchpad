import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene object - is the display for our graph
const scene = new THREE.Scene();
scene.background = new THREE.Color('#121212'); /* TODO: Change the background to make graphs more discernible. */

// Camera object
const fov = 65;
const aspect = 2;
const near = 0.1;
const far = 100;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(0, 10, 30);

// Renderer object - renders our canvas
const renderer = new THREE.WebGLRenderer();

// Set the initial size
renderer.setSize(window.innerWidth, window.innerHeight);

// Update size on window resize
function setSize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', () => {
  setSize();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Runs the renderers animation loop
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Controls object - allows the user to move around the scene
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.update();

// Handles light within the scene
const skyColor = 0xF5F5F5;
const groundColor = 0x444444;
const intensity = 1;
const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
scene.add(light);

const cubeSize = 4;
const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const cubeMat = new THREE.MeshPhongMaterial({ color: '#8AC' });
const mesh2 = new THREE.Mesh(cubeGeo, cubeMat);
mesh2.position.set(cubeSize + 1, cubeSize / 2, 0);
scene.add(mesh2);

const sphereRadius = 3;
const sphereWidthDivisions = 32;
const sphereHeightDivisions = 16;
const sphereGeo = new THREE.SphereGeometry(sphereRadius, sphereWidthDivisions, sphereHeightDivisions);
const sphereMat = new THREE.MeshPhongMaterial({ color: '#CA8' });
const mesh = new THREE.Mesh(sphereGeo, sphereMat);
mesh.position.set(-sphereRadius - 1, sphereRadius + 2, 0);
scene.add(mesh);

// Animate loop - updates the scene constantly frame by frame
function animate() {
  renderer.render(scene, camera);
}