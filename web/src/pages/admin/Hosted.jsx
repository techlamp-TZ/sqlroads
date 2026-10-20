// Admin pages still drawn by their old views (see ../hosted/hosted.jsx); kept for the group 5 tests and imports.
import { hosted as hostedIn } from "../hosted/hosted.jsx";

export const hosted = (name) => hostedIn(name, "admin");
export const ReviewPage = hosted("review");
export const GeneratePage = hosted("generate");
