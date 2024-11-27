"use client";
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { d3Sankey } from "../utils/d3-sankey";

const SankeyDiagram = ({ data }) => {
  const svgRef = useRef(null);
  const [permanentlyHighlightedNodes, setPermanentlyHighlightedNodes] =
    useState(new Set());

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
    const nodeMap = new Map();

    const sankeyData = {
      nodes: data.nodes.map((node) => {
        const sankeyNode = {
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
        source: nodeMap.get(link.source),
        target: nodeMap.get(link.target),
        value: Number(link.value) || 1,
      })),
    };

    // Create and configure the Sankey generator
    const sankey = d3Sankey();
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
    const sankeyLinkPath = (link) => {
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
      .attr("d", (d) => sankeyLinkPath(d))
      .style("stroke-width", (d) => Math.max(1, d.dy || 1))
      .style("stroke", "gray")
      .style("stroke-opacity", 0.2)
      .style("fill", "none");

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

    // Add hover and click effects for nodes
    node
      .on("mouseover", function (event, d) {
        highlightRelevantPaths(d, false);
        d3.select(this).select("rect").style("fill-opacity", 1);
      })
      .on("mouseout", function () {
        if (!permanentlyHighlightedNodes.size) {
          resetHighlights();
        }
      })
      .on("click", function (event, d) {
        togglePermanentHighlight(d);
      });

    const highlightRelevantPaths = (node, isPermanent) => {
      const relevantNodes = new Set();
      const relevantLinks = new Set();

      const traverse = (currentNode, upstream) => {
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

      d3.selectAll(".node rect").style("fill-opacity", (n) =>
        relevantNodes.has(n) ? 1 : 0.9
      );

      d3.selectAll(".left-border, .right-border").style("display", (n) =>
        relevantNodes.has(n) ? "block" : "none"
      );

      link
        .style("stroke", (l) => (relevantLinks.has(l) ? "#1849a9" : "gray"))
        .style("stroke-opacity", (l) => (relevantLinks.has(l) ? 0.7 : 0.2));
    };

    const resetHighlights = () => {
      d3.selectAll(".node rect").style("fill-opacity", 0.9);
      d3.selectAll(".left-border, .right-border").style("display", "none");
      link.style("stroke", "gray").style("stroke-opacity", 0.2);
    };

    const togglePermanentHighlight = (node) => {
      const newHighlightedNodes = new Set(permanentlyHighlightedNodes);
      if (newHighlightedNodes.has(node.name)) {
        newHighlightedNodes.delete(node.name);
        resetHighlights();
      } else {
        newHighlightedNodes.add(node.name);
        highlightRelevantPaths(node, true);
      }
      setPermanentlyHighlightedNodes(newHighlightedNodes);
    };
  }, [data, permanentlyHighlightedNodes]);

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={svgRef} className="min-w-[1280px]" />
    </div>
  );
};

export default SankeyDiagram;
