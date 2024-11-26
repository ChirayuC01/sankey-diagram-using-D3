import * as d3 from "d3";

export function d3Sankey() { // Rename the function as well for consistency
    interface Node {
        x?: number;
        y?: number;
        dx?: number;
        dy?: number;
        value?: number;
        sourceLinks: Link[];
        targetLinks: Link[];
    }

    interface Link {
        source: Node | number;
        target: Node | number;
        value: number;
        dy?: number;
        sy?: number;
        ty?: number;
    }

    interface Sankey {
        nodeWidth(_: number): Sankey | number;
        nodePadding(_: number): Sankey | number;
        nodes(_: Node[]): Sankey | Node[];
        links(_: Link[]): Sankey | Link[];
        size(_: [number, number]): Sankey | [number, number];
        layout(iterations: number): Sankey;
        relayout(): Sankey;
        link(): SankeyLink;
    }

    interface SankeyLink {
        (d: Link): string;
        curvature(_: number): SankeyLink | number;
    }

    const d3Sankey: Partial<Sankey> = {}; // Rename variable
    let nodeWidth = 24;
    let nodePadding = 8;
    let size: [number, number] = [1, 1];
    let nodes: Node[] = [];
    let links: Link[] = [];

    d3Sankey.nodeWidth = function (_?: number): any {
        if (_ === undefined) return nodeWidth;
        nodeWidth = +_;
        return d3Sankey;
    };

    d3Sankey.nodePadding = function (_?: number): any {
        if (_ === undefined) return nodePadding;
        nodePadding = +_;
        return d3Sankey;
    };

    d3Sankey.nodes = function (_?: Node[]): any {
        if (_ === undefined) return nodes;
        nodes = _;
        return d3Sankey;
    };

    d3Sankey.links = function (_?: Link[]): any {
        if (_ === undefined) return links;
        links = _;
        return d3Sankey;
    };

    d3Sankey.size = function (_?: [number, number]): any {
        if (_ === undefined) return size;
        size = _;
        return d3Sankey;
    };

    d3Sankey.layout = function (iterations: number): any {
        computeNodeLinks();
        computeNodeValues();
        computeNodeBreadths();
        computeNodeDepths(iterations);
        computeLinkDepths();
        return d3Sankey;
    };

    d3Sankey.relayout = function (): any {
        computeLinkDepths();
        return d3Sankey;
    };

    d3Sankey.link = function (): SankeyLink {
        let curvature = 0.5;

        function link(d: Link): string {
            const x0 = (d.source as Node).x! + (d.source as Node).dx!;
            const x1 = (d.target as Node).x!;
            const xi = d3.interpolateNumber(x0, x1);
            const x2 = xi(curvature);
            const x3 = xi(1 - curvature);
            const y0 = (d.source as Node).y! + (d.dy || 0) / 2;
            const y1 = (d.target as Node).y! + (d.dy || 0) / 2;

            return `M${x0},${y0}C${x2},${y0} ${x3},${y1} ${x1},${y1}`;
        }

        link.curvature = function (_?: number): any {
            if (_ === undefined) return curvature;
            curvature = +_;
            return link;
        };

        return link;
    };

    function computeNodeLinks(): void {
        nodes.forEach((node) => {
            node.sourceLinks = []; // Ensure this is initialized
            node.targetLinks = []; // Ensure this is initialized
        });
        links.forEach((link) => {
            const source = typeof link.source === "number" ? (link.source = nodes[link.source]) : link.source;
            const target = typeof link.target === "number" ? (link.target = nodes[link.target]) : link.target;

            // Initialize the sourceLinks and targetLinks arrays if not already done
            (source as Node).sourceLinks = (source as Node).sourceLinks || [];
            (target as Node).targetLinks = (target as Node).targetLinks || [];

            (source as Node).sourceLinks.push(link);
            (target as Node).targetLinks.push(link);
        });
    }


    function computeNodeValues(): void {
        nodes.forEach((node) => {
            node.value = Math.max(
                d3.sum(node.sourceLinks, (link) => link.value),
                d3.sum(node.targetLinks, (link) => link.value)
            );
        });
    }

    function computeNodeBreadths(): void {
        let remainingNodes = nodes;
        let nextNodes: Node[];
        let x = 0;

        while (remainingNodes.length) {
            nextNodes = [];
            remainingNodes.forEach((node) => {
                node.x = x;
                node.dx = nodeWidth;
                node.sourceLinks.forEach((link) => nextNodes.push(link.target as Node));
            });
            remainingNodes = nextNodes;
            ++x;
        }

        moveSinksRight(x);
        scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
    }

    function moveSinksRight(x: number): void {
        nodes.forEach((node) => {
            if (!node.sourceLinks.length) {
                node.x = x - 1;
            }
        });
    }

    function scaleNodeBreadths(kx: number): void {
        nodes.forEach((node) => {
            node.x! *= kx;
        });
    }

    function computeNodeDepths(iterations: number): void {
        const nodesByBreadth = Array.from(d3.group(nodes, (d) => d.x!).values());

        initializeNodeDepth();
        resolveCollisions();

        for (let alpha = 1; iterations > 0; --iterations) {
            relaxRightToLeft(alpha *= 0.99);
            resolveCollisions();
            relaxLeftToRight(alpha);
            resolveCollisions();
        }

        function initializeNodeDepth(): void {
            nodesByBreadth.forEach((nodes) => {
                nodes.forEach((node, i) => {
                    node.dy = 40;
                    node.y = i * (40 + nodePadding);
                });
            });
        }

        function relaxLeftToRight(alpha: number): void {
            nodesByBreadth.forEach((nodes) => {
                nodes.forEach((node) => {
                    if (node.targetLinks.length) {
                        const y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, (link) => link.value);
                        node.y! += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedSource(link: Link): number {
                return center(link.source as Node) * link.value;
            }
        }

        function relaxRightToLeft(alpha: number): void {
            [...nodesByBreadth].reverse().forEach((nodes) => {
                nodes.forEach((node) => {
                    if (node.sourceLinks.length) {
                        const y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, (link) => link.value);
                        node.y! += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedTarget(link: Link): number {
                return center(link.target as Node) * link.value;
            }
        }

        function resolveCollisions(): void {
            nodesByBreadth.forEach((nodes) => {
                let y0 = 0;
                nodes.sort((a, b) => a.y! - b.y!);
                nodes.forEach((node) => {
                    const dy = y0 - node.y!;
                    if (dy > 0) node.y! += dy;
                    y0 = node.y! + node.dy! + nodePadding;
                });

                const dy = y0 - size[1];
                if (dy > 0) {
                    y0 = nodes[nodes.length - 1].y! -= dy;

                    for (let i = nodes.length - 2; i >= 0; --i) {
                        const node = nodes[i];
                        const dy = node.y! + node.dy! + nodePadding - y0;
                        if (dy > 0) node.y! -= dy;
                        y0 = node.y!;
                    }
                }
            });
        }
    }

    function computeLinkDepths(): void {
        nodes.forEach((node) => {
            node.sourceLinks.sort((a, b) => (a.target as Node).y! - (b.target as Node).y!);
            node.targetLinks.sort((a, b) => (a.source as Node).y! - (b.source as Node).y!);
        });
        nodes.forEach((node) => {
            let sy = 0, ty = 0;
            node.sourceLinks.forEach((link) => {
                link.sy = sy;
                sy += link.dy!;
            });
            node.targetLinks.forEach((link) => {
                link.ty = ty;
                ty += link.dy!;
            });
        });
    }

    function center(node: Node): number {
        return node.y! + node.dy! / 2;
    }

    return d3Sankey as Sankey; // Updated return statement
}
