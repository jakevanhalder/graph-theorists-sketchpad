import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CSS2DObject } from 'three/examples/jsm/Addons.js';

interface Edge {
  line: Line2;
  sphere1: THREE.Mesh;
  sphere2: THREE.Mesh;
  isLoop: boolean;
  parallelOffset?: number;
  isBridge?: boolean;
  arrowHead?: THREE.ArrowHelper;
}

export class Graph {
  public onGraphChanged: () => void = () => { };

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

  // ID counters
  private nodeCounter: number = 0;
  private edgeCounter: number = 0;

  // Callbacks for GUI updates
  public onNodeSelected: ((node: THREE.Mesh) => void) | null = null;
  public onNodeDeselected: (() => void) | null = null;

  // Dragging functionality flag
  private dragActive: boolean = false;

  // NEW: flag whether the graph is directed.
  public directed: boolean = false;
  public arrowSize: number = 1;
  public arrowColor: number = 0xffffff;

  // Getter methods for node and edge counts
  public getNodeCount(): number {
    return this.spheres.length;
  }

  public getEdgeCount(): number {
    return this.edges.length;
  }

  // Get the degree of a node
  public getDegree(node: THREE.Mesh): number {
    return this.edges.filter(e => e.sphere1 === node || e.sphere2 === node).length;
  }

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

