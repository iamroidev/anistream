import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import AnimePage from "./pages/AnimePage";
import WatchPage from "./pages/WatchPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/anime/:id" element={<AnimePage />} />
      <Route path="/watch/:animeId/:episodeId" element={<WatchPage />} />
    </Routes>
  );
}
