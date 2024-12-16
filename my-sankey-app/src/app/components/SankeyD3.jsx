"use client";
import React, { useState, useEffect, useRef } from "react";
import { sankey, sankeyCenter } from "d3-sankey";

const MARGIN_Y = 25;
const MARGIN_X = 25;

export const Sankey = ({ width, data, height }) => {
  const [hoveredNode, setHoveredNode] = useState(null); // Hover state
  const [selectedNodes, setSelectedNodes] = useState([]); // List of selected nodes
  const [searchText, setSearchText] = useState({}); // State for search text per column
  const [dynamicHeight, setDynamicHeight] = useState(500); // Default height
  const [nodesByColumn, setNodesByColumn] = useState({});
  const [filteredBySearch, setFilteredBySearch] = useState({
    nodes: new Set(),
    links: new Set(),
  });
  const [originalData, setOriginalData] = useState();
  let [visitedNodes, setVisitedNodes] = useState(new Set()); // Make visitedNodes a state
  const [animationKey, setAnimationKey] = useState(0);
  const prevVisitedNodesRef = useRef(new Set());
  const fixedHeight = 50; // Fixed height for nodes
  const verticalSpacing = 0; // Fixed vertical spacing between nodes
  const TITLE_AND_SEARCH_MARGIN = 90; // Adjust as needed to account for title and search bar
  // let visitedNodes = new Set();
  let visitedLinks = new Set();

  const sankeyGenerator = sankey()
    .nodeWidth(Math.max(width / 10, 200))
    .nodePadding(Math.max(dynamicHeight / 50, 10))
    .extent([
      [MARGIN_X, MARGIN_Y + TITLE_AND_SEARCH_MARGIN],
      [width - MARGIN_X, dynamicHeight - MARGIN_Y],
    ])
    .nodeId((node) => node.name)
    .nodeAlign(sankeyCenter);

  const { nodes, links } = sankeyGenerator(data);

  useEffect(() => {
    let newVisitedNodes = new Set();

    if (
      selectedNodes.length > 0 &&
      Object.values(searchText).some((text) => text.trim() !== "")
    ) {
      // Logic for selected nodes and search text
      selectedNodes.forEach((node, index) => {
        const { visitedNodes: nodesForCurrent, visitedLinks: linksForCurrent } =
          getConnectedNodesAndLinks(node);

        if (index === 0) {
          newVisitedNodes = nodesForCurrent;
          // Also update visitedLinks if needed
        } else {
          newVisitedNodes = intersectSets(newVisitedNodes, nodesForCurrent);
          // Update visitedLinks similarly
        }

        // Intersect with search results
        if (filteredBySearch.nodes.size > 0) {
          newVisitedNodes = intersectSets(
            newVisitedNodes,
            filteredBySearch.nodes
          );
        }
      });
    } else if (selectedNodes.length > 0) {
      // Logic for only selected nodes
      selectedNodes.forEach((node, index) => {
        const { visitedNodes: nodesForCurrent } =
          getConnectedNodesAndLinks(node);

        if (index === 0) {
          newVisitedNodes = nodesForCurrent;
        } else {
          newVisitedNodes = intersectSets(newVisitedNodes, nodesForCurrent);
        }
      });
    } else if (Object.values(searchText).some((text) => text.trim() !== "")) {
      // Logic for search
      newVisitedNodes = filteredBySearch.nodes;
    } else {
      // Default: all nodes
      newVisitedNodes = new Set(nodes);
    }

    setVisitedNodes(newVisitedNodes);
  }, [selectedNodes, searchText, filteredBySearch, nodes]);

  // Calculate the number of nodes in each column
  useEffect(() => {
    const columns = {};
    // Use visitedNodes if it has content, otherwise fall back to data.nodes
    const nodesToProcess =
      visitedNodes.size > 0 ? Array.from(visitedNodes) : data.nodes;

    nodesToProcess.forEach((node) => {
      // Determine the column X position
      const columnX =
        node.x0 !== undefined ? node.x0 : node.x0 === 0 ? 0 : node.x0 || 0;

      if (!columns[columnX]) {
        columns[columnX] = {
          nodes: [],
          groups: new Set(),
        };
      }

      columns[columnX].nodes.push(node);

      // Try to find the original node to get intermediateName
      const originalNode = data.nodes.find((n) => n.name === node.name);
      if (originalNode && originalNode.intermediateName) {
        columns[columnX].groups.add(originalNode.intermediateName);
      }
    });

    setNodesByColumn(columns);
  }, [visitedNodes, data.nodes]);

  // Compare sets by their values instead of using JSON.stringify
  const areNodeSetsEqual = (setA, setB) => {
    if (setA.size !== setB.size) return false;
    const sortedA = Array.from(setA)
      .map((node) => node.name)
      .sort();
    const sortedB = Array.from(setB)
      .map((node) => node.name)
      .sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  };

  // Update animation key when visitedNodes changes
  useEffect(() => {
    if (!areNodeSetsEqual(prevVisitedNodesRef.current, visitedNodes)) {
      setAnimationKey((prev) => prev + 1);
      // Create a new Set with only the node names to avoid circular references
      prevVisitedNodesRef.current = new Set(Array.from(visitedNodes));
    }
  }, [visitedNodes]);

  // Recalculate dynamic height based on visited nodes
  useEffect(() => {
    const calculateDynamicHeight = () => {
      if (visitedNodes.size === 0) {
        setDynamicHeight(500); // Default height when no nodes are visible
        return;
      }

      // Group visited nodes by column
      const columnVisitedNodes = {};
      visitedNodes.forEach((node) => {
        const columnX = node.x0;
        if (!columnVisitedNodes[columnX]) {
          columnVisitedNodes[columnX] = [];
        }
        columnVisitedNodes[columnX].push(node);
      });

      // Calculate height for each column with visited nodes
      let maxHeight = 0;
      Object.entries(columnVisitedNodes).forEach(([x0, columnNodes]) => {
        // Group nodes by intermediateName
        const groupedNodes = columnNodes.reduce(
          (acc, node) => {
            if (node.intermediateName) {
              if (!acc[node.intermediateName]) acc[node.intermediateName] = [];
              acc[node.intermediateName].push(node);
            } else {
              acc.ungrouped.push(node);
            }
            return acc;
          },
          { ungrouped: [] }
        );

        // Calculate column height
        let columnHeight = MARGIN_Y * 2 + TITLE_AND_SEARCH_MARGIN;
        let groupCount = 0;

        // Add height for each group and its nodes
        Object.entries(groupedNodes).forEach(([groupName, groupNodes]) => {
          if (groupName !== "ungrouped") {
            // Add group title height for non-ungrouped groups
            if (groupCount > 0) {
              columnHeight += fixedHeight + 8; // Group title spacing
            }
            groupCount++;
          }

          // Add height for nodes in the group
          columnHeight += groupNodes.length * (fixedHeight + verticalSpacing);
        });

        // Update max height
        maxHeight = Math.max(maxHeight, columnHeight);
      });

      // Ensure minimum height and add some buffer
      setDynamicHeight(Math.max(maxHeight, 500));
    };

    calculateDynamicHeight();
  }, [visitedNodes, fixedHeight, verticalSpacing, TITLE_AND_SEARCH_MARGIN]);

  useEffect(() => {
    setOriginalData(data);
  }, [data]);

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
      setFilteredBySearch({ nodes: new Set(), links: new Set() });
    } else {
      // Select node and set its label in the search bar for the column
      setSelectedNodes([...selectedNodes, node]);
      setSearchText((prev) => ({ ...prev, [column]: node.name }));
    }
  };

  const handleSearchChange = (x0, value) => {
    setSearchText((prev) => ({ ...prev, [x0]: value }));

    if (value.trim() === "") {
      // Reset selected nodes for this column when the search bar is cleared
      setSelectedNodes((prevSelectedNodes) =>
        prevSelectedNodes.filter((node) => node.x0 !== x0)
      );

      // Reset filteredBySearch for this column
      setFilteredBySearch({
        nodes: new Set(),
        links: new Set(),
      });
      return; // No need to filter when the search is cleared
    }

    // Filter nodes for the specific column based on the search text
    const filteredNodesForColumn = nodes.filter(
      (node) =>
        node.x0 === x0 && node.name.toLowerCase().includes(value.toLowerCase())
    );

    // Collect all connected nodes and links for the filtered nodes
    let allRelevantNodes = new Set();
    let allRelevantLinks = new Set();

    filteredNodesForColumn.forEach((node) => {
      const { visitedNodes: connectedNodes, visitedLinks: connectedLinks } =
        getConnectedNodesAndLinks(node);
      connectedNodes.forEach((n) => allRelevantNodes.add(n));
      connectedLinks.forEach((l) => allRelevantLinks.add(l));
    });
    // console.log("allRelevantNodes---", allRelevantNodes);
    // console.log("allRelevantLinks---", allRelevantLinks);

    // Update the state to reflect the search results
    setFilteredBySearch({
      nodes: allRelevantNodes,
      links: allRelevantLinks,
    });
  };

  // // Determine nodes and links to display
  // let visitedNodes = new Set(); // Default to no nodes
  // let visitedLinks = new Set(); // Default to no links

  if (
    selectedNodes.length > 0 &&
    Object.values(searchText).some((text) => text.trim() !== "")
  ) {
    // If both a node is selected and a search is active, intersect the two sets
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

    // Intersect with nodes and links from the search results
    if (filteredBySearch.nodes.size > 0) {
      visitedNodes = intersectSets(visitedNodes, filteredBySearch.nodes);
      visitedLinks = intersectSets(visitedLinks, filteredBySearch.links);
    }
  } else if (selectedNodes.length > 0) {
    // If only nodes are selected
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
  } else if (Object.values(searchText).some((text) => text.trim() !== "")) {
    // If there's an active search, display nodes and links filtered by search
    visitedNodes = filteredBySearch.nodes;
    visitedLinks = filteredBySearch.links;
  } else {
    // Default: Display all nodes and links
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
  const adjustNodePositions = (filteredNodes, verticalSpacing = 0) => {
    const filteredColumns = {};

    // Group nodes by their column (x0 position)
    filteredNodes.forEach((node) => {
      if (!filteredColumns[node.x0]) {
        filteredColumns[node.x0] = [];
      }
      filteredColumns[node.x0].push(node);
    });

    Object.entries(filteredColumns).forEach(([x0, columnNodes]) => {
      let currentY = MARGIN_Y + TITLE_AND_SEARCH_MARGIN;

      // Group nodes by intermediateName and ungrouped
      const groupedNodes = columnNodes.reduce(
        (acc, node) => {
          if (node.intermediateName) {
            if (!acc[node.intermediateName]) acc[node.intermediateName] = [];
            acc[node.intermediateName].push(node);
          } else {
            acc.ungrouped.push(node);
          }
          return acc;
        },
        { ungrouped: [] }
      );

      let isFirstGroup = true; // Flag to track the first group

      // Iterate over grouped nodes and adjust their positions
      Object.entries(groupedNodes).forEach(([groupName, groupNodes]) => {
        if (groupName !== "ungrouped") {
          if (!isFirstGroup) {
            currentY += fixedHeight + 8; // Add spacing for subsequent group titles
          } else {
            isFirstGroup = false; // Skip the title for the first group
          }
        }

        // Position each node in the group
        groupNodes.forEach((node) => {
          node.y0 = currentY;
          node.y1 = node.y0 + fixedHeight;
          currentY += fixedHeight + verticalSpacing;
        });
      });
    });
  };

  adjustNodePositions(filteredNodes, verticalSpacing);

  const customLinkGenerator = (link, curvatureFactor = 50) => {
    const sourceCenter = (link.source.y0 + link.source.y1) / 2;
    const targetCenter = (link.target.y0 + link.target.y1) / 2;

    return `
      M${link.source.x1},${sourceCenter}
      C${link.source.x1 + curvatureFactor},${sourceCenter}
       ${link.target.x0 - curvatureFactor},${targetCenter}
       ${link.target.x0},${targetCenter}
    `;
  };

  // Reset function
  const resetStates = () => {
    setHoveredNode(null);
    setSelectedNodes([]);
    setSearchText({});
    setFilteredBySearch({
      nodes: new Set(),
      links: new Set(),
    });
  };
  const renderColumnTitles = () => {
    const columnTitles = [
      "Market Authority",
      "FDF Manufacturers",
      "API Manufacturers",
    ]; // Initial default titles for non-Intermediate columns.

    const columns = nodes.reduce((acc, node) => {
      if (!acc[node.x0]) acc[node.x0] = [];
      acc[node.x0].push(node);
      return acc;
    }, {});

    const sortedColumns = Object.keys(columns).sort((a, b) => a - b);

    return sortedColumns.map((x0, index) => {
      const isIntermediateColumn = columnTitles.length === index; // Check if it's the last column
      const filteredNodesForColumn = filteredNodes.filter(
        (node) => node.x0 === parseFloat(x0)
      ); // Use filtered nodes after search

      let title;
      if (isIntermediateColumn) {
        // Check for the first visible group's title in the column.
        const firstVisibleGroup = filteredNodesForColumn.find(
          (node) => node.intermediateName
        );
        title = firstVisibleGroup
          ? firstVisibleGroup.intermediateName
          : "Intermediate Manufac.";
      } else {
        // Default column titles for other columns.
        title = columnTitles[index];
      }

      return (
        <foreignObject
          key={`title-${x0}`}
          x={parseFloat(x0)}
          y={MARGIN_Y + 40}
          width={200}
          height={100}
        >
          <div
            className="bg-[#FEF6EE] rounded-xl border border-[#FFE6D5] py-2 px-3 text-[14px] leading-[14px] font-medium text-brand-900 cursor-default"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={title} // Tooltip for the complete text
          >
            {title}
          </div>
        </foreignObject>
      );
    });
  };

  // Render search bars above each column
  const renderSearchBars = () => {
    const uniqueColumns = [...new Set(nodes.map((node) => node.x0))].sort(
      (a, b) => a - b
    ); // Sort x0 values

    const dynamicPlaceholders = uniqueColumns.map((x0) => {
      const columnNodes = nodesByColumn[x0]?.nodes || [];
      const nodeCount = columnNodes.length;

      // Generate placeholder dynamically based on node count
      switch (x0) {
        case uniqueColumns[0]:
          return `Search all ${nodeCount} Market Authorities`;
        case uniqueColumns[1]:
          return `Search all ${nodeCount} FDF Mfrs.`;
        case uniqueColumns[2]:
          return `Search all ${nodeCount} API Mfrs.`;
        case uniqueColumns[3]:
          return `Search all ${nodeCount} Intermediate Mfrs.`;
        default:
          return `Search all ${nodeCount} Items`;
      }
    });

    const tooltipMessages = [
      "Companies with significant influence and credibility in the pharma supply chain.",
      "Companies making finished dosage forms by sourcing APIs.",
      "Companies producing APIs by sourcing intermediates.",
      "Companies making intermediates by sourcing raw materials.",
    ];

    const elements = [];

    uniqueColumns.forEach((x0, index) => {
      const placeholder = dynamicPlaceholders[index] || "Search...";

      // Check if a node is selected in this column
      const selectedNode = selectedNodes.find((node) => node.x0 === x0);
      const value = searchText[x0]?.toUpperCase() || "";

      elements.push(
        <foreignObject
          key={`search-${x0}`}
          x={x0}
          y={MARGIN_Y - 20}
          width={sankeyGenerator.nodeWidth()}
          height={55}
        >
          <div className="relative w-full h-full">
            {selectedNode ? (
              <div
                className="relative w-full h-12 flex items-center border rounded-xl pl-4 pr-4 mt-1.5 bg-white"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  className="flex items-center justify-between border text-[#026AA2] px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "#F0F9FF",
                    borderColor: "#B9E6FE",
                    display: "inline-flex",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    className="overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ flex: "1", paddingRight: "4px" }}
                  >
                    {value}
                  </span>
                  <button
                    className="text-gray-500 text-[10px] ml-2"
                    onClick={() => {
                      setSearchText((prev) => ({ ...prev, [x0]: "" }));
                      setSelectedNodes((prev) =>
                        prev.filter((node) => node.x0 !== x0)
                      );
                      setFilteredBySearch({
                        nodes: new Set(),
                        links: new Set(),
                      });
                    }}
                    style={{ fontSize: "10px", lineHeight: "1" }}
                  >
                    &#10005;
                  </button>
                </span>
              </div>
            ) : (
              <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => handleSearchChange(x0, e.target.value)}
                readOnly={!!selectedNode}
                className={`w-full h-12 mt-1.5 text-[10px] ${
                  selectedNode ? "text-gray-500" : "text-black"
                } border rounded-xl pl-4 pr-8`}
              />
            )}
          </div>
        </foreignObject>
      );

      // Add SVG between search bars (except after the last bar)
      if (index < uniqueColumns.length - 1) {
        elements.push(
          <svg
            key={`svg-${x0}`}
            width="40"
            height="50"
            viewBox="0 0 47 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            x={x0 + sankeyGenerator.nodeWidth() + 50} // Adjust position
            y={MARGIN_Y - 15} // Match Y position of search bars
          >
            <path
              d="M45.2607 43.5H23.8692L0.734481 22L23.8692 0.5H45.2607L23.3258 21.64L22.9522 22L23.3258 22.36L45.2607 43.5Z"
              fill="#1849A9"
              stroke="#E4E7EC"
            />
          </svg>
        );
      }

      // Add tooltip as foreignObject
      elements.push(
        <foreignObject
          key={`tooltip-${x0}`}
          x={x0 + sankeyGenerator.nodeWidth() + 5}
          y={MARGIN_Y + 2}
          width={300}
          height={50}
          style={{
            overflow: "visible",
            zIndex: 1000,
          }}
        >
          <div
            className="relative"
            style={{
              position: "absolute",
              zIndex: 1100,
            }}
          >
            <div className="group">
              <svg
                width="13"
                height="12"
                viewBox="0 0 13 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="cursor-pointer"
              >
                <g id="info-circle">
                  <path
                    id="Icon"
                    d="M6.5 8V6M6.5 4H6.505M11.5 6C11.5 8.76142 9.26142 11 6.5 11C3.73858 11 1.5 8.76142 1.5 6C1.5 3.23858 3.73858 1 6.5 1C9.26142 1 11.5 3.23858 11.5 6Z"
                    stroke="#98A2B3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>
              <div
                className="absolute hidden group-hover:block bg-white text-black animate-in fade-in-0 zoom-in-95 text-xs font-medium rounded-md px-2 py-3 shadow-lg border z-50"
                style={{
                  maxWidth: "250px",
                  left: "-210px",
                  top: "20px",
                  zIndex: 1200,
                  whiteSpace: "normal",
                }}
              >
                {tooltipMessages[index] || "Info message"}
              </div>
            </div>
          </div>
        </foreignObject>
      );
    });

    return elements;
  };

  // Render nodes
  const renderNodesWithTitles = () => {
    // Group nodes by intermediateName, keeping a separate group for nodes without it
    const groupedNodes = nodes.reduce(
      (acc, node) => {
        if (node.intermediateName) {
          const group = node.intermediateName;
          if (!acc[group]) acc[group] = [];
          acc[group].push(node);
        } else {
          acc.ungrouped.push(node); // Add nodes without intermediateName to "ungrouped"
        }
        return acc;
      },
      { ungrouped: [] } // Initialize with an ungrouped array
    );

    // Helper to render individual nodes
    const renderNode = (node) => {
      const isHovered = hoveredNodes.has(node);
      const isSelected = selectedNodes.includes(node);
      const isRelevant = visitedNodes.has(node); // Only render relevant nodes if filtering
      const padding = 5; // Padding from the left edge of the rectangle
      const nodeWidth = sankeyGenerator.nodeWidth();
      // Check if the node is in one of the first three columns
      const isInFirstThreeColumns =
        node.x0 < MARGIN_X + 5 * sankeyGenerator.nodeWidth();

      // // Function to truncate text with ellipsis if it exceeds the width
      // const truncateText = (text, maxWidth) => {
      //   const canvas = document.createElement("canvas");
      //   const context = canvas.getContext("2d");
      //   context.font = "14px Urbanist"; // Match the font used in the <text>
      //   if (context.measureText(text).width <= maxWidth) {
      //     return text;
      //   }
      //   for (let i = text.length; i > 0; i--) {
      //     const truncated = text.slice(0, i) + "...";
      //     if (context.measureText(truncated).width <= maxWidth) {
      //       return truncated;
      //     }
      //   }
      //   return text; // Fallback to original text if truncation fails
      // };

      if (!isRelevant) return null;

      // Find all incoming and outgoing links for this node
      const incomingLinks = filteredLinks.filter(
        (link) => link.target === node
      );
      const outgoingLinks = filteredLinks.filter(
        (link) => link.source === node
      );

      const gradientIdTtB = `gradientIdTtB-${node.index}`;
      const gradientIdLtR = `gradientIdLtR-${node.index}`;
      // const maskId = `mask-${node.index}`;

      return (
        // <g
        //   key={node.index}
        //   onMouseEnter={() => handleMouseEnter(node)}
        //   onMouseLeave={handleMouseLeave}
        //   onClick={() => handleClick(node)}
        //   style={{ cursor: "pointer" }}
        // >
        // {isHovered && (
        //   <defs>
        //     <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
        //       <stop offset="0%" stopColor="#bed1f7" stopOpacity="0.2" />
        //       <stop offset="30%" stopColor="white" stopOpacity="0.6" />
        //       <stop offset="70%" stopColor="white" stopOpacity="0.6" />
        //       <stop offset="100%" stopColor="#bed1f7" stopOpacity="0.2" />
        //     </linearGradient>
        //   </defs>
        // )}
        // <rect
        //   height={node.y1 - node.y0}
        //   width={sankeyGenerator.nodeWidth()}
        //   x={node.x0}
        //   y={node.y0}
        //   // fill={isHovered ? `url(#${gradientId})` : "white"}
        //   fill={"white"}
        //   fillOpacity={1}
        //   rx={2}
        //   // stroke={"none"}
        //   stroke={isSelected ? "#004EEB" : "none"}
        //   strokeWidth={1} // Width of the border
        // />
        //   {isHovered && (
        //     <>
        //       {/* Left border */}
        //       <line
        //         x1={node.x0}
        //         y1={node.y0}
        //         x2={node.x0}
        //         y2={node.y1}
        //         stroke="#004EEB"
        //         strokeWidth="1"
        //       />
        //       {/* Right border */}
        //       <line
        //         x1={node.x0 + sankeyGenerator.nodeWidth()}
        //         y1={node.y0}
        //         x2={node.x0 + sankeyGenerator.nodeWidth()}
        //         y2={node.y1}
        //         stroke="#004EEB"
        //         strokeWidth="1"
        //       />
        //     </>
        //   )}
        //   {isSelected && (
        //     <>
        //       {/* Left border */}
        //       {/* <line
        //         x1={node.x0}
        //         y1={node.y0}
        //         x2={node.x0}
        //         y2={node.y1}
        //         stroke="#1849a9"
        //         strokeWidth="1"
        //       /> */}
        //       {/* Right border */}
        //       {/* <line
        //         x1={node.x0 + sankeyGenerator.nodeWidth()}
        //         y1={node.y0}
        //         x2={node.x0 + sankeyGenerator.nodeWidth()}
        //         y2={node.y1}
        //         stroke="#1849a9"
        //         strokeWidth="1"
        //       /> */}
        //     </>
        //   )}
        //   {!isHovered && !isSelected && (
        //     // Bottom Border
        //     <line
        //       x1={node.x0} // Start at the left edge of the node
        //       y1={node.y1} // Position at the bottom of the node
        //       x2={node.x0 + nodeWidth} // End at the right edge of the node
        //       y2={node.y1} // Keep y-coordinates the same for a horizontal line
        //       stroke="#E4E7EC" // Border color
        //       strokeWidth="1" // Border thickness
        //     />
        //   )}
        //   {/* Arrow on the right for nodes in the first three columns */}
        //   {/* {isInFirstThreeColumns && (
        //     <path
        //       d={`
        //           M${node.x0 + sankeyGenerator.nodeWidth()},${
        //         node.y0 + fixedHeight / 2
        //       }
        //           L${node.x0 + sankeyGenerator.nodeWidth() + 6},${
        //         node.y0 + fixedHeight / 2 - 3
        //       }
        //           L${node.x0 + sankeyGenerator.nodeWidth() + 6},${
        //         node.y0 + fixedHeight / 2 + 3
        //       }
        //           Z
        //         `}
        //       fill="#808080"
        //     />
        //   )} */}
        //   {isInFirstThreeColumns && (
        //     <circle
        //       cx={node.x0 + nodeWidth + 3} // Position at the right edge of the node
        //       cy={(node.y0 + node.y1) / 2} // Center vertically
        //       r={3} // Radius of the circle
        //       // fill="#808080"
        //       fill={isHovered ? "#004EEB" : "#808080"}
        //     />
        //   )}
        //   <title>{node.name}</title> {/* Full name on hover */}
        //   <text
        //     x={node.x0 + padding} // Add padding from the left edge of the node
        //     y={(node.y0 + node.y1) / 2} // Center vertically
        //     textAnchor="start" // Align text to the left
        //     dy="0.35em"
        //     fontSize={14}
        //     fill="#344054"
        //     fontFamily="Urbanist, sans-serif"
        //     fontWeight={500}
        //   >
        //     {truncateText(node.name, nodeWidth - padding * 4)}
        //   </text>
        // </g>

        <g key={node.index}>
          <defs>
            {/* Define the linear gradient */}
            <linearGradient id={gradientIdTtB} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#004EEB" stopOpacity="0.2" />
              <stop offset="30%" stopColor="#94b8ff" stopOpacity="0.1" />
              <stop offset="40%" stopColor="#cadbfc" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#f2f5fa" stopOpacity="0.1" />
              <stop offset="60%" stopColor="#cadbfc" stopOpacity="0.1" />
              <stop offset="70%" stopColor="#94b8ff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#004EEB" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <defs>
            {/* Define the linear gradient */}
            <linearGradient id={gradientIdLtR} x1="1" x2="0" y1="0" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="10%" stopColor="white" stopOpacity="0.2" />
              <stop offset="90%" stopColor="white" stopOpacity="0.2" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
          </defs>

          {isHovered && (
            <>
              <rect
                x={node.x0}
                y={node.y0}
                width={nodeWidth}
                height={node.y1 - node.y0}
                fill={`url(#${gradientIdTtB})`}
                // rx="4" // Optional: adds rounded corners
              />
              <rect
                x={node.x0}
                y={node.y0}
                width={nodeWidth}
                height={node.y1 - node.y0}
                fill={`url(#${gradientIdLtR})`}
                // rx="4" // Optional: adds rounded corners
              />
            </>
          )}

          {/* Node Content */}
          <foreignObject
            key={node.index}
            x={node.x0}
            y={node.y0}
            width={nodeWidth}
            height={node.y1 - node.y0}
          >
            <div
              className={`relative w-full h-full hover:cursor-pointer flex items-center ${
                isHovered
                  ? "text-black bg-transparent border-b-2"
                  : "bg-transparent text-gray-500 border-b-2"
              }`}
              onMouseEnter={() => handleMouseEnter(node)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(node)}
            >
              <div
                className={`
        w-full
        px-2
        overflow-hidden
        font-urbanist font-medium text-xs
        
      `}
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2, // Limit to 2 lines
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  // textAlign: "center", // Horizontal centering
                  lineHeight: "1.2rem", // Line height for the text
                  height: "fit-content", // Make the container fit the text height
                  margin: "auto", // Vertically center the container within the parent
                }}
                title={node.name.toUpperCase()} // Full text will show on hover
              >
                {node.name.toUpperCase()}
              </div>
            </div>
          </foreignObject>

          {/* Circle (Optional)
          {isInFirstThreeColumns && (
            <circle
              cx={node.x0 + nodeWidth + 2}
              cy={node.y0 + (node.y1 - node.y0) / 2}
              r="3"
              fill={isHovered ? "#004EEB" : "#808080"}
            />
          )} */}

          {/* Render circles for incoming links */}
          {incomingLinks.map((link, index) => (
            <circle
              key={`in-${index}`}
              cx={node.x0 - 2}
              cy={(link.target.y0 + link.target.y1) / 2}
              r="3"
              fill={isHovered ? "#004EEB" : "#808080"}
            />
          ))}

          {/* Render circles for outgoing links */}
          {outgoingLinks.map((link, index) => (
            <circle
              key={`out-${index}`}
              cx={node.x0 + nodeWidth + 2}
              cy={(link.source.y0 + link.source.y1) / 2}
              r="3"
              fill={isHovered ? "#004EEB" : "#808080"}
            />
          ))}
        </g>
      );
    };

    // Map through grouped nodes (with intermediateName) and render titles and nodes
    const titledGroups = Object.entries(groupedNodes)
      .filter(([key]) => key !== "ungrouped")
      .map(([groupName, groupNodes]) => {
        const relevantGroupNodes = groupNodes.filter((node) =>
          visitedNodes.has(node)
        );

        if (relevantGroupNodes.length === 0) {
          return null;
        }

        const minY = Math.min(...relevantGroupNodes.map((node) => node.y0));
        const leftX = Math.min(...relevantGroupNodes.map((node) => node.x0));

        // Check if this group is at the top position
        const isTopGroup = !Object.entries(groupedNodes)
          .filter(([key]) => key !== "ungrouped")
          .some(([otherGroupName, otherGroupNodes]) => {
            if (otherGroupName === groupName) return false;
            const otherRelevantNodes = otherGroupNodes.filter(
              (node) => visitedNodes.has(node) && node.x0 === leftX
            );
            if (otherRelevantNodes.length === 0) return false;
            const otherMinY = Math.min(
              ...otherRelevantNodes.map((node) => node.y0)
            );
            return otherMinY < minY;
          });

        const shouldRenderGroupTitle =
          leftX >= MARGIN_X + 5 * sankeyGenerator.nodeWidth() && !isTopGroup;

        const groupTitle = shouldRenderGroupTitle && (
          <foreignObject
            key={`title-${groupName}`}
            x={leftX}
            y={minY - 51}
            width={200}
            height={60}
          >
            <div
              className="bg-[#FEF6EE] rounded-xl border border-[#FFE6D5] py-2 px-3 text-[14px] leading-[14px] font-medium text-brand-900 cursor-default"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={groupName} // Tooltip for the complete text
            >
              {groupName}
            </div>
          </foreignObject>
        );

        const groupNodeElements = relevantGroupNodes.map(renderNode);

        return (
          <g key={`group-${groupName}`}>
            {groupTitle}
            {groupNodeElements}
          </g>
        );
      });

    const ungroupedNodes = groupedNodes.ungrouped
      .filter((node) => visitedNodes.has(node))
      .map(renderNode);

    return (
      <>
        {titledGroups}
        <g key="ungrouped-nodes">{ungroupedNodes}</g>
      </>
    );
  };

  // Render links
  const allLinks = filteredLinks.map((link, i) => {
    const isHovered = hoveredLinks.has(link);
    const isRelevant = visitedLinks.has(link);
    const path = customLinkGenerator(link, 50); // Adjust the curvature factor here
    return (
      <path
        key={i}
        d={path}
        stroke={isHovered ? "#004EEB" : isRelevant ? "#808080" : "#004EEB"}
        fill="none"
        strokeOpacity={isHovered ? 0.5 : 0.5}
        strokeWidth={isHovered ? 2 : 1}
      />
    );
  });

  // console.log("searchText--", searchText);
  // console.log("selectedNodes--", selectedNodes);
  // console.log("filteredBySearch--", filteredBySearch);
  console.log("visitedNodes--", visitedNodes);

  const renderAnimatedLink = (link, index) => {
    const isHovered = hoveredLinks.has(link);
    const isRelevant = visitedLinks.has(link);
    const path = customLinkGenerator(link, 50);

    return (
      <g key={`${index}-${animationKey}`}>
        {/* Background static path */}
        <path
          d={path}
          stroke={isHovered ? "#004EEB" : isRelevant ? "#808080" : "#004EEB"}
          fill="none"
          strokeOpacity={0}
          strokeWidth={isHovered ? 2 : 1}
        />
        {/* Animated path */}
        {/* <path
          d={path}
          stroke={isHovered ? "#004EEB" : isRelevant ? "#808080" : "#004EEB"}
          fill="none"
          strokeOpacity={isHovered ? 0.5 : 0}
          strokeWidth={isHovered ? 2 : 0}
          strokeDasharray="8 8"
          style={{
            animation: `flowAnimation 0.5s linear infinite`,
          }}
        /> */}
        {/* Path being drawn */}
        <path
          d={path}
          stroke={isHovered ? "#004EEB" : isRelevant ? "#808080" : "#004EEB"}
          fill="none"
          strokeOpacity={isHovered ? 0.5 : 0.5}
          strokeWidth={isHovered ? 2 : 1}
          style={{
            strokeDasharray: "1000", // Matches the full length of the path
            strokeDashoffset: "-1000", // Starts at the end of the path
            animation: `drawPath 0.5s ease-out forwards`, // Animates for 5 seconds
            animationDelay: "0s", // Ensures the animation starts immediately
            animationFillMode: "forwards", // Ensures the stroke remains visible
          }}
        />
      </g>
    );
  };
  return (
    <div>
      <div className="flex justify-between px-5">
        <div className="font-bold text-brand-900 text-xl flex items-end">
          Supply Chain
        </div>
        <button onClick={resetStates}>Reset</button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* <div className="relative w-full h-0 pb-[56.25%]"> */}
        <div className="relative w-full h-0">
          <svg
            className="w-full h-auto md:h-[500px] lg:h-[700px]"
            viewBox={`0 0 ${width} ${dynamicHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <style>
                {/* {`
                @keyframes flowAnimation {
                    0% {
                      stroke-dashoffset: 0;
                    }
                    100% {
                      stroke-dashoffset: 16;
                    }
                  } */}
                {`
      @keyframes drawPath {
        from {
          stroke-dashoffset: -1000; /* Start at the end */
        }
        to {
          stroke-dashoffset: 0; /* Finish at the beginning */
        }
      }
    `}
              </style>
            </defs>

            {renderColumnTitles()}
            {renderSearchBars()}

            {visitedNodes.size === 0 ? (
              <foreignObject
                x={0}
                y={MARGIN_Y + TITLE_AND_SEARCH_MARGIN}
                width={width}
                height={dynamicHeight - MARGIN_Y * 2}
              >
                <div className="flex justify-center w-full h-full text-gray-500 text-xl font-medium pt-5">
                  No relevant data found
                </div>
              </foreignObject>
            ) : (
              <>
                <g>
                  {filteredLinks.map((link, i) => renderAnimatedLink(link, i))}
                </g>
                <g>{renderNodesWithTitles()}</g>
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
