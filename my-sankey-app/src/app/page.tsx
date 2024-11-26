import SankeyDiagram from "./components/SankeyDiagram";
import sankeyData from "../../public/sankeydata.json";

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <SankeyDiagram data={sankeyData} />
    </div>
  );
}
