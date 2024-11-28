import { sankey, sankeyCenter, sankeyLinkHorizontal } from "d3-sankey";

const MARGIN_Y = 25;
const MARGIN_X = 5;

export const Sankey = ({ width, height, data }) => {
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

  const allNodes = nodes.map((node) => (
    <g key={node.index}>
      <rect
        height={fixedHeight}
        width={sankeyGenerator.nodeWidth()}
        x={node.x0}
        y={node.y0}
        stroke="black"
        fill="#a53253"
        fillOpacity={0.8}
        rx={0.9}
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
  ));

  const allLinks = links.map((link, i) => {
    const path = customLinkGenerator(link);

    const linkWidthScale = 0.001; // Adjust this factor to reduce link width

    return (
      <path
        key={i}
        d={path}
        stroke="#a53253"
        fill="none"
        strokeOpacity={0.5}
        strokeWidth={Math.max(1, link.width * linkWidthScale)}
      />
    );
  });

  return (
    <div>
      <svg width={width} height={height}>
        <g>{allNodes}</g>
        <g>{allLinks}</g>
      </svg>
    </div>
  );
};
