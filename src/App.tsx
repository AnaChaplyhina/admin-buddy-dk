import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import GeneratorPage from "./features/generator/GeneratorPage";

export default function App() {
  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<GeneratorPage />} />
        </Routes>
      </main>
    </div>
  );
}


