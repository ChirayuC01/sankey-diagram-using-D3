import { Sankey } from "./components/SankeyD3";
import { sankeyData } from "@/app/data/data";
import { greenhouseData } from "@/app/data/greenhouseData";

export default function Home() {
  const numericData = {
    nodes: greenhouseData.nodes,
    links: greenhouseData.links.map((link) => ({
      ...link,
      value: +link.value,
    })),
  };

  return (
    <div className="container mx-auto p-4">
      <Sankey data={numericData} width={1280} height={1000} />
    </div>
  );
}
