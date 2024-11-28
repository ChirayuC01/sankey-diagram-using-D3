"use client";
import React, { useState } from "react";
import { sankey, sankeyCenter } from "d3-sankey";

const MARGIN_Y = 25;
const MARGIN_X = 5;

export const Sankey = ({ width, height, data }) => {
  const [hoveredNode, setHoveredNode] = useState(null); // State for the currently hovered node
  const fixedHeight = 30; // Fixed height for nodes
  const verticalSpacing = 20; // Fixed vertical spacing between nodes

  const sankeyGenerator = sankey()
    .nodeWidth(180)
    .nodePadding(10) // Temporarily used; replaced later
    .extent([
      [MARGIN_X, MARGIN_Y],
      [width - MARGIN_X, height - MARGIN_Y],
    ])
    .nodeId((node) => node.name)
    .nodeAlign(sankeyCenter);

  const { nodes, links } = sankeyGenerator(data);

  // Group nodes by their column (x0 position)
  const columns = {};
  nodes.forEach((node) => {
    if (!columns[node.x0]) {
      columns[node.x0] = [];
    }
    columns[node.x0].push(node);
  });

  // Set y0 and y1 for nodes in all columns with fixed spacing
  Object.entries(columns).forEach(([x0, columnNodes]) => {
    columnNodes.sort((a, b) => a.y0 - b.y0); // Ensure nodes are sorted in their initial layout order

    columnNodes.forEach((node, index) => {
      node.y0 = MARGIN_Y + index * (fixedHeight + verticalSpacing); // Fixed spacing
      node.y1 = node.y0 + fixedHeight; // Fixed height
    });
  });

  // Adjust links to connect to the center of nodes
  const customLinkGenerator = (link) => {
    const sourceCenter = (link.source.y0 + link.source.y1) / 2; // Center of source node
    const targetCenter = (link.target.y0 + link.target.y1) / 2; // Center of target node

    const path = `
      M${link.source.x1},${sourceCenter}
      C${link.source.x1 + 50},${sourceCenter}
       ${link.target.x0 - 50},${targetCenter}
       ${link.target.x0},${targetCenter}
    `;
    return path;
  };

  // Recursive function to collect directly/indirectly connected nodes and links
  const getConnectedNodesAndLinks = (startNode) => {
    const visitedNodes = new Set();
    const visitedLinks = new Set();

    const traverse = (node, direction) => {
      // if (visitedNodes.has(node)) return; // Skip already visited nodes (NOT REQUIRED)
      visitedNodes.add(node);

      links.forEach((link) => {
        if (
          direction === "downstream" &&
          link.source.name === node.name &&
          !visitedLinks.has(link)
        ) {
          visitedLinks.add(link);
          traverse(link.target, "downstream"); // Continue downstream
        }
        if (
          direction === "upstream" &&
          link.target.name === node.name &&
          !visitedLinks.has(link)
        ) {
          visitedLinks.add(link);
          traverse(link.source, "upstream"); // Continue upstream
        }
      });
    };
    console.log("visitedLinks--", visitedLinks);
    console.log("visitedNodes--", visitedNodes);
    // console.log("traverse(startNode, downstream);--",traverse(startNode, "downstream"))
    // console.log("traverse(startNode, upstream);--",traverse(startNode, "upstream"))
    // Start traversal in both directions
    traverse(startNode, "downstream");
    traverse(startNode, "upstream");

    return { visitedNodes, visitedLinks };
  };

  const handleMouseEnter = (node) => {
    console.log("node--", node);
    setHoveredNode(node);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  // Highlight connected nodes and links
  const { visitedNodes, visitedLinks } = hoveredNode
    ? getConnectedNodesAndLinks(hoveredNode)
    : { visitedNodes: new Set(), visitedLinks: new Set() };

  // Nodes
  const allNodes = nodes.map((node) => {
    const isHovered = hoveredNode === node;
    const isRelevant = visitedNodes.has(node);

    return (
      <g
        key={node.index}
        onMouseEnter={() => handleMouseEnter(node)}
        onMouseLeave={handleMouseLeave}
      >
        <rect
          height={fixedHeight}
          width={sankeyGenerator.nodeWidth()}
          x={node.x0}
          y={node.y0}
          stroke="black"
          fill={isHovered || isRelevant ? "blue" : "grey"}
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

  // Links
  const allLinks = links.map((link, i) => {
    const isRelevant = visitedLinks.has(link);
    const path = customLinkGenerator(link);

    return (
      <path
        key={i}
        d={path}
        stroke={isRelevant ? "blue" : "grey"}
        fill="none"
        strokeOpacity={0.5}
        strokeWidth={isRelevant ? 3 : 1} // Highlight relevant links
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
