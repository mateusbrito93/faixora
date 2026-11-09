import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ToastContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { NewAnalysis } from './pages/NewAnalysis';
import { ProcessingView } from './pages/ProcessingView';
import { ReportView } from './pages/ReportView';
import { AnalysesList } from './pages/AnalysesList';
import { SettingsView } from './pages/SettingsView';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewAnalysis />} />
            <Route path="/analyses" element={<AnalysesList />} />
            <Route path="/analyses/:id/processing" element={<ProcessingView />} />
            <Route path="/analyses/:id" element={<ReportView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
