import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { TradeStep } from '../../lib/trade-discovery/types';

interface TradePathGraphProps {
  paths: TradeStep[][];
}

export function TradePathGraph({ paths }: TradePathGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !paths.length) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 600;

    // Clear previous graph
    svg.selectAll('*').remove();

    // Create force-directed graph
    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Transform paths data for D3
    const { nodes, links } = transformPathsToGraph(paths);

    // Add links (trade paths)
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    // Add nodes (wallets)
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', 10)
      .attr('fill', d => getNodeColor(d))
      .call(drag(simulation));

    // Add labels
    const label = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .text(d => truncateAddress(d.id))
      .attr('font-size', '12px')
      .attr('dx', 15)
      .attr('dy', 4);

    // Update positions on simulation tick
    simulation.nodes(nodes).on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    simulation.force('link').links(links);

  }, [paths]);

  return (
    <GraphContainer>
      <svg ref={svgRef} width="100%" height="100%">
        <defs>
          <marker
            id="arrow"
            viewBox="0 -5 10 10"
            refX="20"
            refY="0"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="#666"/>
          </marker>
        </defs>
      </svg>
    </GraphContainer>
  );
}

const GraphContainer = styled.div`
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  height: 600px;
  width: 100%;
`; 