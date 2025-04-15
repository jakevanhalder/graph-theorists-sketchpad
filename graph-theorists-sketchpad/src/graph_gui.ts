import GUI from 'lil-gui';
import { Graph } from './graph';

export class GraphGUI {
    private gui: GUI;
    private params: any;
    private graph: Graph;

    constructor(graph: Graph) {
        this.graph = graph;
        this.gui = new GUI();

        this.params = {
            nodeColor: '#0077ff',
            edgeColor: '#ff0000',
            nodeRadius: 0.5,
            edgeThickness: 5,
            enableNodeCreation: false,
            clearGraph: () => {
                console.log('Clear Graph button pressed.');
                // Implement method to clear all nodes and edges.
            }
        };

        this.setupGUI();
    }

    private setupGUI(): void {
        const nodeFolder = this.gui.addFolder('Node Settings');
        nodeFolder.addColor(this.params, 'nodeColor').name('Color').onChange((value: string) => {
            // Update default node color in the graph (for new nodes)
        });
        nodeFolder.add(this.params, 'nodeRadius', 0.1, 2).name('Radius').onChange((value: number) => {
            // Update default node radius
        });

        const edgeFolder = this.gui.addFolder('Edge Settings');
        edgeFolder.addColor(this.params, 'edgeColor').name('Color').onChange((value: string) => {
            // Update default edge color
        });
        edgeFolder.add(this.params, 'edgeThickness', 1, 10).name('Thickness').onChange((value: number) => {
            // Update default edge thickness
        });

        // Option to clear all graph objects.
        this.gui.add(this.params, 'clearGraph').name('Clear Graph');
    }
}
