import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Graph } from './graph';
import { GraphGUI } from './graph_gui';
import { CSS2DRenderer } from 'three/examples/jsm/Addons.js';

// Scene object - is the display for our graph
const scene = new THREE.Scene();
scene.background = new THREE.Color('#121212'); /* TODO: Change the background to make graphs more discernible. */

// Camera object
const fov = 65;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
camera.position.set(0, 10, 30);

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// OrbitControls - Allows the user to move around the scene
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.update();

// Create the CSS2DRenderer and add its output to the DOM
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// Lighting
const skyColor = 0xF5F5F5;
const groundColor = 0x444444;
const intensity = 1;
const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
scene.add(light);

// Instantiate our graph
const graph = new Graph(scene, camera, renderer, controls);

// Instantiate our GUI
new GraphGUI(graph);

// Status bar
const statusBar = document.getElementById('status-bar');

// Whenever the graph changes, update the status bar:
graph.onGraphChanged = () => {
  if (statusBar) {
    statusBar.textContent = `Vertices: ${graph.getNodeCount()} | Edges: ${graph.getEdgeCount()}`;
  }
};

graph.onGraphChanged();

// Animation loop
function animate() {
  graph.update();
  labelRenderer.render(scene, camera);
  renderer.render(scene, camera);
}

// Resize handling
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});
