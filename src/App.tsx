export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Skeleton UI layout based on webpraat_plan.md */}
      <header className="h-10 border-b border-slate-300 bg-white">
        {/* MenuBar skeleton placeholder */}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-slate-300 bg-white">
          {/* ObjectsPanel skeleton placeholder */}
        </aside>
        <main className="flex-1 bg-slate-50">
          {/* Editor Tabs / Canvas area skeleton placeholder */}
        </main>
      </div>
      <footer className="h-32 border-t border-slate-300 bg-white">
        {/* InfoWindow / ScriptConsole skeleton placeholder */}
      </footer>
    </div>
  );
}
