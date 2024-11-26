"use client";
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { d3Sankey } from "../utils/d3-sankey";

// Define types for the Sankey diagram
interface CustomSankey {
  nodeWidth(width: number): CustomSankey;
  nodePadding(padding: number): CustomSankey;
  size(size: [number, number]): CustomSankey;
  nodes(nodes: any[]): CustomSankey;
  links(links: any[]): CustomSankey;
  layout(iterations: number): CustomSankey;
}

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
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!svgRef.current || !data) return;

    // Clear existing content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 10, right: 10, bottom: 400, left: 10 };
    const width = 1280 - margin.left - margin.right;
    const height = 720 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Initialize node map for quick lookups
    const nodeMap = new Map<string, SankeyNode>();

    const sankeyData = {
      nodes: data.nodes.map((node) => {
        const sankeyNode: SankeyNode = {
          name: node.name,
          column: 0,
          x: 0,
          sourceLinks: [],
          targetLinks: [],
          value: 0,
        };
        nodeMap.set(node.name, sankeyNode);
        return sankeyNode;
      }),
      links: data.links.map((link) => ({
        source: nodeMap.get(link.source)!,
        target: nodeMap.get(link.target)!,
        value: Number(link.value) || 1,
      })) as SankeyLink[],
    };

    // Create and configure the Sankey generator
    const sankey = d3Sankey() as CustomSankey;
    sankey
      .nodeWidth(200)
      .nodePadding(20)
      .size([width, height])
      .nodes(sankeyData.nodes)
      .links(sankeyData.links)
      .layout(32);

    // Adjust link positioning (sy and ty)
    sankeyData.links.forEach((link) => {
      link.sy = (link.source.y || 0) + (link.source.dy || 0) / 2;
      link.ty = (link.target.y || 0) + (link.target.dy || 0) / 2;
    });

    // Define a custom path generator for links
    const sankeyLinkPath = (link: SankeyLink) => {
      const sourceX = (link.source.x || 0) + 200;
      const sourceY = link.sy || 0;
      const targetX = link.target.x || 0;
      const targetY = link.ty || 0;
      const curvature = 0.5;
      const controlPointX1 = sourceX + curvature * (targetX - sourceX);
      const controlPointX2 = targetX - curvature * (targetX - sourceX);
      return `M${sourceX},${sourceY}
        C${controlPointX1},${sourceY}
        ${controlPointX2},${targetY}
        ${targetX},${targetY}`;
    };

    // Draw links
    const link = svg
      .append("g")
      .selectAll(".link")
      .data(sankeyData.links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", (d) => sankeyLinkPath(d as SankeyLink))
      .style("stroke-width", (d) => Math.max(1, d.dy || 1))
      .style("stroke", "gray")
      .style("stroke-opacity", 0.2)
      .style("fill", "none");

    // Add hover effect for links
    link
      .on("mouseover", function () {
        d3.select(this).style("stroke", "#1849a9").style("stroke-opacity", 0.7);
      })
      .on("mouseout", function () {
        if (!d3.select(this).classed("permanent-highlight")) {
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
      .style("font-size", "12px")
      .style("cursor", "pointer");

    // Add hover effect for nodes
    node
      .on("mouseover", function (event, d) {
        highlightRelevantPaths(d as SankeyNode, false); // Highlight relevant paths on hover
        d3.select(this).select("rect").style("fill-opacity", 1); // Highlight the node itself
      })
      .on("mouseout", function () {
        link.style("stroke", "gray").style("stroke-opacity", 0.2); // Reset link highlights
        node.selectAll("rect").style("fill-opacity", 0.9); // Reset node opacity
      });

    // Highlight relevant paths (nodes and links)
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
  }, [data, searchQuery]);

  return (
    <div className="w-full overflow-x-auto">
      <input
        type="text"
        placeholder="Search nodes"
        className="mb-4 p-2 border rounded-lg"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <svg ref={svgRef} className="min-w-[1280px]" />
    </div>
  );
};

export default SankeyDiagram;
