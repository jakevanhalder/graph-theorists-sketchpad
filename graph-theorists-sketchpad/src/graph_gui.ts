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
            checkBipartite: () => {
                console.log('Check Bipartite button pressed.');
                const result = this.graph.applyBipartiteCheck();
                const message = result ? "Graph is bipartite." : "Graph is not bipartite.";
                alert(message);
            },
            computeChromaticNumber: () => {
                console.log('Compute Chromatic Number button pressed.');
                const chromaticNumber = this.graph.applyGraphColoring();
                const chromaticNumberElement = document.getElementById('chromatic-number');
                const chromaticNumberInfo = document.getElementById('chromatic-number-info');
                
                if (chromaticNumberElement && chromaticNumberInfo) {
                    chromaticNumberElement.textContent = chromaticNumber.toString();
                    chromaticNumberInfo.style.display = 'inline';
                }
                
                const message = `Graph chromatic number: ${chromaticNumber}`;
                console.log(message);
            },
            stopChecks: () => {
                console.log('Stop Checks button pressed.');
                this.graph.resetHighlights();

                const chromaticNumberInfo = document.getElementById('chromatic-number-info');
                if (chromaticNumberInfo) {
                    chromaticNumberInfo.style.display = 'none';
                }
            },
            clearGraph: () => {
                console.log('Clear Graph button pressed.');
                if (confirm("Are you sure you want to clear the entire graph?")) {
                    this.graph.clearGraph();

                    const chromaticNumberElement = document.getElementById('chromatic-number');
                    const chromaticNumberInfo = document.getElementById('chromatic-number-info');
                    if (chromaticNumberElement && chromaticNumberInfo) {
                        chromaticNumberElement.textContent = '0';
                        chromaticNumberInfo.style.display = 'none';
                    }
                }
            },
            directed: this.graph.directed,
            arrowSize: this.graph.arrowSize,
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

        this.gui.add(this.params, 'directed').name("Directed Graph").onChange((value: boolean) => {
            this.graph.directed = value;
            this.graph.updateDirectedEdges();
        });

        this.gui.add(this.params, 'arrowSize', 0.2, 5).name("Arrow Size").onChange((value: number) => {
            this.graph.arrowSize = value;
            this.graph.updateArrowSizes();
        });

        this.gui.add(this.params, 'viewGraphComponents').name("View Graph Components");
        this.gui.add(this.params, 'viewBridgeEdges').name("View Bridge Edges");
        this.gui.add(this.params, 'checkBipartite').name('Check Bipartite');
        this.gui.add(this.params, 'computeChromaticNumber').name('Compute Chromatic Number');
        this.gui.add(this.params, 'stopChecks').name('Stop Checks');
        this.gui.add(this.params, 'clearGraph').name('Clear Graph');
    }
}
