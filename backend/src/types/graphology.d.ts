declare module 'graphology' {
  export interface Graph {
    order: number;
    size: number;
    addNode(node: string, attributes?: any): void;
    addEdge(source: string, target: string, attributes?: any): void;
    hasNode(node: string): boolean;
    hasEdge(source: string, target: string): boolean;
    edge(source: string, target: string): string;
    getEdgeAttribute(edge: string, attribute: string): any;
    setEdgeAttribute(edge: string, attribute: string, value: any): void;
    forEachNode(callback: (node: string, attributes: any) => void): void;
    forEachEdge(callback: (edge: string, attributes: any, source: string, target: string) => void): void;
    forEachOutNeighbor(node: string, callback: (neighbor: string) => void): void;
    neighbors(node: string): string[];
  }

  export class UndirectedGraph implements Graph {
    order: number;
    size: number;
    addNode(node: string, attributes?: any): void;
    addEdge(source: string, target: string, attributes?: any): void;
    hasNode(node: string): boolean;
    hasEdge(source: string, target: string): boolean;
    edge(source: string, target: string): string;
    getEdgeAttribute(edge: string, attribute: string): any;
    setEdgeAttribute(edge: string, attribute: string, value: any): void;
    forEachNode(callback: (node: string, attributes: any) => void): void;
    forEachEdge(callback: (edge: string, attributes: any, source: string, target: string) => void): void;
    forEachOutNeighbor(node: string, callback: (neighbor: string) => void): void;
    neighbors(node: string): string[];
  }

  export class DirectedGraph implements Graph {
    order: number;
    size: number;
    addNode(node: string, attributes?: any): void;
    addEdge(source: string, target: string, attributes?: any): void;
    hasNode(node: string): boolean;
    hasEdge(source: string, target: string): boolean;
    edge(source: string, target: string): string;
    getEdgeAttribute(edge: string, attribute: string): any;
    setEdgeAttribute(edge: string, attribute: string, value: any): void;
    forEachNode(callback: (node: string, attributes: any) => void): void;
    forEachEdge(callback: (edge: string, attributes: any, source: string, target: string) => void): void;
    forEachOutNeighbor(node: string, callback: (neighbor: string) => void): void;
    neighbors(node: string): string[];
  }

  export class MultiDirectedGraph implements Graph {
    order: number;
    size: number;
    addNode(node: string, attributes?: any): void;
    addEdge(source: string, target: string, attributes?: any): void;
    hasNode(node: string): boolean;
    hasEdge(source: string, target: string): boolean;
    edge(source: string, target: string): string;
    getEdgeAttribute(edge: string, attribute: string): any;
    setEdgeAttribute(edge: string, attribute: string, value: any): void;
    forEachNode(callback: (node: string, attributes: any) => void): void;
    forEachEdge(callback: (edge: string, attributes: any, source: string, target: string) => void): void;
    forEachOutNeighbor(node: string, callback: (neighbor: string) => void): void;
    neighbors(node: string): string[];
  }
}

declare module 'graphology-communities-louvain' {
  import { Graph } from 'graphology';
  
  export default function louvain(
    graph: Graph, 
    options?: { resolution?: number }
  ): Record<string, number>;
}

declare module 'graphology-utils' {
  import { Graph } from 'graphology';
  
  export function subgraph(
    graph: Graph, 
    nodeFilter: (node: string) => boolean
  ): Graph;
}

declare module 'graphology-layout-forceatlas2' {
  import { Graph } from 'graphology';
  
  interface ForceAtlas2 {
    assign: (
      graph: Graph, 
      options?: { 
        iterations?: number, 
        settings?: { 
          scalingRatio?: number, 
          strongGravityMode?: boolean 
        } 
      }
    ) => void;
  }
  
  const forceAtlas2: ForceAtlas2;
  export default forceAtlas2;
} 