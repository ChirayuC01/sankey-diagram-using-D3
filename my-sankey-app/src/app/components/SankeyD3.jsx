"use client";
import React, { useState } from "react";
import { sankey, sankeyCenter } from "d3-sankey";

const MARGIN_Y = 25;
const MARGIN_X = 5;

export const Sankey = ({ width, height, data }) => {
  const [hoveredNode, setHoveredNode] = useState(null); // Hover state
  const [selectedNodes, setSelectedNodes] = useState([]); // List of selected nodes
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

  const intersectSets = (setA, setB) => {
    return new Set([...setA].filter((item) => setB.has(item)));
  };

  const handleMouseEnter = (node) => {
    setHoveredNode(node);
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  const handleClick = (node) => {
    if (selectedNodes.includes(node)) {
      // Deselect node if already selected
      setSelectedNodes(selectedNodes.filter((n) => n !== node));
    } else {
      // Add node to selection
      setSelectedNodes([...selectedNodes, node]);
    }
  };

  // Determine nodes and links to display based on selection
  let visitedNodes = new Set(); // Default to no nodes
  let visitedLinks = new Set(); // Default to no links

  if (selectedNodes.length > 0) {
    selectedNodes.forEach((node, index) => {
      const { visitedNodes: nodesForCurrent, visitedLinks: linksForCurrent } =
        getConnectedNodesAndLinks(node);
      if (index === 0) {
        visitedNodes = nodesForCurrent;
        visitedLinks = linksForCurrent;
      } else {
        visitedNodes = intersectSets(visitedNodes, nodesForCurrent);
        visitedLinks = intersectSets(visitedLinks, linksForCurrent);
      }
    });
  } else {
    // Highlight nodes and links on hover only
    visitedNodes = new Set(nodes);
    visitedLinks = new Set(links);
  }

  // Highlight nodes and links on hover without filtering them out
  let hoveredNodes = new Set();
  let hoveredLinks = new Set();

  if (hoveredNode) {
    const { visitedNodes: nodesForHover, visitedLinks: linksForHover } =
      getConnectedNodesAndLinks(hoveredNode);
    hoveredNodes = nodesForHover;
    hoveredLinks = linksForHover;
  }

  // Filter nodes and links to display only relevant ones on click
  const filteredNodes = nodes.filter((node) => visitedNodes.has(node));
  const filteredLinks = links.filter((link) => visitedLinks.has(link));

  // Adjust positions dynamically for filtered nodes
  const adjustNodePositions = (filteredNodes) => {
    const filteredColumns = {};

    filteredNodes.forEach((node) => {
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
    const isHovered = hoveredNodes.has(node);
    const isSelected = selectedNodes.includes(node);
    const isRelevant = visitedNodes.has(node);

    // Check if the node is in one of the first three columns
    const isInFirstThreeColumns =
      node.x0 < MARGIN_X + 5 * sankeyGenerator.nodeWidth();

    return (
      <g
        key={node.index}
        onMouseEnter={() => handleMouseEnter(node)}
        onMouseLeave={handleMouseLeave}
        onClick={() => handleClick(node)}
        style={{ cursor: "pointer" }}
      >
        {/* Node rectangle */}
        <rect
          height={fixedHeight}
          width={sankeyGenerator.nodeWidth()}
          x={node.x0}
          y={node.y0}
          fill="#eff8ff"
          fillOpacity={isSelected || isHovered || isRelevant ? 0.8 : 0.5}
          rx={2}
          stroke="none"
        />
        {/* Add left and right borders on hover */}
        {isHovered && (
          <>
            {/* Left border */}
            <line
              x1={node.x0}
              y1={node.y0}
              x2={node.x0}
              y2={node.y1}
              stroke="#1849a9"
              strokeWidth="1"
            />
            {/* Right border */}
            <line
              x1={node.x0 + sankeyGenerator.nodeWidth()}
              y1={node.y0}
              x2={node.x0 + sankeyGenerator.nodeWidth()}
              y2={node.y1}
              stroke="#1849a9"
              strokeWidth="1"
            />
          </>
        )}
        {/* Arrow on the right for nodes in the first three columns */}
        {isInFirstThreeColumns && (
          <path
            d={` 
            M${node.x0 + sankeyGenerator.nodeWidth()},${
              node.y0 + fixedHeight / 2
            }
            L${node.x0 + sankeyGenerator.nodeWidth() + 6},${
              node.y0 + fixedHeight / 2 - 3
            }
            L${node.x0 + sankeyGenerator.nodeWidth() + 6},${
              node.y0 + fixedHeight / 2 + 3
            }
            Z
          `}
            fill="#808080"
          />
        )}
        {/* Node text */}
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
    const isHovered = hoveredLinks.has(link);
    const isRelevant = visitedLinks.has(link);
    const path = customLinkGenerator(link);
    return (
      <path
        key={i}
        d={path}
        stroke={isHovered ? "#1849a9" : isRelevant ? "#808080" : "#1849a9"}
        fill="none"
        strokeOpacity={isHovered || isRelevant ? 0.5 : 0.5}
        strokeWidth={isHovered || isRelevant ? 1 : 1}
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
