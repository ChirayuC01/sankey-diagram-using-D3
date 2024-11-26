"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { d3Sankey } from "../utils/d3-sankey";

interface SankeyNode extends d3.SimulationNodeDatum {
  name: string;
  column: number;
  x: number;
  y?: number;
  dx?: number;
  dy?: number;
  sourceLinks?: SankeyLink[];
  targetLinks?: SankeyLink[];
  value?: number;
}

interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  value: number;
  sy?: number;
  ty?: number;
  dy?: number;
}

interface SankeyProps {
  data: {
    nodes: Array<{ name: string }>;
    links: Array<{ source: string; target: string; value: string | number }>;
  };
}

const SankeyDiagram: React.FC<SankeyProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedNodesRef = useRef<SankeyNode[]>([]);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    // Clear existing content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 90, right: 10, bottom: 10, left: 10 };
    const width = 1280 - margin.left - margin.right;
    const height = 720 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate columns for nodes
    const nodeColumns = new Map<string, number>();
    const processedNodes = new Set<string>();

    // Find start nodes and end nodes
    const startNodes = new Set(data.nodes.map((n) => n.name));
    data.links.forEach((link) => {
      startNodes.delete(link.target);
    });

    const endNodes = new Set(data.nodes.map((n) => n.name));
    data.links.forEach((link) => {
      endNodes.delete(link.source);
    });

    // Calculate maximum column number
    let maxColumn = 0;
    data.nodes.forEach((node) => {
      const col = nodeColumns.get(node.name) || 0;
      maxColumn = Math.max(maxColumn, col);
    });

    // Create node map for quick lookups
    const nodeMap = new Map<string, SankeyNode>();

    // Initialize sankeyData with proper x values
    const sankeyData = {
      nodes: data.nodes.map((node) => {
        const column = nodeColumns.get(node.name) || 0;
        const xPosition = (column * (width - 200)) / Math.max(1, maxColumn);

        const sankeyNode: SankeyNode = {
          name: node.name,
          column: column,
          x: xPosition,
          sourceLinks: [],
          targetLinks: [],
          value: 0,
        };

        nodeMap.set(node.name, sankeyNode);
        return sankeyNode;
      }),
      links: [] as SankeyLink[],
    };

    // Process links after all nodes are created
    sankeyData.links = data.links.map((link) => ({
      source: nodeMap.get(link.source)!,
      target: nodeMap.get(link.target)!,
      value: Number(link.value) || 1, // Default to 1 if value is not provided
    }));

    // Create and configure the Sankey generator
    const sankey = d3Sankey()
      .nodeWidth(200)
      .nodePadding(20)
      .size([width, height]);

    // Apply the layout
    sankey.nodes(sankeyData.nodes).links(sankeyData.links).layout(32);
    console.log("data---", data);
    console.log("sankeyData.nodes---", sankeyData.nodes);

    // Draw links
    const link = svg
      .append("g")
      .selectAll(".link")
      .data(sankeyData.links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", sankey.link())
      .style("stroke-width", "1px")
      .style("stroke", "gray")
      .style("stroke-opacity", 0.2)
      .style("fill", "none");

    // Add link hover effect
    link
      .on("mouseover", function () {
        d3.select(this).style("stroke", "#1849a9").style("stroke-opacity", 0.7);
      })
      .on("mouseout", function () {
        const isHighlighted = d3.select(this).classed("permanent-highlight");
        if (!isHighlighted) {
          d3.select(this).style("stroke", "gray").style("stroke-opacity", 0.2);
        }
      });

    // Draw nodes
    const node = svg
      .append("g")
      .selectAll(".node")
      .data(sankeyData.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Add node rectangles
    node
      .append("rect")
      .attr("height", 40)
      .attr("width", 200)
      .style("fill", "#eff8ff")
      .style("cursor", "pointer")
      .style("fill-opacity", 0.9);

    // Add node borders
    node
      .append("rect")
      .attr("class", "left-border")
      .attr("x", -1)
      .attr("width", 1)
      .attr("height", 40)
      .style("fill", "#1849a9")
      .style("display", "none");

    node
      .append("rect")
      .attr("class", "right-border")
      .attr("x", 200)
      .attr("width", 1)
      .attr("height", 40)
      .style("fill", "#1849a9")
      .style("display", "none");

    // Add node labels
    node
      .append("text")
      .attr("x", 100)
      .attr("y", 20)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .text((d) => d.name)
      .style("font-size", "12px");

    // Node interaction handlers
    const highlightRelevantPaths = (node: SankeyNode, isPermanent: boolean) => {
      const relevantNodes = new Set<SankeyNode>();
      const relevantLinks = new Set<SankeyLink>();

      const traverse = (currentNode: SankeyNode, upstream: boolean) => {
        relevantNodes.add(currentNode);
        const links = upstream
          ? currentNode.targetLinks
          : currentNode.sourceLinks;
        links?.forEach((link) => {
          relevantLinks.add(link);
          traverse(upstream ? link.source : link.target, upstream);
        });
      };

      traverse(node, true);
      traverse(node, false);

      // Update visual states
      d3.selectAll(".node rect").style("fill-opacity", (n) =>
        relevantNodes.has(n as SankeyNode) ? 1 : 0.9
      );

      link
        .style("stroke", (l) =>
          relevantLinks.has(l as SankeyLink) ? "#1849a9" : "gray"
        )
        .style("stroke-opacity", (l) =>
          relevantLinks.has(l as SankeyLink) ? 0.7 : 0.2
        );
    };

    // Node event handlers
    node
      .on("mouseover", function (event, d) {
        const isPermanentHighlightActive =
          svg.selectAll(".permanent-highlight").size() > 0;
        if (!isPermanentHighlightActive) {
          highlightRelevantPaths(d as SankeyNode, false);
          d3.select(this)
            .selectAll(".left-border, .right-border")
            .style("display", "block");
        }
      })
      .on("mouseout", function () {
        const isPermanentHighlightActive =
          svg.selectAll(".permanent-highlight").size() > 0;
        if (!isPermanentHighlightActive) {
          link.style("stroke", "gray").style("stroke-opacity", 0.2);
          node.selectAll("rect").style("fill-opacity", 0.9);
          d3.select(this)
            .selectAll(".left-border, .right-border")
            .style("display", "none");
        }
      })
      .on("click", function (event, d) {
        const clickedNode = d as SankeyNode;
        const isSelected = selectedNodesRef.current.includes(clickedNode);

        if (isSelected) {
          selectedNodesRef.current = selectedNodesRef.current.filter(
            (n) => n !== clickedNode
          );
        } else {
          selectedNodesRef.current.push(clickedNode);
        }

        if (selectedNodesRef.current.length === 0) {
          // Reset all highlights
          link.style("stroke", "gray").style("stroke-opacity", 0.2);
          node.selectAll("rect").style("fill-opacity", 0.9);
          node
            .selectAll(".left-border, .right-border")
            .style("display", "none");
        } else {
          // Highlight paths for all selected nodes
          selectedNodesRef.current.forEach((n) =>
            highlightRelevantPaths(n, true)
          );
        }
      });
  }, [data]);

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={svgRef} className="min-w-[1280px]" />
    </div>
  );
};

export default SankeyDiagram;
