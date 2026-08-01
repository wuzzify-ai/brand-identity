import { FileText, Layers, Palette } from 'lucide-react';
import { EmptyState } from '../../../src/components/ui/empty-state';

export default function DashboardPage() {
  return (
    <div className="workspace">
      <EmptyState
        icon={<Layers aria-hidden="true" />}
        title="No active identity yet"
        description="Create a project from the public start screen, then return here to edit generated stages."
      />
      <div className="two-column" style={{ marginTop: 24 }}>
        <section className="panel panel-pad">
          <FileText aria-hidden="true" />
          <h2 className="section-title">Brief and strategy</h2>
          <p className="section-copy">Editable stage forms will land here after auth and project APIs.</p>
        </section>
        <section className="panel panel-pad">
          <Palette aria-hidden="true" />
          <h2 className="section-title">Visuals and assets</h2>
          <p className="section-copy">Generated directions, logos, and asset previews will appear here.</p>
        </section>
      </div>
    </div>
  );
}
