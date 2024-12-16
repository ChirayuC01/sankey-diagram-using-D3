import { Sankey } from "./components/SankeyD3";
import { sankeyData, greenhouseData } from "@/app/data/data";

export default function Home() {
  const numericData = {
    apiName: sankeyData.apiName,
    apiCas: sankeyData.apiCas,
    nodes: sankeyData.nodes,
    links: sankeyData.links.map((link) => ({
      ...link,
      value: +link.value,
    })),
  };

  return (
    <div className="container mx-auto p-4">
      <Sankey data={numericData} width={1280} />
      {/* <Sankey data={greenhouseData} width={1280} /> */}
    </div>
  );
}
