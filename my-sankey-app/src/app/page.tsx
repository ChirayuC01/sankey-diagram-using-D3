// import SankeyDiagram from "./components/SankeyDiagram";
// import { Sankey } from "./components/SankeyD3";
// import sankeyData from "../../public/sankeydata.json";
// import { data } from "@/app/data/data";

// export default function Home() {
//   return (
//     <div className="container mx-auto p-4">
//       {/* <SankeyDiagram data={sankeyData} /> */}
//       <Sankey data={data} width={700} height={400} />;
//     </div>
//   );
// }

import { Sankey } from "./components/SankeyD3";
import { data } from "@/app/data/data";

export default function Home() {
  const numericData = {
    nodes: data.nodes,
    links: data.links.map((link) => ({ ...link, value: +link.value })),
  };

  return (
    <div className="container mx-auto p-4">
      <Sankey data={numericData} width={1280} height={800} />
    </div>
  );
}
