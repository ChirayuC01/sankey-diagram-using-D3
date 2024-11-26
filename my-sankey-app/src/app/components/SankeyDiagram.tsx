"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { d3Sankey } from "../utils/d3-sankey";

interface SankeyNode extends d3.SimulationNodeDatum {
  name: string;
  column: number;
  x?: any;
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

    const calculateColumn = (nodeName: string, column = 0) => {
      if (processedNodes.has(nodeName)) return;
      processedNodes.add(nodeName);
      nodeColumns.set(nodeName, column);

      // Find all targets of this node
      data.links
        .filter((link) => link.source === nodeName)
        .forEach((link) => {
          calculateColumn(link.target, column + 1);
        });
    };

    // Find start nodes (nodes that are only sources, never targets)
    const startNodes = new Set(data.nodes.map((n) => n.name));
    data.links.forEach((link) => {
      startNodes.delete(link.target);
    });

    // Calculate columns starting from each start node
    startNodes.forEach((nodeName) => {
      calculateColumn(nodeName);
    });

    // Create Sankey generator
    const sankey = d3Sankey()
      .nodeWidth(200)
      .nodePadding(20)
      .size([width, height]);

    // Process data
    const nodeMap: { [key: string]: SankeyNode } = {};
    data.nodes.forEach((node) => {
      nodeMap[node.name] = {
        name: node.name,
        column: nodeColumns.get(node.name) || 0,
        sourceLinks: [], // Initialize as an empty array
        targetLinks: [], // Initialize as an empty array
      } as SankeyNode;
    });

    const sankeyData = {
      nodes: data.nodes.map((node) => ({
        name: node.name,
        column: nodeColumns.get(node.name) || 0,
      })) as SankeyNode[],
      links: data.links
        .filter((link) => nodeMap[link.source] && nodeMap[link.target])
        .map((link) => ({
          source: nodeMap[link.source],
          target: nodeMap[link.target],
          value: Number(link.value),
        })) as SankeyLink[],
    };
    console.log("data---", data);
    console.log("sankeyData.nodes---", sankeyData.nodes);
    sankey.nodes(sankeyData.nodes).links(sankeyData.links).layout(32);

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