    // Event listeners.
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this), false);
    this.renderer.domElement.addEventListener('contextmenu', this.onRightClick.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    window.addEventListener('wheel', this.onWheel.bind(this), { passive: false, capture: true });
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('mouseup', this.onMouseUp.bind(this), false);
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
    } else if (key === 'm') {
      if (this.getSelectedNode()) {
        this.dragActive = true;
        console.log('Drag mode enabled for selected node.');
      }
    } else if (key === 'd') {
      if (this.firstSelectedSphere) {
        console.log('Deleting selected node and its associated edges.');
        this.deleteNodeAndEdges(this.firstSelectedSphere);
        if (this.onNodeDeselected) {
          this.onNodeDeselected();
        }
        this.firstSelectedSphere = null;
      } else if (this.selectedEdge) {
        console.log('Deleting selected edge.');
        const s1 = this.selectedEdge.sphere1;
        const s2 = this.selectedEdge.sphere2;
        this.deleteEdge(this.selectedEdge);
        if (s1 !== s2) {
          this.updateParallelEdgesForNodes(s1, s2);
        }
        this.selectedEdge = null;
      } else {
        console.log('No node or edge selected for deletion.');
      }

      this.updateAllNodeLabels();
      this.updateAllEdgeLabels();
    }
  }

  private onRightClick(event: MouseEvent): void {
    event.preventDefault();

    if (this.nodeCreationMode) {
      this.exitNodeCreationMode();
      console.log('Node creation mode canceled.');
    } else {
      if (this.firstSelectedSphere) {
        this.deselectNode();
        console.log('Node deselected.');
        if (this.onNodeDeselected) {
          this.onNodeDeselected();
        }
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
    if (this.dragActive && this.firstSelectedSphere) {
      const node = this.firstSelectedSphere;
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -node.position.y);
      const newPos = new THREE.Vector3();
      this.raycaster.setFromCamera(this.mouse, this.camera);
      if (this.raycaster.ray.intersectPlane(dragPlane, newPos)) {
        node.position.copy(newPos);
        this.updateEdgesForNode(node);
      }
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

  private onMouseUp(_event: MouseEvent): void {
    if (this.dragActive) {
      this.dragActive = false;
      console.log('Drag mode disabled.');
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
    const nodeId = ++this.nodeCounter;

    const sphereRadius = 0.5;
    const widthSegments = 32;
    const heightSegments = 16;
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, widthSegments, heightSegments);
    const sphereMaterial = new THREE.MeshPhongMaterial({ color: '#0077ff' });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    this.scene.add(sphere);
    this.spheres.push(sphere);

    sphere.userData.radius = sphereRadius;

    const div = document.createElement('div');
    div.className = 'node-label';
    div.textContent = 'v' + nodeId;
    div.style.marginTop = '-1em';
    div.style.color = 'white';
    div.style.fontSize = '16px';

    const label = new CSS2DObject(div);
    label.position.set(0, sphereRadius + 0.2, 0);
    sphere.add(label);

    sphere.userData.labelObject = label;
    this.onGraphChanged();
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
      if (this.onNodeSelected) {
        this.onNodeSelected(clickedSphere);
      }
    } else {
      this.createEdge(this.firstSelectedSphere, clickedSphere);
      this.deselectNode();
    }
  }

  private deselectNode(): void {
    if (this.firstSelectedSphere && this.firstSelectedSphere.material instanceof THREE.MeshPhongMaterial) {
      this.firstSelectedSphere.material.emissive.set(0x000000);
    }

    this.firstSelectedSphere = null;
    if (this.onNodeDeselected) {
      this.onNodeDeselected();
    }
  }

  public getSelectedNode(): THREE.Mesh | null {
    return this.firstSelectedSphere;
  }

  public updateNodeLabel(newLabel: string): void {
    const node = this.firstSelectedSphere;
    if (node && node.userData.labelObject) {
      (node.userData.labelObject as CSS2DObject).element.textContent = newLabel;
    }
  }

  // -----------------------------
  // New Helper Functions for Curved and Loop Edges
  // -----------------------------

  private createCurvedEdgePoints(sphere1: THREE.Mesh, sphere2: THREE.Mesh, offset: number): number[] {
    const midPoint = new THREE.Vector3().addVectors(sphere1.position, sphere2.position).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(sphere2.position, sphere1.position);
    const perp = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const controlPoint = midPoint.clone().add(perp.multiplyScalar(offset));
    const curve = new THREE.QuadraticBezierCurve3(sphere1.position, controlPoint, sphere2.position);
    const curvePoints = curve.getPoints(20);
    const positions: number[] = [];
    curvePoints.forEach(pt => {
      positions.push(pt.x, pt.y, pt.z);
    });
    return positions;
  }

  private createLoopEdgePoints(
    node: THREE.Mesh,
    loopRadius: number,
    bulge: number
  ): number[] {
    const segments = 32;
    const positions: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI;
      const r = loopRadius + bulge * Math.sin(theta);
      const x = node.position.x + r * Math.cos(theta);
      const y = node.position.y;
      const z = node.position.z + r * Math.sin(theta);
      positions.push(x, y, z);
    }
    return positions;
  }

  // -----------------------------
  // Edge Creation & Deletion Methods
  // -----------------------------

  public createEdge(sphere1: THREE.Mesh, sphere2: THREE.Mesh): void {
    const edgeId = ++this.edgeCounter;
    let positions: number[] = [];
    let isLoop = false;
    let usedOffset: number | undefined = undefined;

    if (sphere1 === sphere2) {
      const existingLoop = this.edges.find(edge =>
        edge.isLoop && edge.sphere1 === sphere1
      );
      if (existingLoop) {
        console.log('A loop already exists for this node');
        return;
      }
      isLoop = true;
      const sphereRadius = sphere1.userData.radius as number;
      const loopRadius = sphereRadius;
      const bulge = 0.3;
      positions = this.createLoopEdgePoints(sphere1, loopRadius, bulge);
    } else {
      const parallelCount = this.edges.filter(edge =>
        !edge.isLoop &&
        ((edge.sphere1 === sphere1 && edge.sphere2 === sphere2) ||
          (edge.sphere1 === sphere2 && edge.sphere2 === sphere1))
      ).length;

      const baseOffset = 0.5;
      const offsetIndex = Math.ceil(parallelCount / 2);
      const sign = (parallelCount % 2 === 0) ? 1 : -1;
      usedOffset = sign * offsetIndex * baseOffset;
      positions = this.createCurvedEdgePoints(sphere1, sphere2, usedOffset);
    }

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

    const newEdge: Edge = {
      line,
      sphere1,
      sphere2,
      isLoop,
      parallelOffset: usedOffset,
    };
    this.edges.push(newEdge);

    if (!isLoop) {
      this.updateParallelEdgesForNodes(sphere1, sphere2);
    }

    // Create and attach an edge label.
    const div = document.createElement('div');
    div.className = 'edge-label';
    div.textContent = 'e' + edgeId;
    div.style.marginTop = '-1em';
    div.style.color = 'white';
    div.style.fontSize = '16px';

    const label = new CSS2DObject(div);
    if (!isLoop) {
      const midIdx = Math.floor(positions.length / 6);
      const midPoint = new THREE.Vector3(
        positions[midIdx * 3],
        positions[midIdx * 3 + 1],
        positions[midIdx * 3 + 2]
      );
      const midPointLocal = midPoint.clone();
      line.worldToLocal(midPointLocal);
      label.position.copy(midPointLocal);
    } else {
      const quarterIdx = Math.floor(positions.length / 4);
      const labelPoint = new THREE.Vector3(
        positions[quarterIdx * 3],
        positions[quarterIdx * 3 + 1],
        positions[quarterIdx * 3 + 2]
      );
      const labelPointLocal = labelPoint.clone();
      line.worldToLocal(labelPointLocal);
      label.position.copy(labelPointLocal);
    }
    line.add(label);

    if (this.directed && !isLoop) {
      this.addArrowhead(newEdge);
    }

    this.onGraphChanged();
  }

  private deleteNodeAndEdges(node: THREE.Mesh): void {
    --this.nodeCounter;
    node.children
      .filter(child => child instanceof CSS2DObject)
      .forEach(label => node.remove(label));
    this.scene.remove(node);
    this.spheres = this.spheres.filter(s => s !== node);

    const edgesToDelete = this.edges.filter(edge => edge.sphere1 === node || edge.sphere2 === node);
    edgesToDelete.forEach(edge => {
      --this.edgeCounter;
      edge.line.children
        .filter(child => child instanceof CSS2DObject)
        .forEach(label => edge.line.remove(label));
      this.scene.remove(edge.line);
    });

    this.edges = this.edges.filter(edge => edge.sphere1 !== node && edge.sphere2 !== node);

    this.updateAllNodeLabels();
    this.updateAllEdgeLabels();
    this.onGraphChanged();
  }

  private deleteEdge(edge: Edge): void {
    --this.edgeCounter;
    edge.line.children
      .filter(child => child instanceof CSS2DObject)
      .forEach(label => edge.line.remove(label));
    this.scene.remove(edge.line);
    this.edges = this.edges.filter(e => e !== edge);

    this.updateAllEdgeLabels();
    this.onGraphChanged();
  }

  private selectEdge(edge: Edge): void {
    if (this.selectedEdge && this.selectedEdge !== edge) {
      this.deselectEdge();
    }
    if (this.firstSelectedSphere) {
      this.deselectNode();
    }

    if ((edge.line as any).material) {
      (edge.line as any).material.color.set(0x00ff00);
      (edge.line as any).material.needsUpdate = true;
    }

    this.selectedEdge = edge;
  }

  private deselectEdge(): void {
    if (this.selectedEdge && (this.selectedEdge.line as any).material) {
      (this.selectedEdge.line as any).material.color.set(0xff0000);
      (this.selectedEdge.line as any).material.needsUpdate = true;
    }
    this.selectedEdge = null;
  }

  public updateAllNodeLabels(): void {
    let count = 1;
    this.spheres.forEach(sphere => {
      if (sphere.userData.labelObject) {
        (sphere.userData.labelObject as CSS2DObject).element.textContent = 'v' + count;
      }
      count++;
    });
    this.nodeCounter = this.spheres.length;
  }

  public updateAllEdgeLabels(): void {
    let count = 1;
    this.edges.forEach(edge => {
      edge.line.children.forEach(child => {
        if (child instanceof CSS2DObject) {
          child.element.textContent = 'e' + count;
        }
      });
      count++;
    });
    this.edgeCounter = this.edges.length;
  }

  // -----------------------------
  // Update Edges When a Node Moves (e.g., during dragging)
  // -----------------------------

  private updateEdgesForNode(node: THREE.Mesh): void {
    this.edges.forEach(edge => {
      if (edge.sphere1 === node || edge.sphere2 === node) {
        let positions: number[] = [];
        if (edge.isLoop) {
          const sphereRadius = edge.sphere1.userData.radius as number;
          const bulge = 0.3;
          positions = this.createLoopEdgePoints(edge.sphere1, sphereRadius, bulge);
        } else {
          const offset = edge.parallelOffset || 0;
          positions = this.createCurvedEdgePoints(edge.sphere1, edge.sphere2, offset);
        }
        (edge.line as any).geometry.setPositions(positions);

        edge.line.children.forEach(child => {
          if (child instanceof CSS2DObject) {
            let mid: THREE.Vector3;
            if (!edge.isLoop) {
              const midIdx = Math.floor(positions.length / 6);
              mid = new THREE.Vector3(
                positions[midIdx * 3],
                positions[midIdx * 3 + 1],
                positions[midIdx * 3 + 2]
              );
            } else {
              const quarterIdx = Math.floor(positions.length / 4);
              mid = new THREE.Vector3(
                positions[quarterIdx * 3],
                positions[quarterIdx * 3 + 1],
                positions[quarterIdx * 3 + 2]
              );
            }
            const midLocal = mid.clone();
            edge.line.worldToLocal(midLocal);
            child.position.copy(midLocal);
          }
        });

        if (!edge.isLoop) {
          this.addArrowhead(edge);
        }
      }
    });
  }

  // -----------------------------
  // Helper Method to Add Arrowheads
  // -----------------------------
  private addArrowhead(edge: Edge): void {
    if (edge.isLoop) return;

    const sphere1Pos = edge.sphere1.position;
    const sphere2Pos = edge.sphere2.position;
    const offset = edge.parallelOffset || 0;

    const midPoint = new THREE.Vector3().addVectors(sphere1Pos, sphere2Pos).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(sphere2Pos, sphere1Pos);
    const perp = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const controlPoint = midPoint.clone().add(perp.multiplyScalar(offset));

    const curve = new THREE.QuadraticBezierCurve3(
      sphere1Pos,
      controlPoint,
      sphere2Pos
    );

    const exactMidpoint = curve.getPoint(0.5);

    const tangent = curve.getTangent(0.5).normalize();
    
    this.removeArrowhead(edge);

    const arrowHelper = new THREE.ArrowHelper(
      tangent,
      exactMidpoint,
      this.arrowSize,
      this.arrowColor,
      this.arrowSize * 0.5,
      this.arrowSize * 0.3
    );

    arrowHelper.visible = this.directed;
    
    this.scene.add(arrowHelper);
    edge.arrowHead = arrowHelper;
  }

  // -----------------------------
  // Method to Toggle Arrowheads and Update Positions
  // -----------------------------
  public updateDirectedEdges(): void {
    this.edges.forEach(edge => {
      if (!edge.isLoop) {
        if (edge.sphere1 && edge.sphere2) {
          this.addArrowhead(edge);
        }
      }
    });
  }

  // -----------------------------
  // Arrow Size Setter Method
  // -----------------------------
  public updateArrowSizes(): void {
    this.edges.forEach(edge => {
      if (edge.arrowHead) {
        
        edge.arrowHead.setLength(
          this.arrowSize, 
          this.arrowSize * 0.5, 
          this.arrowSize * 0.3
        );
      }
    });
  }

  // -----------------------------
  // Helper to Update Parallel Edge Offsets Between Two Nodes
  // -----------------------------

  private updateParallelEdgesForNodes(sphere1: THREE.Mesh, sphere2: THREE.Mesh): void {
    const baseOffset = 0.5;
    const relatedEdges = this.edges.filter(edge =>
      !edge.isLoop &&
      ((edge.sphere1 === sphere1 && edge.sphere2 === sphere2) ||
        (edge.sphere1 === sphere2 && edge.sphere2 === sphere1))
    );
    const count = relatedEdges.length;
    if (count <= 1) return;

    relatedEdges.sort((a, b) => (a.parallelOffset || 0) - (b.parallelOffset || 0));
    const mid = Math.floor(count / 2);

    relatedEdges.forEach((edge, i) => {
      const newOffset = (i - mid) * baseOffset;
      edge.parallelOffset = newOffset;

      const positions = this.createCurvedEdgePoints(edge.sphere1, edge.sphere2, newOffset);
      (edge.line as any).geometry.setPositions(positions);

      edge.line.children.forEach(child => {
        if (child instanceof CSS2DObject) {
          const midIdx = Math.floor(positions.length / 6);
          const midPoint = new THREE.Vector3(
            positions[midIdx * 3],
            positions[midIdx * 3 + 1],
            positions[midIdx * 3 + 2]
          );
          const midPointLocal = midPoint.clone();
          edge.line.worldToLocal(midPointLocal);
          child.position.copy(midPointLocal);
        }
      });
    });
  }

  // -----------------------------
  // Connected Component and Bridge Detection Methods
  // -----------------------------

  public getConnectedComponents(): THREE.Mesh[][] {
    const nodeCount = this.spheres.length;
    if (nodeCount === 0) return [];

    const nodeToIndex = new Map<THREE.Mesh, number>();
    this.spheres.forEach((node, idx) => nodeToIndex.set(node, idx));

    const adj: number[][] = Array.from({ length: nodeCount }, () => []);
    this.edges.forEach(edge => {
      if (edge.sphere1 === edge.sphere2) return;
      const i = nodeToIndex.get(edge.sphere1)!;
      const j = nodeToIndex.get(edge.sphere2)!;
      adj[i].push(j);
      adj[j].push(i);
    });

    const visited = new Array(nodeCount).fill(false);
    const components: THREE.Mesh[][] = [];
    const dfs = (i: number, comp: THREE.Mesh[]) => {
      visited[i] = true;
      comp.push(this.spheres[i]);
      for (const neighbor of adj[i]) {
        if (!visited[neighbor]) {
          dfs(neighbor, comp);
        }
      }
    };

    for (let i = 0; i < nodeCount; i++) {
      if (!visited[i]) {
        const comp: THREE.Mesh[] = [];
        dfs(i, comp);
        components.push(comp);
      }
    }
    return components;
  }

  public highlightComponents(): void {
    const palette = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0'];
    const components = this.getConnectedComponents();
    console.log(`Found ${components.length} connected components.`);
    components.forEach((component, index) => {
      const color = new THREE.Color(palette[index % palette.length]);
      component.forEach(node => {
        if (node.material instanceof THREE.MeshPhongMaterial) {
          node.material.color.copy(color);
        }
      });
    });
  }

  public detectBridgeEdges(): Edge[] {
    const n = this.spheres.length;
    const nodeToIndex = new Map<THREE.Mesh, number>();
    this.spheres.forEach((node, idx) => nodeToIndex.set(node, idx));

    const adj: number[][] = Array.from({ length: n }, () => []);
    const edgeCount = new Map<string, number>();
    this.edges.forEach(edge => {
      if (edge.sphere1 === edge.sphere2) return;
      const i = nodeToIndex.get(edge.sphere1)!;
      const j = nodeToIndex.get(edge.sphere2)!;
      const key = [Math.min(i, j), Math.max(i, j)].join('-');
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      adj[i].push(j);
      adj[j].push(i);
    });

    const disc: number[] = new Array(n).fill(-1);
    const low: number[] = new Array(n).fill(-1);
    let time = 0;
    const bridges: Edge[] = [];

    const dfs = (u: number, parent: number) => {
      disc[u] = low[u] = time++;
      for (const v of adj[u]) {
        if (disc[v] === -1) {
          dfs(v, u);
          low[u] = Math.min(low[u], low[v]);
          if (low[v] > disc[u]) {
            const key = [Math.min(u, v), Math.max(u, v)].join('-');
            if ((edgeCount.get(key) || 0) === 1) {
              this.edges.forEach(edge => {
                if (edge.sphere1 !== edge.sphere2) {
                  const i1 = nodeToIndex.get(edge.sphere1)!;
                  const i2 = nodeToIndex.get(edge.sphere2)!;
                  if ((i1 === u && i2 === v) || (i1 === v && i2 === u)) {
                    bridges.push(edge);
                  }
                }
              });
            }
          }
        } else if (v !== parent) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    };

    for (let i = 0; i < n; i++) {
      if (disc[i] === -1) {
        dfs(i, -1);
      }
    }
    return bridges;
  }

  public highlightBridges(): void {
    this.edges.forEach(edge => {
      edge.isBridge = false;
      if ((edge.line as any).material) {
        (edge.line as any).material.color.set(0xff0000);
      }
    });

    const bridges = this.detectBridgeEdges();
    console.log(`Detected ${bridges.length} bridge edge(s).`);
    bridges.forEach(edge => {
      edge.isBridge = true;
      if ((edge.line as any).material) {
        (edge.line as any).material.color.set(0xff0000);
      }
    });
  }

  public resetHighlights(): void {
    const defaultNodeColor = new THREE.Color('#0077ff');
    const defaultEdgeColor = new THREE.Color(0xff0000);

    this.spheres.forEach(node => {
      if (node.material instanceof THREE.MeshPhongMaterial) {
        node.material.color.copy(defaultNodeColor);
      }
    });

    this.edges.forEach(edge => {
      edge.isBridge = false;
      if ((edge.line as any).material) {
        (edge.line as any).material.color.copy(defaultEdgeColor);
      }
    });

    console.log('Highlights and checks have been reset.');
  }

  public checkBipartite(): { bipartite: boolean, partitions?: Map<THREE.Mesh, number> } {
    const n = this.spheres.length;
    const nodeToIndex = new Map<THREE.Mesh, number>();
    this.spheres.forEach((node, i) => nodeToIndex.set(node, i));

    const adj: number[][] = Array.from({ length: n }, () => []);
    this.edges.forEach(edge => {
      if (edge.sphere1 === edge.sphere2) return;
      const i = nodeToIndex.get(edge.sphere1)!;
      const j = nodeToIndex.get(edge.sphere2)!;
      adj[i].push(j);
      adj[j].push(i);
    });

    const colors = new Array(n).fill(-1);
    let bipartite = true;

    for (let i = 0; i < n; i++) {
      if (colors[i] === -1) {
        colors[i] = 0;
        const queue: number[] = [i];
        while (queue.length) {
          const u = queue.shift()!;
          for (const v of adj[u]) {
            if (colors[v] === -1) {
              colors[v] = 1 - colors[u];
              queue.push(v);
            } else if (colors[v] === colors[u]) {
              bipartite = false;
              break;
            }
          }
          if (!bipartite) break;
        }
      }
      if (!bipartite) break;
    }

    const partitions = new Map<THREE.Mesh, number>();
    this.spheres.forEach((node, i) => {
      partitions.set(node, colors[i]);
    });

    return { bipartite, partitions };
  }

  public applyBipartiteCheck(): boolean {
    const { bipartite, partitions } = this.checkBipartite();
    if (bipartite && partitions) {
      this.spheres.forEach(node => {
        const partition = partitions.get(node);
        if (node.material instanceof THREE.MeshPhongMaterial) {
          if (partition === 0) {
            node.material.color.set('#0077ff');
          } else {
            node.material.color.set('#00ff00');
          }
        }
      });
    } else {
      this.spheres.forEach(node => {
        if (node.material instanceof THREE.MeshPhongMaterial) {
          node.material.color.set('#ff0000');
        }
      });
    }

    return bipartite;
  }

  // -----------------------------
  // Helper Method to Remove Arrowheads
  // -----------------------------
  private removeArrowhead(edge: Edge): void {
    if (edge.arrowHead) {
      this.scene.remove(edge.arrowHead);
      delete edge.arrowHead;
    }
  }

  // -----------------------------
  // Update Method for Animation Loop
  // -----------------------------

  public update(): void {
    if (this.previewSphere) {
      const scaleFactor = 1 + 0.05 * Math.sin(Date.now() * 0.005);
      this.previewSphere.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }

    this.edges.forEach(edge => {
      if (edge.isBridge && (edge.line as any).material) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
        (edge.line as any).material.color.setRGB(1, pulse * 0.3, pulse * 0.3);
        (edge.line as any).material.needsUpdate = true;
      }
    });
  }

  // -----------------------------
  // Method to clear the entire graph
  // -----------------------------
  public clearGraph(): void {
    this.edges.forEach(edge => {
      this.removeArrowhead(edge);
      edge.line.children
        .filter(child => child instanceof CSS2DObject)
        .forEach(label => edge.line.remove(label));
      this.scene.remove(edge.line);
    });

    this.spheres.forEach(node => {
      node.children
        .filter(child => child instanceof CSS2DObject)
        .forEach(label => node.remove(label));
      this.scene.remove(node);
    });

    this.edges = [];
    this.spheres = [];
    this.nodeCounter = 0;
    this.edgeCounter = 0;
    this.firstSelectedSphere = null;
    this.selectedEdge = null;

    this.onGraphChanged();
  }
}
