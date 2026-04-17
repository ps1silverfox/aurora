import { BrowserRouter, Route, Routes } from 'react-router-dom';

function NotFound() {
  return <div>404 — Page Not Found</div>;
}

function Home() {
  return <div>Aurora CMS</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
