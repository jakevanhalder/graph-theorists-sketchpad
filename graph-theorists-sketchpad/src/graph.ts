import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface Edge {
  line: THREE.Line;
  sphere1: THREE.Mesh;
  sphere2: THREE.Mesh;
}

export class Graph {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private spheres: THREE.Mesh[];
  private edges: Edge[];
  private firstSelectedSphere: THREE.Mesh | null;

  private plane: THREE.Mesh;

  // Node creation mode state:
  private nodeCreationMode: boolean = false;
  private previewSphere: THREE.Mesh | null = null;
  private previewDistance: number = 10;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    controls: OrbitControls
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.spheres = [];
    this.edges = [];
    this.firstSelectedSphere = null;

    // Create an invisible plane (horizontal) for positioning calculations.
    const planeGeo = new THREE.PlaneGeometry(200, 200);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xeeeeee,
      side: THREE.DoubleSide,
      visible: false,
    });
    this.plane = new THREE.Mesh(planeGeo, planeMat);
    this.plane.rotation.x = -Math.PI / 2;
    this.scene.add(this.plane);

    // Listeners: clicks, contextmenu (right-click), mousemove, wheel, and keydown.
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this), false);
    this.renderer.domElement.addEventListener('contextmenu', this.onRightClick.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    window.addEventListener('wheel', this.onWheel.bind(this), false);
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
  }

  // -----------------------------
  // Event Handlers
  // -----------------------------
  
  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (key === 'v' && !this.nodeCreationMode) {
      this.nodeCreationMode = true;
      this.previewDistance = 10;
      console.log('Node creation mode enabled.');
      this.controls.enabled = false;
      this.createPreviewSphere();
      this.updatePreviewSpherePosition();
    } else if (key === 'd') {
      if (this.firstSelectedSphere) {
        console.log('Deleting selected node and its associated edges.');
        this.deleteNodeAndEdges(this.firstSelectedSphere);
        this.firstSelectedSphere = null;
      } else {
        console.log('No node selected for deletion.');
      }
    }
  }

  private onRightClick(event: MouseEvent): void {
    if (this.nodeCreationMode) {
      event.preventDefault();
      this.exitNodeCreationMode();
      console.log('Node creation mode canceled.');
    }
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.nodeCreationMode && this.previewSphere) {
      this.updatePreviewSpherePosition();
    }
  }

  private onWheel(event: WheelEvent): void {
    if (this.nodeCreationMode && this.previewSphere) {
      event.preventDefault();
      event.stopPropagation();

      // Adjust the preview distance (scroll up to decrease, scroll down to increase)
      this.previewDistance += event.deltaY * 0.05;
      if (this.previewDistance < 1) this.previewDistance = 1;
      this.updatePreviewSpherePosition();
    }
  }

  private onClick(_event: MouseEvent): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.nodeCreationMode && this.previewSphere) {
      // Confirm node placement using the current preview sphere position.
      this.createSphere(this.previewSphere.position.clone());
      this.exitNodeCreationMode();
      return;
    }

    // Not in node creation mode: try to select an existing sphere for edge creation.
    const intersects = this.raycaster.intersectObjects(this.spheres);
    if (intersects.length > 0) {
      const clickedSphere = intersects[0].object as THREE.Mesh;
      this.handleSphereClick(clickedSphere);
    }
  }

  // -----------------------------
  // Node Creation, Preview, and Deletion Methods
  // -----------------------------

  private createPreviewSphere(): void {
    const geometry = new THREE.SphereGeometry(0.5, 32, 16);
    const material = new THREE.MeshPhongMaterial({
      color: '#0077ff',
      opacity: 0.5,
      transparent: true,
    });
    this.previewSphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.previewSphere);
  }

  private updatePreviewSpherePosition(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const newPos = new THREE.Vector3()
      .copy(this.raycaster.ray.direction)
      .multiplyScalar(this.previewDistance)
      .add(this.camera.position);
    if (this.previewSphere) {
      this.previewSphere.position.copy(newPos);
    }
  }

  private exitNodeCreationMode(): void {
    if (this.previewSphere) {
      this.scene.remove(this.previewSphere);
      this.previewSphere = null;
    }
    this.nodeCreationMode = false;
    this.controls.enabled = true;
  }

  public createSphere(position: THREE.Vector3): void {
    const sphereRadius = 0.5;
    const widthSegments = 32;
    const heightSegments = 16;
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, widthSegments, heightSegments);
    const sphereMaterial = new THREE.MeshPhongMaterial({ color: '#0077ff' });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    this.scene.add(sphere);
    this.spheres.push(sphere);
  }

  private handleSphereClick(clickedSphere: THREE.Mesh): void {
    if (!this.firstSelectedSphere) {
      this.firstSelectedSphere = clickedSphere;
      if (clickedSphere.material instanceof THREE.MeshPhongMaterial) {
        clickedSphere.material.emissive.set(0x333333);
      }
    } else if (this.firstSelectedSphere === clickedSphere) {
      if (clickedSphere.material instanceof THREE.MeshPhongMaterial) {
        clickedSphere.material.emissive.set(0x000000);
      }
      this.firstSelectedSphere = null;
    } else {
      this.createEdge(this.firstSelectedSphere, clickedSphere);
      if (this.firstSelectedSphere.material instanceof THREE.MeshPhongMaterial) {
        this.firstSelectedSphere.material.emissive.set(0x000000);
      }
      this.firstSelectedSphere = null;
    }
  }

  public createEdge(sphere1: THREE.Mesh, sphere2: THREE.Mesh): void {
    const points: THREE.Vector3[] = [sphere1.position, sphere2.position];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Store edge for potential deletion later
    this.edges.push({ line, sphere1, sphere2 });
  }

  private deleteNodeAndEdges(node: THREE.Mesh): void {
    this.scene.remove(node);
    this.spheres = this.spheres.filter(s => s !== node);

    const edgesToDelete = this.edges.filter(edge => edge.sphere1 === node || edge.sphere2 === node);
    edgesToDelete.forEach(edge => {
      this.scene.remove(edge.line);
    });

    this.edges = this.edges.filter(edge => edge.sphere1 !== node && edge.sphere2 !== node);
  }

  // -----------------------------
  // Update Method for Animation Loop
  // -----------------------------

  public update(): void {
    if (this.previewSphere) {
      const scaleFactor = 1 + 0.2 * Math.sin(Date.now() * 0.005);
      this.previewSphere.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
  }
}
