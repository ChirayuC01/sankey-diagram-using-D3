"use client";
import React, { useState, useMemo } from "react";
import { sankey, sankeyCenter } from "d3-sankey";

const MARGIN_Y = 25;
const MARGIN_X = 5;

export const Sankey = ({ width, height, data }) => {
  const [hoveredNode, setHoveredNode] = useState(null); // Hover state
  const [selectedNodes, setSelectedNodes] = useState([]); // List of selected nodes
  const [searchText, setSearchText] = useState({}); // State for search text per column
  const fixedHeight = 30; // Fixed height for nodes
  const verticalSpacing = 20; // Fixed vertical spacing between nodes
  const TITLE_AND_SEARCH_MARGIN = 50; // Adjust as needed to account for title and search bar

  const sankeyGenerator = sankey()
    .nodeWidth(180)
    .nodePadding(10)
    .extent([
      [MARGIN_X, MARGIN_Y + TITLE_AND_SEARCH_MARGIN],
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
    const column = node.x0;

    if (selectedNodes.includes(node)) {
      // Deselect node if already selected and clear search for its column
      setSelectedNodes(selectedNodes.filter((n) => n !== node));
      setSearchText((prev) => ({ ...prev, [column]: "" }));
    } else {
      // Select node and set its label in the search bar for the column
      setSelectedNodes([...selectedNodes, node]);
      setSearchText((prev) => ({ ...prev, [column]: node.name }));
    }
  };

  const handleSearchChange = (x0, value) => {
    setSearchText((prev) => ({ ...prev, [x0]: value }));

    // Automatically update selectedNodes based on search text
    const filteredNodesForColumn = nodes.filter(
      (node) =>
        node.x0 === x0 && node.name.toLowerCase().includes(value.toLowerCase())
    );

    // // Collect all nodes connected to filtered nodes
    // let allRelevantNodes = new Set();
    // let allRelevantLinks = new Set();

    // filteredNodesForColumn.forEach((node) => {
    //   const { visitedNodes: connectedNodes, visitedLinks: connectedLinks } =
    //     getConnectedNodesAndLinks(node);
    //   connectedNodes.forEach((n) => allRelevantNodes.add(n));
    //   connectedLinks.forEach((l) => allRelevantLinks.add(l));
    // });
    console.log("filteredNodesForColumn--", filteredNodesForColumn);
    getConnectedNodesAndLinks(Array.from(filteredNodesForColumn));
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

  // // Filter nodes and links to display only relevant ones on click
  // const filteredNodes = nodes.filter((node) => visitedNodes.has(node));
  // Filter nodes based on search text for each column
  const filteredNodes = nodes.filter((node) => {
    const columnSearchText = searchText[node.x0] || "";
    return (
      node.name.toLowerCase().includes(columnSearchText.toLowerCase()) &&
      visitedNodes.has(node)
    );
  });

  // const filteredLinks = links.filter((link) => visitedLinks.has(link));
  // Filter links based on filtered nodes
  const filteredLinks = links.filter(
    (link) =>
      filteredNodes.includes(link.source) &&
      filteredNodes.includes(link.target) &&
      visitedLinks.has(link)
  );

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
        node.y0 =
          MARGIN_Y +
          TITLE_AND_SEARCH_MARGIN +
          index * (fixedHeight + verticalSpacing);
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
  const renderColumnTitles = () => {
    const columnTitles = [
      "Market Authority",
      "FDF Manufacturer",
      "API Manufacturer",
      "Intermediate",
    ];

    // Group nodes by columns based on x0 positions
    const columns = nodes.reduce((acc, node) => {
      if (!acc[node.x0]) acc[node.x0] = [];
      acc[node.x0].push(node);
      return acc;
    }, {});

    // Sort columns by x0 to ensure correct title placement
    const sortedColumns = Object.keys(columns).sort((a, b) => a - b);
    console.log(
      "Title positions:",
      sortedColumns.map((x0, index) => ({
        x: parseFloat(x0) + sankeyGenerator.nodeWidth() / 2,
        y: MARGIN_Y - 40,
        text: columnTitles[index],
      }))
    );
    return sortedColumns.map((x0, index) => (
      <text
        key={`title-${x0}`}
        x={parseFloat(x0) + sankeyGenerator.nodeWidth() / 2} // Center title on column
        y={MARGIN_Y - 5} // Position above search bars
        textAnchor="middle"
        fontSize={20}
        fontWeight="bold"
        fill="black"
      >
        {columnTitles[index]} {/* Use the title corresponding to the column */}
      </text>
    ));
  };

  // Render search bars above each column
  const renderSearchBars = () => {
    const uniqueColumns = [...new Set(nodes.map((node) => node.x0))];
    return uniqueColumns.map((x0) => (
      <foreignObject
        key={`search-${x0}`}
        x={x0}
        y={MARGIN_Y + 10}
        width={sankeyGenerator.nodeWidth()}
        height={20}
      >
        <input
          type="text"
          placeholder="Search..."
          value={searchText[x0] || ""}
          onChange={(e) => handleSearchChange(x0, e.target.value)}
          style={{
            width: "95%",
            height: "65%",
            fontSize: "10px",
            textAlign: "center",
            // border: "none",
          }}
        />
      </foreignObject>
    ));
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
          // fill="#eff8ff"
          fill={isSelected ? "#96caf2" : "#eff8ff"}
          // fillOpacity={isSelected || isHovered || isRelevant ? 0.8 : 0.5}
          fillOpacity={1}
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
        {isSelected && (
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
          // fontWeight="bold"
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
      <svg
        width={width}
        height={height}
        style={{ userSelect: "none" }} // Disable text selection for the SVG
      >
        {renderColumnTitles()}
        {renderSearchBars()}
        <g>{allLinks}</g>
        <g>{allNodes}</g>
      </svg>
    </div>
  );
};
