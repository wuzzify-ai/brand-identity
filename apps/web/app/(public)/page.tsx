import { Sparkles } from 'lucide-react';
import { LaunchPanel } from '../../src/components/identity/launch-panel';

const stages = ['Brief', 'Strategy', 'Visual directions', 'Assets', 'Brand book'];

export default function HomePage() {
  return (
    <div className="workspace">
      <div className="two-column">
        <section className="panel panel-pad" aria-labelledby="start-title">
          <p className="section-copy">Identity creation</p>
          <h1 id="start-title" className="section-title">
            Describe the business. The system turns it into a staged brand identity.
          </h1>
          <LaunchPanel />
        </section>

        <aside className="panel panel-pad" aria-labelledby="pipeline-title">
          <Sparkles size={22} aria-hidden="true" />
          <h2 id="pipeline-title" className="section-title">
            Workflow
          </h2>
          <p className="section-copy">
            The first AI pass fills editable brief and strategy fields. Visuals and assets generate
            only after the previous stages are complete.
          </p>
          <ol className="stage-list">
            {stages.map((stage, index) => (
              <li key={stage} className="stage-item">
                <span className="stage-number">{index + 1}</span>
                <span>{stage}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
