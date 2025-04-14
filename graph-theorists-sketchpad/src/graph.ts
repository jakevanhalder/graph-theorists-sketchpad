import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

interface Edge {
  line: THREE.Object3D;
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
  private selectedEdge: Edge | null;

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
    this.selectedEdge = null;

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
    window.addEventListener('wheel', this.onWheel.bind(this), { passive: false, capture: true });
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
      this.createPreviewNode();
      this.updatePreviewNodePosition();
    } else if (key === 'd') {
      if (this.firstSelectedSphere) {
        console.log('Deleting selected node and its associated edges.');
        this.deleteNodeAndEdges(this.firstSelectedSphere);
        this.firstSelectedSphere = null;
      } else if (this.selectedEdge) {
        console.log('Deleting selected edge.');
        this.deleteEdge(this.selectedEdge);
        this.selectedEdge = null;
      } else {
        console.log('No node or edge selected for deletion.');
      }
    }
  }

  private onRightClick(event: MouseEvent): void {
    event.preventDefault();

    if (this.nodeCreationMode) {
      this.exitNodeCreationMode();
      console.log('Node creation mode canceled.');
    } else {
      if (this.firstSelectedSphere) {
        if (this.firstSelectedSphere.material instanceof THREE.MeshPhongMaterial) {
          this.firstSelectedSphere.material.emissive.set(0x000000);
        }
        this.firstSelectedSphere = null;
        console.log('Node deselected.');
      }
      if (this.selectedEdge) {
        this.deselectEdge();
        console.log('Edge deselected.');
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.nodeCreationMode && this.previewSphere) {
      this.updatePreviewNodePosition();
    }
  }

  private onWheel(event: WheelEvent): void {
    if (this.nodeCreationMode && this.previewSphere) {
      event.preventDefault();
      event.stopPropagation();

      // Adjust the preview distance (scroll up to decrease, scroll down to increase)
      this.previewDistance += event.deltaY * 0.05;
      if (this.previewDistance < 1) this.previewDistance = 1;
      this.updatePreviewNodePosition();
    }
  }

  private onClick(_event: MouseEvent): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.nodeCreationMode && this.previewSphere) {
      // Confirm node placement using the current preview sphere position.
      this.createNode(this.previewSphere.position.clone());
      this.exitNodeCreationMode();
      return;
    }

    const sphereIntersections = this.raycaster.intersectObjects(this.spheres);
    if (sphereIntersections.length > 0) {
      if (this.selectedEdge) {
        this.deselectEdge();
      }
      const clickedSphere = sphereIntersections[0].object as THREE.Mesh;
      this.selectNode(clickedSphere);
      return;
    }

    (this.raycaster as any).linePrecision = 0.1;
    const edgeIntersections = this.raycaster.intersectObjects(this.edges.map(e => e.line));
    if (edgeIntersections.length > 0) {
      const clickedLine = edgeIntersections[0].object as THREE.Object3D;
      const edge = this.edges.find(e => e.line === clickedLine);
      if (edge) {
        if (this.selectedEdge === edge) {
          this.deselectEdge();
        } else {
          this.selectEdge(edge);
        }
      }
      return;
    }
  }

  // -----------------------------
  // Node Creation, Preview, and Deletion Methods
  // -----------------------------

  private createPreviewNode(): void {
    const geometry = new THREE.SphereGeometry(0.5, 32, 16);
    const material = new THREE.MeshPhongMaterial({
      color: '#0077ff',
      opacity: 0.5,
      transparent: true,
    });
    this.previewSphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.previewSphere);
  }

  private updatePreviewNodePosition(): void {
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

  public createNode(position: THREE.Vector3): void {
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

  private selectNode(clickedSphere: THREE.Mesh): void {
    if (!this.firstSelectedSphere) {
      this.firstSelectedSphere = clickedSphere;
      if (clickedSphere.material instanceof THREE.MeshPhongMaterial) {
        clickedSphere.material.emissive.set(0x333333);
      }
      if (this.selectedEdge) {
        this.deselectEdge();
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

  private deselectNode(): void {
    if (this.firstSelectedSphere != null && this.firstSelectedSphere.material instanceof THREE.MeshPhongMaterial) {
      this.firstSelectedSphere.material.emissive.set(0x000000);
    }

    this.firstSelectedSphere = null;
  }

  // -----------------------------
  // Edge Creation & Deletion Methods
  // -----------------------------

  public createEdge(sphere1: THREE.Mesh, sphere2: THREE.Mesh): void {
    const positions = [
      sphere1.position.x, sphere1.position.y, sphere1.position.z,
      sphere2.position.x, sphere2.position.y, sphere2.position.z
    ];

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    const material = new LineMaterial({
      color: 0xff0000,
      linewidth: 5,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    const line = new Line2(geometry, material);
    line.computeLineDistances();
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

  private deleteEdge(edge: Edge): void {
    this.scene.remove(edge.line);
    this.edges = this.edges.filter(e => e !== edge);
  }

  private selectEdge(edge: Edge): void {
    if (this.selectedEdge && this.selectedEdge !== edge) {
      this.deselectEdge();
    }

    if (this.firstSelectedSphere != null) {
      this.deselectNode();
    }

    if ((edge.line as any).material) {
      (edge.line as any).material.color.set(0x00ff00);
      (edge.line as any).material.needsUpdate = true;
    }

    this.selectedEdge = edge;
  }

  private deselectEdge(): void {
    if (this.selectedEdge && (this.selectedEdge.line as any)) {
      (this.selectedEdge.line as any).material.color.set(0xff0000);
      (this.selectedEdge.line as any).material.needsUpdate = true;
    }

    this.selectedEdge = null;
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
