import * as d3 from "d3";

export function d3Sankey() {
    const d3Sankey = {};
    let nodeWidth = 24;
    let nodePadding = 8;
    let size = [1, 1];
    let nodes = [];
    let links = [];

    d3Sankey.nodeWidth = function (_) {
        if (_ === undefined) return nodeWidth;
        nodeWidth = +_;
        return d3Sankey;
    };

    d3Sankey.nodePadding = function (_) {
        if (_ === undefined) return nodePadding;
        nodePadding = +_;
        return d3Sankey;
    };

    d3Sankey.nodes = function (_) {
        if (_ === undefined) return nodes;
        nodes = _;
        return d3Sankey;
    };

    d3Sankey.links = function (_) {
        if (_ === undefined) return links;
        links = _;
        return d3Sankey;
    };

    d3Sankey.size = function (_) {
        if (_ === undefined) return size;
        size = _;
        return d3Sankey;
    };

    d3Sankey.layout = function (iterations) {
        computeNodeLinks();
        computeNodeValues();
        computeNodeBreadths();
        computeNodeDepths(iterations);
        computeLinkDepths();
        return d3Sankey;
    };

    d3Sankey.relayout = function () {
        computeLinkDepths();
        return d3Sankey;
    };

    d3Sankey.link = function () {
        let curvature = 0.5;

        const link = function (d) {
            const x0 = d.source.x + d.source.dx;
            const x1 = d.target.x;
            const xi = d3.interpolateNumber(x0, x1);
            const x2 = xi(curvature);
            const x3 = xi(1 - curvature);
            const y0 = d.source.y + (d.dy || 0) / 2;
            const y1 = d.target.y + (d.dy || 0) / 2;

            return `M${x0},${y0}C${x2},${y0} ${x3},${y1} ${x1},${y1}`;
        };

        link.curvature = function (_) {
            if (_ === undefined) return curvature;
            curvature = +_;
            return link;
        };

        return link;
    };

    function computeNodeLinks() {
        nodes.forEach((node) => {
            node.sourceLinks = [];
            node.targetLinks = [];
        });
        links.forEach((link) => {
            const source = typeof link.source === "number" ? (link.source = nodes[link.source]) : link.source;
            const target = typeof link.target === "number" ? (link.target = nodes[link.target]) : link.target;

            source.sourceLinks = source.sourceLinks || [];
            target.targetLinks = target.targetLinks || [];

            source.sourceLinks.push(link);
            target.targetLinks.push(link);
        });
    }

    function computeNodeValues() {
        nodes.forEach((node) => {
            node.value = Math.max(
                d3.sum(node.sourceLinks, (link) => link.value),
                d3.sum(node.targetLinks, (link) => link.value)
            );
        });
    }

    function computeNodeBreadths() {
        let remainingNodes = nodes;
        let nextNodes;
        let x = 0;

        while (remainingNodes.length) {
            nextNodes = [];
            remainingNodes.forEach((node) => {
                node.x = x;
                node.dx = nodeWidth;
                node.sourceLinks.forEach((link) => nextNodes.push(link.target));
            });
            remainingNodes = nextNodes;
            ++x;
        }

        moveSinksRight(x);
        scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
    }

    function moveSinksRight(x) {
        nodes.forEach((node) => {
            if (!node.sourceLinks.length) {
                node.x = x - 1;
            }
        });
    }

    function scaleNodeBreadths(kx) {
        nodes.forEach((node) => {
            node.x *= kx;
        });
    }

    function computeNodeDepths(iterations) {
        const nodesByBreadth = Array.from(d3.group(nodes, (d) => d.x).values());

        initializeNodeDepth();
        resolveCollisions();

        for (let alpha = 1; iterations > 0; --iterations) {
            relaxRightToLeft(alpha *= 0.99);
            resolveCollisions();
            relaxLeftToRight(alpha);
            resolveCollisions();
        }

        function initializeNodeDepth() {
            nodesByBreadth.forEach((nodes) => {
                nodes.forEach((node, i) => {
                    node.dy = 40;
                    node.y = i * (40 + nodePadding);
                });
            });
        }

        function relaxLeftToRight(alpha) {
            nodesByBreadth.forEach((nodes) => {
                nodes.forEach((node) => {
                    if (node.targetLinks.length) {
                        const y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, (link) => link.value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedSource(link) {
                return center(link.source) * link.value;
            }
        }

        function relaxRightToLeft(alpha) {
            [...nodesByBreadth].reverse().forEach((nodes) => {
                nodes.forEach((node) => {
                    if (node.sourceLinks.length) {
                        const y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, (link) => link.value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedTarget(link) {
                return center(link.target) * link.value;
            }
        }

        function resolveCollisions() {
            nodesByBreadth.forEach((nodes) => {
                let y0 = 0;
                nodes.sort((a, b) => a.y - b.y);
                nodes.forEach((node) => {
                    const dy = y0 - node.y;
                    if (dy > 0) node.y += dy;
                    y0 = node.y + node.dy + nodePadding;
                });

                const dy = y0 - size[1];
                if (dy > 0) {
                    y0 = nodes[nodes.length - 1].y -= dy;

                    for (let i = nodes.length - 2; i >= 0; --i) {
                        const node = nodes[i];
                        const dy = node.y + node.dy + nodePadding - y0;
                        if (dy > 0) node.y -= dy;
                        y0 = node.y;
                    }
                }
            });
        }
    }

    function computeLinkDepths() {
        nodes.forEach((node) => {
            node.sourceLinks.sort((a, b) => a.target.y - b.target.y);
            node.targetLinks.sort((a, b) => a.source.y - b.source.y);
        });
        nodes.forEach((node) => {
            let sy = 0, ty = 0;
            node.sourceLinks.forEach((link) => {
                link.sy = sy;
                sy += link.dy;
            });
            node.targetLinks.forEach((link) => {
                link.ty = ty;
                ty += link.dy;
            });
        });
    }

    function center(node) {
        return node.y + node.dy / 2;
    }

    return d3Sankey;
}
