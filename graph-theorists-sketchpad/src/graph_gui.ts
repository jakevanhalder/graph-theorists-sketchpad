import * as THREE from 'three';
import GUI from 'lil-gui';
import { Graph } from './graph';
import { CSS2DObject } from 'three/examples/jsm/Addons.js';

export class GraphGUI {
    private gui: GUI;
    private params: any;
    private graph: Graph;
    private nodeFolder!: GUI;
    private nodeLabelController!: any;

    constructor(graph: Graph) {
        this.graph = graph;
        this.gui = new GUI();

        this.params = {
            nodeColor: '#0077ff',
            edgeColor: '#ff0000',
            nodeRadius: 0.5,
            edgeThickness: 5,
            nodeLabel: '',
            viewGraphComponents: () => {
                console.log('View Graph Components button pressed.');
                this.graph.highlightComponents();
            },
            viewBridgeEdges: () => {
                console.log('View Bridge Edges button pressed.');
                this.graph.highlightBridges();
            },
            stopChecks: () => {
                console.log('Stop Checks button pressed.');
                this.graph.resetHighlights();
            },
            clearGraph: () => {
                console.log('Clear Graph button pressed.');
                // Implement method to clear all nodes and edges.
            }
        };

        this.setupGUI();

        this.graph.onNodeSelected = (node) => {
            let currentLabel = '';
            node.children.forEach(child => {
                if (child instanceof CSS2DObject) {
                    currentLabel = child.element.textContent || '';
                }
            });
            this.params.nodeLabel = currentLabel;
            this.nodeLabelController.updateDisplay();

            (this.nodeFolder.domElement as HTMLElement).style.display = 'block';

            const deg = this.graph.getDegree(node);
            const degreeInfo = document.getElementById('degree-info');
            if (degreeInfo) {
                degreeInfo.textContent = `Degree: ${deg}`;
                degreeInfo.style.display = 'inline';
            }

            this.graph.onNodeDeselected = () => {
                (this.nodeFolder.domElement as HTMLElement).style.display = 'none';
                if (degreeInfo) {
                    degreeInfo.style.display = 'none';
                }
            };
        };
    }

    private setupGUI(): void {
        this.nodeFolder = this.gui.addFolder('Node Settings');
        (this.nodeFolder.domElement as HTMLElement).style.display = 'none';

        this.nodeFolder.addColor(this.params, 'nodeColor').name('Color').onChange((value: string) => {
            const selectedNode = this.graph.getSelectedNode();
            if (selectedNode && selectedNode.material instanceof THREE.MeshPhongMaterial) {
                selectedNode.material.color.set(value);
            }
        });

        this.nodeLabelController = this.nodeFolder.add(this.params, 'nodeLabel').name('Label').onFinishChange((newLabel: string) => {
            if (this.graph.getSelectedNode()) {
                this.graph.updateNodeLabel(newLabel);
            }
        });

        this.gui.add(this.params, 'viewGraphComponents').name("View Graph Components");
        this.gui.add(this.params, 'viewBridgeEdges').name("View Bridge Edges");
        this.gui.add(this.params, 'stopChecks').name('Stop Checks');
        this.gui.add(this.params, 'clearGraph').name('Clear Graph');
    }
}
