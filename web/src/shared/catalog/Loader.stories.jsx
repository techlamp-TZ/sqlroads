import { Loader } from "../index.jsx";
import { LoaderSet } from "./pairs.jsx";

export default { title: "Components/Loader (ours)", component: Loader };

export const Sizes = { render: () => <LoaderSet /> };
export const WithLabel = { render: () => <Loader showLabel label="Running the query" /> };
