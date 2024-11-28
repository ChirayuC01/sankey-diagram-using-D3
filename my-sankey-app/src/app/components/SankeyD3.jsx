"use client";
import React, { useState } from "react";
import { sankey, sankeyCenter } from "d3-sankey";

const MARGIN_Y = 25;
const MARGIN_X = 5;

export const Sankey = ({ width, height, data }) => {
  const [hoveredNode, setHoveredNode] = useState(null); // Hover state
  const [selectedNode, setSelectedNode] = useState(null); // Click state
  const fixedHeight = 30; // Fixed height for nodes
  const verticalSpacing = 20; // Fixed vertical spacing between nodes

  const sankeyGenerator = sankey()
    .nodeWidth(180)
    .nodePadding(10)
    .extent([
      [MARGIN_X, MARGIN_Y],
      [width - MARGIN_X, height - MARGIN_Y],
    ])
    .nodeId((node) => node.name)
    .nodeAlign(sankeyCenter);

  const { nodes, links } = sankeyGenerator(data);

  // Adjust positions for filtered nodes
  const adjustNodePositions = (nodes) => {
    const filteredColumns = {};

    nodes.forEach((node) => {
      if (!filteredColumns[node.x0]) {
        filteredColumns[node.x0] = [];
      }
      filteredColumns[node.x0].push(node);
    });

    Object.entries(filteredColumns).forEach(([x0, columnNodes]) => {
      columnNodes.forEach((node, index) => {
        node.y0 = MARGIN_Y + index * (fixedHeight + verticalSpacing);
        node.y1 = node.y0 + fixedHeight;
      });
    });
  };

  // Collect connected nodes and links recursively
  const getConnectedNodesAndLinks = (startNode) => {
    const visitedNodes = new Set();
    const visitedLinks = new Set();

    const traverse = (node, direction) => {
      visitedNodes.add(node);

      links.forEach((link) => {
        if (
          direction === "downstream" &&
          link.source.name === node.name &&
          !visitedLinks.has(link)
        ) {
          visitedLinks.add(link);
          traverse(link.target, "downstream");
        }
        if (
          direction === "upstream" &&
          link.target.name === node.name &&
          !visitedLinks.has(link)
        ) {
          visitedLinks.add(link);
          traverse(link.source, "upstream");
        }
      });
    };

    traverse(startNode, "downstream");
    traverse(startNode, "upstream");

    return { visitedNodes, visitedLinks };
  };

  const handleMouseEnter = (node) => {
    setHoveredNode(node);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  const handleClick = (node) => {
    setSelectedNode(node === selectedNode ? null : node);
  };

  // Determine nodes and links to display based on selection or hover
  // Determine nodes and links to display based on selection or hover
  const { visitedNodes, visitedLinks } = selectedNode
    ? getConnectedNodesAndLinks(selectedNode)
    : hoveredNode
    ? getConnectedNodesAndLinks(hoveredNode)
    : { visitedNodes: new Set(), visitedLinks: new Set() }; // Default to empty sets

  const filteredNodes = selectedNode
    ? nodes.filter((node) => visitedNodes.has(node))
    : nodes;
  const filteredLinks = selectedNode
    ? links.filter((link) => visitedLinks.has(link))
    : links;

  adjustNodePositions(filteredNodes);

  const customLinkGenerator = (link) => {
    const sourceCenter = (link.source.y0 + link.source.y1) / 2;
    const targetCenter = (link.target.y0 + link.target.y1) / 2;

    return `
      M${link.source.x1},${sourceCenter}
      C${link.source.x1 + 50},${sourceCenter}
       ${link.target.x0 - 50},${targetCenter}
       ${link.target.x0},${targetCenter}
    `;
  };

  // Render nodes
  const allNodes = filteredNodes.map((node) => {
    const isHovered = hoveredNode === node;
    const isSelected = selectedNode === node;
    const isRelevant = visitedNodes.has(node);

    return (
      <g
        key={node.index}
        onMouseEnter={() => handleMouseEnter(node)}
        onMouseLeave={handleMouseLeave}
        onClick={() => handleClick(node)}
        style={{ cursor: "pointer" }} // Set cursor to pointer on hover
      >
        <rect
          height={fixedHeight}
          width={sankeyGenerator.nodeWidth()}
          x={node.x0}
          y={node.y0}
          stroke="black"
          fill={isSelected || isHovered || isRelevant ? "blue" : "grey"}
          fillOpacity={0.8}
          rx={2}
        />
        <text
          x={node.x0 + sankeyGenerator.nodeWidth() / 2}
          y={node.y0 + fixedHeight / 2}
          textAnchor="middle"
          dy="0.35em"
          fontSize={10}
          fill="black"
        >
          {node.name}
        </text>
      </g>
    );
  });

  // Render links
  const allLinks = filteredLinks.map((link, i) => {
    const isRelevant = visitedLinks.has(link);
    const path = customLinkGenerator(link);
    console.log("visitedLinks", visitedLinks);
    return (
      <path
        key={i}
        d={path}
        stroke={isRelevant ? "blue" : "grey"}
        fill="none"
        strokeOpacity={0.5}
        strokeWidth={isRelevant ? 3 : 1}
      />
    );
  });

  return (
    <div>
      <svg width={width} height={height}>
        <g>{allLinks}</g>
        <g>{allNodes}</g>
      </svg>
    </div>
  );
};
